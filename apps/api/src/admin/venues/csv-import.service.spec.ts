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
    ]);
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
    expect(valid[0].franchiseFlag).toBe(false);
  });
});
