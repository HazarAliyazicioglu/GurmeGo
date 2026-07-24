import { Injectable } from "@nestjs/common";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { PRICE_RANGE_VALUES } from "@gurmego/shared";

const CsvRowSchema = z.object({
  // `.max(200)`/`.max(220)` mirror AdminVenueCreateSchema (packages/shared/src/schemas/admin-venue.schema.ts)
  // exactly — CSV import must not be able to persist rows the manual create API would reject.
  name: z.string().min(1, "name zorunlu").max(200, "name en fazla 200 karakter olabilir"),
  slug: z.string().min(1, "slug zorunlu").max(220, "slug en fazla 220 karakter olabilir"),
  districtSlug: z.string().min(1),
  category: z.string().min(1),
  priceRange: z.enum(PRICE_RANGE_VALUES),
  branchCount: z.coerce.number().int().min(1),
  // `z.coerce.boolean()` is exactly `Boolean(input)` — since any non-empty string is truthy,
  // the CSV text "false" would coerce to `true`. Explicit enum + transform avoids that footgun.
  franchiseFlag: z
    .enum(["true", "false"], { errorMap: () => ({ message: "franchiseFlag 'true' veya 'false' olmalı" }) })
    .transform((v) => v === "true"),
  // `z.coerce.number()` on an empty string coerces to `0` (`Number("") === 0`), which is a
  // legitimately-in-range latitude/longitude — a blank cell would silently become real (bogus)
  // coordinates instead of failing validation. Require a non-blank string before coercing.
  lat: z.string().trim().min(1, "lat zorunlu").pipe(z.coerce.number().min(-90).max(90)),
  lng: z.string().trim().min(1, "lng zorunlu").pipe(z.coerce.number().min(-180).max(180)),
  openingHours: z.string().transform((s, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(s);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "openingHours geçerli JSON olmalı" });
      return z.NEVER;
    }
    const shape = z.record(z.string(), z.string()).safeParse(parsed);
    if (!shape.success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "openingHours düz bir { gün: saat } string haritası olmalı" });
      return z.NEVER;
    }
    return shape.data;
  }),
});

export type CsvRow = z.infer<typeof CsvRowSchema>;

// Each valid row is tagged with its ORIGINAL 1-based CSV line number. `importRows` reports its own
// errors (district-not-found, create-failure) against a subset of these rows (structurally-invalid
// rows were already filtered out here) — using the loop index of that filtered subset instead of the
// original row number would misattribute errors to the wrong CSV line. See Finding 1.
export type CsvImportRow = { row: number; data: CsvRow };

@Injectable()
export class CsvImportService {
  parseRows(csv: string): { valid: CsvImportRow[]; errors: { row: number; message: string }[] } {
    let records: Record<string, string>[];
    try {
      records = parse(csv, { columns: true, skip_empty_lines: true });
    } catch (err) {
      // A malformed file (bad quoting, inconsistent column counts, ...) makes csv-parse throw
      // synchronously — surface it as a single file-level row error instead of a 500 that discards
      // even the valid rows in an otherwise-fine file.
      const message = err instanceof Error ? err.message : "Bilinmeyen CSV ayrıştırma hatası";
      return { valid: [], errors: [{ row: 0, message: `CSV dosyası ayrıştırılamadı: ${message}` }] };
    }

    const valid: CsvImportRow[] = [];
    const errors: { row: number; message: string }[] = [];

    records.forEach((record, index) => {
      const row = index + 1;
      const result = CsvRowSchema.safeParse(record);
      if (result.success) {
        valid.push({ row, data: result.data });
      } else {
        errors.push({ row, message: result.error.issues.map((i) => i.message).join(", ") });
      }
    });

    return { valid, errors };
  }
}
