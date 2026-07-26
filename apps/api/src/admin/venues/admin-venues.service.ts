import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AdminVenueCreateInput, AdminVenueUpdateInput } from "@gurmego/shared";
import { PrismaService } from "../../prisma/prisma.service";
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
  ) {}

  create(input: AdminVenueCreateInput) {
    const status = input.status ?? "DRAFT";
    const isBoutique = this.boutique.evaluate({ branchCount: input.branchCount, franchiseFlag: input.franchiseFlag, hasEditorialNote: !!input.editorialNote, status });
    // `location` is a required PostGIS column the Prisma client can't write (ADR 002) — delegated to
    // the repository's raw-SQL insert, which also handles isBoutique/verifiedAt/status/source.
    return this.venuesRepository.createWithLocation(this.prisma, { ...input, isBoutique, verifiedAt: new Date(), status, source: "MANUAL" });
  }

  async update(id: string, input: AdminVenueUpdateInput) {
    // Snapshot + write must be atomic (A4): the version row and the venue mutation land together or
    // not at all. Partial-update completeness — recompute isBoutique from the merged (request +
    // current DB) state, so a patch that only changes branchCount still evaluates the rule correctly.
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await this.venuesRepository.findRawForSnapshot(tx, id);
      await tx.venueVersion.create({ data: { venueId: id, snapshot: existing as unknown as Prisma.InputJsonValue, createdBy: null } });
      const branchCount = input.branchCount ?? existing.branchCount;
      const franchiseFlag = input.franchiseFlag ?? existing.franchiseFlag;
      const hasEditorialNote = input.editorialNote !== undefined ? !!input.editorialNote : !!existing.editorialNote;
      const status = input.status ?? existing.status;
      const isBoutique = this.boutique.evaluate({ branchCount, franchiseFlag, hasEditorialNote, status });
      return this.venuesRepository.updateWithLocation(tx, id, { ...input, isBoutique, verifiedAt: new Date() });
    });
  }

  async revert(venueId: string, versionId: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const version = await tx.venueVersion.findUniqueOrThrow({ where: { id: versionId } });
      if (version.venueId !== venueId) {
        // A mismatched venueId/versionId pair is treated as "no such version for this venue" —
        // same shape as VENUE_NOT_FOUND elsewhere, so callers can't distinguish "wrong venue" from
        // "wrong id" and use that to probe other venues' version history.
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
      await tx.venueVersion.create({ data: { venueId, snapshot: current as unknown as Prisma.InputJsonValue, createdBy: null } });
      // `version.snapshot` is a Prisma Json column -- its static type (Prisma.JsonValue) cannot
      // carry the domain knowledge that THIS snapshot was produced by findRawForSnapshot's
      // AdminVenueRow shape. This is the one place that knowledge is asserted; every field after
      // this cast flows through snapshotToUpdateInput's fully-typed signature.
      const restored = snapshotToUpdateInput(version.snapshot as unknown as AdminVenueRow);
      return this.venuesRepository.updateWithLocation(tx, venueId, { ...restored, verifiedAt: new Date() });
    });
  }

  async importRows(
    rows: CsvImportRow[],
  ): Promise<{ created: number; skipped: number; rowErrors: { row: number; message: string }[] }> {
    let created = 0;
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
        await this.create({
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
        });
        created++;
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

    return { created, skipped, rowErrors };
  }
}
