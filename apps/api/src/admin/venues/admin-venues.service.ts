import { randomUUID } from "crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AdminVenueCreateInput, AdminVenueUpdateInput } from "@gurmego/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";
import { BoutiqueService } from "../../rule-engine/boutique.service";
import { VenuesRepository, snapshotToUpdateInput, AdminVenueRow } from "../../venues/venues.repository";
import type { CsvImportRow } from "./csv-import.service";

// Postgres unique_violation (SQLSTATE 23505). `createWithLocation` inserts via `$queryRaw` (ADR 002 —
// the `location` PostGIS column forces raw SQL), so a constraint violation surfaces as a Prisma
// `PrismaClientKnownRequestError` with code P2010 ("raw query failed") and the underlying Postgres
// error code nested in `meta.code`, NOT as the P2002 code the generated Prisma Client API would use.
function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2010" &&
    (err.meta as { code?: string } | undefined)?.code === "23505"
  );
}

@Injectable()
export class AdminVenuesService {
  constructor(
    private prisma: PrismaService,
    private boutique: BoutiqueService,
    private venuesRepository: VenuesRepository,
    private audit: AuditService,
  ) {}

  // Public create = insert + audit row in ONE transaction (ADR 006). CSV import deliberately uses
  // `insertVenue` directly: its audit trail is a single summary (intent-before-effect), not one row per venue.
  create(input: AdminVenueCreateInput, actorId: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const venue = await this.insertVenue(tx, input);
      await this.audit.record(tx, { actorId, action: "VENUE_CREATED", targetType: "Venue", targetId: venue.id, meta: { status: venue.status } });
      return venue;
    });
  }

  private insertVenue(client: Pick<PrismaService, "$queryRaw">, input: AdminVenueCreateInput) {
    const status = input.status ?? "DRAFT";
    const isBoutique = this.boutique.evaluate({ branchCount: input.branchCount, franchiseFlag: input.franchiseFlag, hasEditorialNote: !!input.editorialNote, status });
    // `location` is a required PostGIS column the Prisma client can't write (ADR 002) — delegated to
    // the repository's raw-SQL insert, which also handles isBoutique/verifiedAt/status/source.
    return this.venuesRepository.createWithLocation(client, { ...input, isBoutique, verifiedAt: new Date(), status, source: "MANUAL" });
  }

  async update(id: string, input: AdminVenueUpdateInput, actorId: string) {
    // Snapshot + write must be atomic (A4): the version row and the venue mutation land together or
    // not at all. Partial-update completeness — recompute isBoutique from the merged (request +
    // current DB) state, so a patch that only changes branchCount still evaluates the rule correctly.
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await this.venuesRepository.findRawForSnapshot(tx, id);
      await tx.venueVersion.create({ data: { venueId: id, snapshot: existing as unknown as Prisma.InputJsonValue, createdBy: actorId } });
      const branchCount = input.branchCount ?? existing.branchCount;
      const franchiseFlag = input.franchiseFlag ?? existing.franchiseFlag;
      const hasEditorialNote = input.editorialNote !== undefined ? !!input.editorialNote : !!existing.editorialNote;
      const status = input.status ?? existing.status;
      const isBoutique = this.boutique.evaluate({ branchCount, franchiseFlag, hasEditorialNote, status });
      const updated = await this.venuesRepository.updateWithLocation(tx, id, { ...input, isBoutique, verifiedAt: new Date() });
      // Field NAMES only -- never values: venue free text (editorial note, address, ...) must not leak into
      // the audit trail (ADR 006 PII boundary). The full before-state is the VenueVersion snapshot above.
      const fields = Object.entries(input).filter(([, v]) => v !== undefined).map(([k]) => k);
      await this.audit.record(tx, { actorId, action: "VENUE_UPDATED", targetType: "Venue", targetId: id, meta: { fields } });
      return updated;
    });
  }

  async search(term: string) {
    return this.prisma.venue.findMany({
      where: { OR: [{ name: { contains: term, mode: "insensitive" } }, { slug: { contains: term, mode: "insensitive" } }] },
      select: { id: true, name: true, slug: true, status: true },
      take: 20,
    });
  }

  async listVersions(venueId: string) {
    return this.prisma.venueVersion.findMany({
      where: { venueId },
      select: { id: true, createdAt: true, createdBy: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async revert(venueId: string, versionId: string, actorId: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // `findUnique` (not `findUniqueOrThrow`) -- a well-formed but non-existent `versionId` (it's
      // already passed `ParseUUIDPipe` at the controller) must produce this same clean
      // VENUE_VERSION_NOT_FOUND 404, not an uncaught Prisma "record not found" surfacing as a 500
      // via the global exception filter. This also naturally covers the mismatched-venue case
      // below with the identical error shape.
      const version = await tx.venueVersion.findUnique({ where: { id: versionId } });
      if (!version || version.venueId !== venueId) {
        // A missing version, and a mismatched venueId/versionId pair, are both treated as "no such
        // version for this venue" — same shape as VENUE_NOT_FOUND elsewhere, so callers can't
        // distinguish "wrong venue" from "wrong id" (or "doesn't exist at all") and use that to
        // probe other venues' version history.
        // The HTTP response body must stay exactly `{ error: { code, message } }` per
        // docs/api-spec.md; NestJS's HttpException only derives `.message` from a top-level
        // `message` property, so set it explicitly after construction (same pattern as
        // venues.service.ts / admin-users.service.ts).
        const notFound = new NotFoundException({
          error: { code: "VENUE_VERSION_NOT_FOUND", message: "Bu mekan için böyle bir versiyon bulunamadı" },
        });
        notFound.message = "Bu mekan için böyle bir versiyon bulunamadı";
        throw notFound;
      }
      const current = await this.venuesRepository.findRawForSnapshot(tx, venueId);
      await tx.venueVersion.create({ data: { venueId, snapshot: current as unknown as Prisma.InputJsonValue, createdBy: actorId } });
      // `version.snapshot` is a Prisma Json column -- its static type (Prisma.JsonValue) cannot
      // carry the domain knowledge that THIS snapshot was produced by findRawForSnapshot's
      // AdminVenueRow shape. This is the one place that knowledge is asserted; every field after
      // this cast flows through snapshotToUpdateInput's fully-typed signature.
      const restored = snapshotToUpdateInput(version.snapshot as unknown as AdminVenueRow);
      const reverted = await this.venuesRepository.updateWithLocation(tx, venueId, { ...restored, verifiedAt: new Date() });
      await this.audit.record(tx, { actorId, action: "VENUE_REVERTED", targetType: "Venue", targetId: venueId, meta: { versionId } });
      return reverted;
    });
  }

  // CSV import is NOT atomic (row-by-row partial success is the product's behaviour), so its audit trail
  // cannot be "same transaction as the action". Intent-before-effect instead (ADR 006 v2):
  //   1. CSV_IMPORT_STARTED is written FIRST and fail-closed -- if it cannot be recorded, nothing is imported.
  //   2. the import runs;
  //   3. CSV_IMPORTED (counts + created venue ids, never row content) is written best-effort: the import has
  //      already happened, so a failure here is logged, not surfaced. The STARTED record still proves the attempt,
  //      and STARTED-without-IMPORTED (same importId) is how an import that died half-way is found.
  async importWithAudit(rows: CsvImportRow[], schemaErrorCount: number, actorId: string) {
    // Nothing valid to import (e.g. a malformed file): there is no effect to record, so no audit noise either.
    if (rows.length === 0) return { created: 0, skipped: 0, rowErrors: [], createdVenueIds: [] };
    const importId = randomUUID();
    await this.prisma.$transaction((tx: Prisma.TransactionClient) =>
      this.audit.record(tx, {
        actorId,
        action: "CSV_IMPORT_STARTED",
        targetType: "VenueImport",
        meta: { importId, rowCount: rows.length + schemaErrorCount },
      }),
    );

    const result = await this.importRows(rows);

    try {
      await this.prisma.$transaction((tx: Prisma.TransactionClient) =>
        this.audit.record(tx, {
          actorId,
          action: "CSV_IMPORTED",
          targetType: "VenueImport",
          meta: {
            importId,
            created: result.created,
            skipped: result.skipped,
            errorCount: result.rowErrors.length + schemaErrorCount,
            createdVenueIds: result.createdVenueIds,
          },
        }),
      );
    } catch (err) {
      console.error(`CSV import ${importId}: import finished but the CSV_IMPORTED audit record could not be written:`, err);
    }
    return result;
  }

  async importRows(
    rows: CsvImportRow[],
  ): Promise<{ created: number; skipped: number; rowErrors: { row: number; message: string }[]; createdVenueIds: string[] }> {
    let created = 0;
    const createdVenueIds: string[] = [];
    let skipped = 0;
    const rowErrors: { row: number; message: string }[] = [];

    for (const { row: rowNumber, data: row } of rows) {
      try {
        // Slug-exists is checked BEFORE the district lookup: re-importing the same CSV must be
        // idempotent (existing-slug rows are skipped), independent of whether that row's
        // districtSlug happens to be stale/invalid — a district problem on an already-imported row
        // is not something the caller needs to know about, and must not surface as an error.
        const existing = await this.prisma.venue.findUnique({ where: { slug: row.slug } });
        if (existing) {
          skipped++;
          continue;
        }
        const district = await this.prisma.district.findUnique({ where: { slug: row.districtSlug } });
        if (!district) {
          rowErrors.push({ row: rowNumber, message: `'${row.districtSlug}' slug'lı ilçe bulunamadı` });
          continue;
        }
        // Explicit field mapping (not a raw type cast) — AdminVenueCreateSchema's `.default([])`/
        // `.optional()` fields only apply when the schema is actually run through `.parse()`; this
        // object is constructed directly and passed to `create()`, which takes the already-typed
        // `AdminVenueCreateInput` shape, so every field `create()` needs must be set explicitly here.
        const inserted = await this.insertVenue(this.prisma, {
          name: row.name,
          slug: row.slug,
          districtId: district.id,
          category: row.category,
          priceRange: row.priceRange,
          signatureItems: [],
          openingHours: row.openingHours,
          branchCount: row.branchCount,
          franchiseFlag: row.franchiseFlag,
          lat: row.lat,
          lng: row.lng,
          status: row.status ?? "PUBLISHED",
          address: row.address,
        });
        created++;
        createdVenueIds.push(inserted.id);
      } catch (err) {
        // The findUnique-by-slug check above is a pre-check, not a lock — two concurrent imports of
        // the same new slug can both pass it and both attempt to insert, so the DB's unique
        // constraint (not this code) is the actual source of truth. Given this MVP's real usage
        // (1-2 curators, not genuine concurrency), we don't need distributed locking: catching the
        // resulting unique-violation here and treating it as "skip, already exists" reaches the same
        // outcome as the pre-check catching it, without a 500 or a misleading generic row error.
        if (isUniqueViolation(err)) {
          skipped++;
          continue;
        }
        // Prisma/repository error detail (schema/column names, constraint names, ...) must not
        // leak to the client — log it server-side and return a generic row error instead.
        console.error(`CSV import row ${rowNumber} failed:`, err);
        rowErrors.push({ row: rowNumber, message: "Mekan oluşturulamadı: beklenmeyen hata" });
      }
    }

    return { created, skipped, rowErrors, createdVenueIds };
  }
}
