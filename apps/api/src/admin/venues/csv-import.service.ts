import { Injectable } from "@nestjs/common";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { PRICE_RANGE_VALUES } from "@gurmego/shared";

const CsvRowSchema = z.object({
  name: z.string().min(1, "name zorunlu"),
  slug: z.string().min(1, "slug zorunlu"),
  districtSlug: z.string().min(1),
  category: z.string().min(1),
  priceRange: z.enum(PRICE_RANGE_VALUES),
  branchCount: z.coerce.number().int().min(1),
  // `z.coerce.boolean()` is exactly `Boolean(input)` — since any non-empty string is truthy,
  // the CSV text "false" would coerce to `true`. Explicit enum + transform avoids that footgun.
  franchiseFlag: z
    .enum(["true", "false"], { errorMap: () => ({ message: "franchiseFlag 'true' veya 'false' olmalı" }) })
    .transform((v) => v === "true"),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
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

@Injectable()
export class CsvImportService {
  parseRows(csv: string) {
    const records: Record<string, string>[] = parse(csv, { columns: true, skip_empty_lines: true });
    const valid: CsvRow[] = [];
    const errors: { row: number; message: string }[] = [];

    records.forEach((record, index) => {
      const result = CsvRowSchema.safeParse(record);
      if (result.success) {
        valid.push(result.data);
      } else {
        errors.push({ row: index + 1, message: result.error.issues.map((i) => i.message).join(", ") });
      }
    });

    return { valid, errors };
  }
}
