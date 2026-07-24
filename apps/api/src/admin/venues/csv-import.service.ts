import { Injectable } from "@nestjs/common";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { PRICE_RANGE_VALUES } from "@gurmego/shared";

const CsvRowSchema = z.object({
  name: z.string().min(1, "name zorunlu"),
  districtSlug: z.string().min(1),
  category: z.string().min(1),
  priceRange: z.enum(PRICE_RANGE_VALUES),
  branchCount: z.coerce.number().int().min(1),
});

@Injectable()
export class CsvImportService {
  parseRows(csv: string) {
    const records: Record<string, string>[] = parse(csv, { columns: true, skip_empty_lines: true });
    const valid: z.infer<typeof CsvRowSchema>[] = [];
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
