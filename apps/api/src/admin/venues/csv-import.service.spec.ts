import { CsvImportService } from "./csv-import.service";

describe("CsvImportService.parseRows", () => {
  const service = new CsvImportService();

  it("parses valid CSV rows into venue create inputs", () => {
    const csv = "name,districtSlug,category,priceRange,branchCount\nKahveci,kadikoy,cafe,MODERATE,1";
    const result = service.parseRows(csv);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]).toMatchObject({ name: "Kahveci", districtSlug: "kadikoy", priceRange: "MODERATE" });
    expect(result.errors).toHaveLength(0);
  });

  it("collects row-level errors instead of throwing", () => {
    const csv = "name,districtSlug,category,priceRange,branchCount\n,kadikoy,cafe,MODERATE,1";
    const result = service.parseRows(csv);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toEqual([{ row: 1, message: expect.stringContaining("name") }]);
  });
});
