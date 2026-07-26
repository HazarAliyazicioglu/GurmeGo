import { CsvImportService } from "./csv-import.service";

describe("CsvImportService.parseRows", () => {
  const service = new CsvImportService();

  it("collects row-level errors instead of throwing", () => {
    // Missing all expanded columns (slug, franchiseFlag, lat, lng, openingHours) — every one of
    // them fails validation, so this still exercises "row error, not a throw" without needing a
    // full column list, superseded in scope by the "requires slug, openingHours..." test below.
    const csv = "name,districtSlug,category,priceRange,branchCount\n,kadikoy,cafe,MODERATE,1";
    const result = service.parseRows(csv);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toEqual([{ row: 1, message: expect.stringContaining("name") }]);
  });

  it("requires slug, openingHours JSON, lat, lng, and franchiseFlag columns", () => {
    const csv = `name,slug,districtSlug,category,priceRange,branchCount,franchiseFlag,lat,lng,openingHours
Test Cafe,test-cafe,kadikoy,cafe,MODERATE,1,false,40.99,29.02,"{""mon_fri"":""09:00-18:00""}"`;
    const { valid, errors } = service.parseRows(csv);
    expect(errors).toEqual([]);
    expect(valid).toEqual([
      {
        row: 1,
        data: {
          name: "Test Cafe",
          slug: "test-cafe",
          districtSlug: "kadikoy",
          category: "cafe",
          priceRange: "MODERATE",
          branchCount: 1,
          franchiseFlag: false,
          lat: 40.99,
          lng: 29.02,
          openingHours: { mon_fri: "09:00-18:00" },
        },
      },
    ]);
  });

  it("tags each valid row with its ORIGINAL CSV line number, not its index among valid rows", () => {
    // Row 1 is structurally invalid (blank name), row 2 and row 3 are valid. If row numbers were
    // computed from the position within the filtered `valid` array instead of the original records,
    // row 2's data would be mislabeled as row 1.
    const csv = `name,slug,districtSlug,category,priceRange,branchCount,franchiseFlag,lat,lng,openingHours
,bad-row,kadikoy,cafe,MODERATE,1,false,40.99,29.02,"{}"
Second Cafe,second-cafe,kadikoy,cafe,MODERATE,1,false,40.99,29.02,"{}"
Third Cafe,third-cafe,kadikoy,cafe,MODERATE,1,false,40.99,29.02,"{}"`;
    const { valid, errors } = service.parseRows(csv);
    expect(errors).toEqual([{ row: 1, message: expect.stringContaining("name") }]);
    expect(valid.map((r) => r.row)).toEqual([2, 3]);
    expect(valid[0].data.slug).toBe("second-cafe");
    expect(valid[1].data.slug).toBe("third-cafe");
  });

  it("rejects a blank lat cell instead of silently coercing it to 0", () => {
    const csv = `name,slug,districtSlug,category,priceRange,branchCount,franchiseFlag,lat,lng,openingHours
Test Cafe,test-cafe,kadikoy,cafe,MODERATE,1,false,,29.02,"{}"`;
    const { valid, errors } = service.parseRows(csv);
    expect(valid).toEqual([]);
    expect(errors).toEqual([{ row: 1, message: expect.stringContaining("lat") }]);
  });

  it("rejects a blank lng cell instead of silently coercing it to 0", () => {
    const csv = `name,slug,districtSlug,category,priceRange,branchCount,franchiseFlag,lat,lng,openingHours
Test Cafe,test-cafe,kadikoy,cafe,MODERATE,1,false,40.99,,"{}"`;
    const { valid, errors } = service.parseRows(csv);
    expect(valid).toEqual([]);
    expect(errors).toEqual([{ row: 1, message: expect.stringContaining("lng") }]);
  });

  it("rejects a name longer than 200 characters, matching AdminVenueCreateSchema", () => {
    const longName = "A".repeat(201);
    const csv = `name,slug,districtSlug,category,priceRange,branchCount,franchiseFlag,lat,lng,openingHours
${longName},test-cafe,kadikoy,cafe,MODERATE,1,false,40.99,29.02,"{}"`;
    const { valid, errors } = service.parseRows(csv);
    expect(valid).toEqual([]);
    expect(errors).toEqual([{ row: 1, message: expect.stringContaining("name") }]);
  });

  it("rejects a slug longer than 220 characters, matching AdminVenueCreateSchema", () => {
    const longSlug = "a".repeat(221);
    const csv = `name,slug,districtSlug,category,priceRange,branchCount,franchiseFlag,lat,lng,openingHours
Test Cafe,${longSlug},kadikoy,cafe,MODERATE,1,false,40.99,29.02,"{}"`;
    const { valid, errors } = service.parseRows(csv);
    expect(valid).toEqual([]);
    expect(errors).toEqual([{ row: 1, message: expect.stringContaining("slug") }]);
  });

  it("returns a single generic file-level error instead of throwing or leaking csv-parse's raw message when the CSV is malformed", () => {
    // Unterminated quoted field — csv-parse/sync throws synchronously on this instead of returning
    // partial records. The raw csv-parse exception message must never reach the client (it can
    // contain internal parser/dependency detail) — only a generic message, logged server-side.
    const csv = `name,slug,districtSlug,category,priceRange,branchCount,franchiseFlag,lat,lng,openingHours
"Unterminated quote,test-cafe,kadikoy,cafe,MODERATE,1,false,40.99,29.02,"{}"`;
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const result = service.parseRows(csv);

    expect(result.valid).toEqual([]);
    expect(result.errors).toEqual([{ row: 0, message: "CSV dosyası ayrıştırılamadı: dosya biçimi geçersiz" }]);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("strips a leading UTF-8 BOM so the header row parses correctly (Excel 'CSV UTF-8' export)", () => {
    // Without `bom: true` in the csv-parse options, this leading BOM makes the first column's key
    // literally "﻿name" instead of "name" — the row would fail with a spurious "name zorunlu"
    // error even though the file is otherwise perfectly valid.
    const csv = `﻿name,slug,districtSlug,category,priceRange,branchCount,franchiseFlag,lat,lng,openingHours
Test Cafe,test-cafe,kadikoy,cafe,MODERATE,1,false,40.99,29.02,"{}"`;
    const { valid, errors } = service.parseRows(csv);
    expect(errors).toEqual([]);
    expect(valid).toHaveLength(1);
    expect(valid[0].data.name).toBe("Test Cafe");
  });

  it("reports a row-level error for malformed openingHours JSON", () => {
    const csv = `name,slug,districtSlug,category,priceRange,branchCount,franchiseFlag,lat,lng,openingHours
Test Cafe,test-cafe,kadikoy,cafe,MODERATE,1,false,40.99,29.02,not-json`;
    const { valid, errors } = service.parseRows(csv);
    expect(valid).toEqual([]);
    expect(errors).toEqual([{ row: 1, message: expect.stringContaining("openingHours") }]);
  });

  it("reports a row-level error for a non-flat-string-map openingHours JSON value", () => {
    const csv = `name,slug,districtSlug,category,priceRange,branchCount,franchiseFlag,lat,lng,openingHours
Test Cafe,test-cafe,kadikoy,cafe,MODERATE,1,false,40.99,29.02,"[""mon_fri""]"`;
    const { valid, errors } = service.parseRows(csv);
    expect(valid).toEqual([]);
    expect(errors).toEqual([{ row: 1, message: expect.stringContaining("openingHours") }]);
  });

  it("does not coerce franchiseFlag 'false' text into boolean true", () => {
    const csv = `name,slug,districtSlug,category,priceRange,branchCount,franchiseFlag,lat,lng,openingHours
Test Cafe,test-cafe,kadikoy,cafe,MODERATE,1,false,40.99,29.02,"{}"`;
    const { valid, errors } = service.parseRows(csv);
    expect(errors).toEqual([]);
    expect(valid[0].data.franchiseFlag).toBe(false);
  });
});

describe("CsvImportService.parseRows — status/address columns", () => {
  it("parses a CSV with one row omitting status and one row setting DRAFT + address", () => {
    const csv =
      "name,slug,districtSlug,category,priceRange,branchCount,franchiseFlag,lat,lng,openingHours,status,address\n" +
      'A,a,kadikoy,cafe,MODERATE,1,false,40.99,29.02,"{""mon_fri"":""09:00-18:00""}",,\n' +
      'B,b,kadikoy,cafe,MODERATE,1,false,40.98,29.01,"{""mon_fri"":""09:00-18:00""}",DRAFT,"Bahariye Cd. No:1"\n';
    const { valid, errors } = new CsvImportService().parseRows(csv);
    expect(errors).toEqual([]);
    expect(valid[0].data.status).toBeUndefined();
    expect(valid[1].data.status).toBe("DRAFT");
    expect(valid[1].data.address).toBe("Bahariye Cd. No:1");
  });
});
