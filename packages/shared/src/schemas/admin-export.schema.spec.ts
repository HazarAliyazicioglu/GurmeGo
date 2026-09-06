import { describe, it, expect } from "vitest";
import { AdminExportQuerySchema } from "./admin-export.schema";

// MINOR finding: AdminExportController's `format` query param was read as an unvalidated
// TypeScript-only cast (`format: "json" | "csv" = "json"`), so an invalid value silently fell
// through to AdminReportsService.exportVenues, which treats anything not exactly "json" as CSV.
describe("AdminExportQuerySchema", () => {
  it("accepts format=json", () => {
    const r = AdminExportQuerySchema.safeParse({ format: "json" });
    expect(r.success && r.data).toEqual({ format: "json" });
  });

  it("accepts format=csv", () => {
    const r = AdminExportQuerySchema.safeParse({ format: "csv" });
    expect(r.success && r.data).toEqual({ format: "csv" });
  });

  it("defaults to json when format is omitted", () => {
    const r = AdminExportQuerySchema.safeParse({});
    expect(r.success && r.data).toEqual({ format: "json" });
  });

  it("rejects an invalid format value", () => {
    const r = AdminExportQuerySchema.safeParse({ format: "xml" });
    expect(r.success).toBe(false);
  });
});
