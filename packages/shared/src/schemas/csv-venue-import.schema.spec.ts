import { describe, it, expect } from "vitest";
import { CsvVenueImportRowSchema } from "./csv-venue-import.schema";

describe("CsvVenueImportRowSchema status/address columns", () => {
  const BASE_ROW = {
    name: "Test", slug: "test", districtSlug: "kadikoy", category: "cafe",
    priceRange: "MODERATE" as const, branchCount: "1", franchiseFlag: "false" as const,
    lat: "40.99", lng: "29.02", openingHours: '{"mon_fri":"09:00-18:00"}',
  };
  it("empty status cell -> undefined", () => {
    const r = CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, status: "" });
    expect(r.success && r.data.status).toBeUndefined();
  });
  it("DRAFT accepted", () => {
    const r = CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, status: "DRAFT" });
    expect(r.success && r.data.status).toBe("DRAFT");
  });
  it("ARCHIVED rejected — CSV import can only produce DRAFT or PUBLISHED", () => {
    expect(CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, status: "ARCHIVED" }).success).toBe(false);
  });
  it("status column absent entirely still parses", () => expect(CsvVenueImportRowSchema.safeParse(BASE_ROW).success).toBe(true));
  it("address column: value kept, empty treated as undefined", () => {
    const r1 = CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, address: "Bahariye Cd. No:1" });
    expect(r1.success && r1.data.address).toBe("Bahariye Cd. No:1");
    const r2 = CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, address: "" });
    expect(r2.success && r2.data.address).toBeUndefined();
  });
});
