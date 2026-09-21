import { BadRequestException } from "@nestjs/common";
import { CsvImportService } from "./csv-import.service";

jest.mock("./csv-import.config", () => ({ CSV_IMPORT_LIMITS: { maxRows: 3 } }));

// DENETIM-RAPORU Orta: a 10 MB upload can hold tens of thousands of short rows, and each valid row costs
// 2-3 sequential DB queries in importRows -- a huge file would tie the server up for minutes.
const HEADER = "name,slug,districtSlug,category,priceRange,branchCount,franchiseFlag,lat,lng,openingHours";
const row = (i: number) => `Cafe ${i},cafe-${i},kadikoy,cafe,MODERATE,1,false,40.99,29.02,"{""mon_fri"":""09:00-18:00""}"`;
const csvWith = (n: number) => [HEADER, ...Array.from({ length: n }, (_, i) => row(i))].join("\n");

describe("CsvImportService.parseRows — row cap", () => {
  const service = new CsvImportService();

  it("accepts a file with exactly the maximum number of rows", async () => {
    const { valid, errors } = await service.parseRows(csvWith(3));
    expect(errors).toEqual([]);
    expect(valid).toHaveLength(3);
  });

  it("rejects the WHOLE file with a 400 CSV_TOO_MANY_ROWS one row over the cap", async () => {
    const attempt = service.parseRows(csvWith(4));
    await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
    await attempt.catch((e: BadRequestException) => {
      expect(e.getStatus()).toBe(400);
      expect(e.getResponse()).toEqual({
        error: { code: "CSV_TOO_MANY_ROWS", message: expect.stringContaining("3") },
      });
    });
  });

  it("counts rows that fail validation towards the cap too (a file of junk rows is just as expensive to parse)", async () => {
    const emptyRow = ",,,,,,,,,"; // right column count, every field blank -> fails schema validation
    const junk = [HEADER, emptyRow, emptyRow, emptyRow, emptyRow].join("\n");
    await expect(service.parseRows(junk)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("does not read the whole file once the cap is exceeded", async () => {
    const started = Date.now();
    await expect(service.parseRows(csvWith(200_000))).rejects.toBeInstanceOf(BadRequestException);
    // A full parse of 200k rows takes seconds; stopping at cap+1 is effectively instant.
    expect(Date.now() - started).toBeLessThan(1500);
  });
});
