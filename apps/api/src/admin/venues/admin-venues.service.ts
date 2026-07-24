import { Injectable, NotFoundException } from "@nestjs/common";
import { AdminVenueCreateInput, AdminVenueUpdateInput } from "@gurmego/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { BoutiqueService } from "../../rule-engine/boutique.service";
import { VenuesRepository } from "../../venues/venues.repository";
import type { CsvImportRow } from "./csv-import.service";

@Injectable()
export class AdminVenuesService {
  constructor(
    private prisma: PrismaService,
    private boutique: BoutiqueService,
    private venuesRepository: VenuesRepository,
  ) {}

  create(input: AdminVenueCreateInput) {
    const isBoutique = this.boutique.evaluate({
      branchCount: input.branchCount,
      franchiseFlag: input.franchiseFlag,
      hasEditorialNote: !!input.editorialNote,
    });
    // `location` is a required PostGIS column the Prisma client can't write (ADR 002) — delegated to
    // the repository's raw-SQL insert, which also handles isBoutique/verifiedAt/status/source.
    return this.venuesRepository.createWithLocation({
      ...input,
      isBoutique,
      verifiedAt: new Date(),
      status: "DRAFT",
      source: "MANUAL",
    });
  }

  update(id: string, input: AdminVenueUpdateInput) {
    // `update` is a partial patch — only recompute isBoutique when both rule-engine inputs are present
    // in this request; otherwise leave it untouched (repository skips undefined fields).
    const isBoutique =
      input.branchCount !== undefined && input.franchiseFlag !== undefined
        ? this.boutique.evaluate({
            branchCount: input.branchCount,
            franchiseFlag: input.franchiseFlag,
            hasEditorialNote: !!input.editorialNote,
          })
        : undefined;
    return this.venuesRepository.updateWithLocation(id, { ...input, isBoutique });
  }

  async revert(venueId: string, versionId: string) {
    const version = await this.prisma.venueVersion.findUniqueOrThrow({ where: { id: versionId } });
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
    return this.prisma.venue.update({ where: { id: venueId }, data: version.snapshot as any });
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
        // Prisma/repository error detail (schema/column names, constraint names, ...) must not
        // leak to the client — log it server-side and return a generic row error instead.
        console.error(`CSV import row ${rowNumber} failed:`, err);
        rowErrors.push({ row: rowNumber, message: "Mekan oluşturulamadı: beklenmeyen hata" });
      }
    }

    return { created, skipped, rowErrors };
  }
}
