import { Injectable } from "@nestjs/common";
import { parse } from "csv-parse/sync";
import { CsvVenueImportRowSchema, type CsvVenueImportRow } from "@gurmego/shared";

export type CsvRow = CsvVenueImportRow;

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
      // `bom: true` strips a leading UTF-8 BOM before the header row is parsed. Excel's "CSV UTF-8"
      // export commonly prepends one; without this option the first column's key becomes the literal
      // "﻿name" instead of "name", so every row in an otherwise-valid Excel export fails
      // validation with a spurious "name zorunlu" error.
      records = parse(csv, { columns: true, skip_empty_lines: true, bom: true });
    } catch (err) {
      // A malformed file (bad quoting, inconsistent column counts, ...) makes csv-parse throw
      // synchronously — surface it as a single file-level row error instead of a 500 that discards
      // even the valid rows in an otherwise-fine file. The raw csv-parse message (internal parser
      // state, sometimes fragments of file content) is logged server-side only, same pattern as
      // admin-venues.service.ts's importRows create()-failure handling — the client gets a generic
      // message.
      console.error("CSV parse failed:", err);
      return { valid: [], errors: [{ row: 0, message: "CSV dosyası ayrıştırılamadı: dosya biçimi geçersiz" }] };
    }

    const valid: CsvImportRow[] = [];
    const errors: { row: number; message: string }[] = [];

    records.forEach((record, index) => {
      const row = index + 1;
      const result = CsvVenueImportRowSchema.safeParse(record);
      if (result.success) {
        valid.push({ row, data: result.data });
      } else {
        errors.push({ row, message: result.error.issues.map((i) => i.message).join(", ") });
      }
    });

    return { valid, errors };
  }
}
