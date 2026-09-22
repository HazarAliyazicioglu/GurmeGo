import { describe, it, expect } from "vitest";
import { DataQualityReportSchema } from "./admin-report.schema";

describe("DataQualityReportSchema", () => {
  it("accepts the real GET /admin/reports/data-quality response shape", () => {
    const result = DataQualityReportSchema.safeParse({
      perDistrict: [{ name: "Kadıköy", count: 12 }],
      staleCount: 3,
      bySource: [{ source: "MANUAL", count: 12 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown source value", () => {
    const result = DataQualityReportSchema.safeParse({
      perDistrict: [],
      staleCount: 0,
      bySource: [{ source: "SCRAPED", count: 1 }],
    });
    expect(result.success).toBe(false);
  });
});
