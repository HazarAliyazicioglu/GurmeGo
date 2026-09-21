import { BadRequestException, Injectable } from "@nestjs/common";
import { parse } from "csv-parse";
import { CsvVenueImportRowSchema, type CsvVenueImportRow } from "@gurmego/shared";
import { CSV_IMPORT_LIMITS } from "./csv-import.config";

export type CsvRow = CsvVenueImportRow;

// Each valid row is tagged with its ORIGINAL 1-based CSV file line number (the line a human sees if
// they open the file in a spreadsheet app: line 1 is the header, so the first data row is line 2).
// `importRows` reports its own errors (district-not-found, create-failure) against a subset of these
// rows (structurally-invalid rows were already filtered out here) — using the loop index of that
// filtered subset instead of the original row number would misattribute errors to the wrong CSV line.
// See Finding 1.
export type CsvImportRow = { row: number; data: CsvRow };

@Injectable()
export class CsvImportService {
  async parseRows(csv: string): Promise<{ valid: CsvImportRow[]; errors: { row: number; message: string }[] }> {
    let records: Record<string, string>[];
    try {
      // Using the callback/stream-based `csv-parse` entry point (not `csv-parse/sync`) so parsing
      // happens incrementally off a Transform stream instead of synchronously walking the whole
      // buffer in one blocking call — on a large admin CSV upload the sync variant would stall the
      // event loop (and every other in-flight request) for the whole parse duration.
      records = await new Promise<Record<string, string>[]>((resolve, reject) => {
        // `bom: true` strips a leading UTF-8 BOM before the header row is parsed. Excel's "CSV UTF-8"
        // export commonly prepends one; without this option the first column's key becomes the literal
        // "﻿name" instead of "name", so every row in an otherwise-valid Excel export fails
        // validation with a spurious "name zorunlu" error.
        // `to: maxRows + 1` makes the parser stop after one row past the cap instead of walking the whole
        // file: a giant upload is rejected almost instantly, not after being fully parsed.
        parse(csv, { columns: true, skip_empty_lines: true, bom: true, to: CSV_IMPORT_LIMITS.maxRows + 1 }, (err, result: Record<string, string>[]) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    } catch (err) {
      // A malformed file (bad quoting, inconsistent column counts, ...) makes csv-parse error out
      // asynchronously — surface it as a single file-level row error instead of a 500 that discards
      // even the valid rows in an otherwise-fine file. The raw csv-parse message (internal parser
      // state, sometimes fragments of file content) is logged server-side only, same pattern as
      // admin-venues.service.ts's importRows create()-failure handling — the client gets a generic
      // message.
      console.error("CSV parse failed:", err);
      return { valid: [], errors: [{ row: 0, message: "CSV dosyası ayrıştırılamadı: dosya biçimi geçersiz" }] };
    }

    // The cap check is deliberately OUTSIDE the try/catch above (which converts parser failures to a
    // file-level row error) -- exceeding the cap must reject the whole file with a 400, and by throwing
    // here, before anything is validated or written, a rejected file causes zero DB writes.
    if (records.length > CSV_IMPORT_LIMITS.maxRows) {
      throw new BadRequestException({
        error: {
          code: "CSV_TOO_MANY_ROWS",
          message: `CSV en fazla ${CSV_IMPORT_LIMITS.maxRows} satır içerebilir; dosyayı bölüp tekrar yükleyin`,
        },
      });
    }

    const valid: CsvImportRow[] = [];
    const errors: { row: number; message: string }[] = [];

    records.forEach((record, index) => {
      // +2, not +1: `index` is 0-based among DATA rows only (the header was already consumed by
      // `columns: true`), and the header itself occupies file line 1. So data record 0 is file line
      // 2, record 1 is file line 3, and so on — +1 alone would under-report every row number by one
      // relative to what a human sees opening the file in a spreadsheet app.
      const row = index + 2;
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
