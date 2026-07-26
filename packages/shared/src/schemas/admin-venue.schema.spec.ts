import { describe, it, expect } from "vitest";
import { AdminVenueCreateSchema, AdminVenueUpdateSchema } from "./admin-venue.schema";

const BASE = {
  name: "Test Kahve", slug: "test-kahve", districtId: "d290f1ee-6c54-4b01-90e6-d701748f0851",
  category: "cafe", priceRange: "MODERATE", openingHours: { mon_fri: "09:00-18:00" },
  branchCount: 1, franchiseFlag: false, lat: 40.99, lng: 29.02,
};

describe("AdminVenueCreateSchema status/address/photos", () => {
  it("accepts an explicit status", () => {
    const r = AdminVenueCreateSchema.safeParse({ ...BASE, status: "PUBLISHED" });
    expect(r.success && r.data.status).toBe("PUBLISHED");
  });
  it("leaves status undefined when omitted", () => {
    const r = AdminVenueCreateSchema.safeParse(BASE);
    expect(r.success && r.data.status).toBeUndefined();
  });
  it("rejects an invalid status", () => expect(AdminVenueCreateSchema.safeParse({ ...BASE, status: "PUBLISHD" }).success).toBe(false));
  it("accepts optional address/photos", () => expect(AdminVenueCreateSchema.safeParse({ ...BASE, address: "Bahariye Cd. No:1", photos: ["https://x/1.jpg"] }).success).toBe(true));
});

describe("AdminVenueUpdateSchema", () => {
  it("is fully partial, still accepts status", () => expect(AdminVenueUpdateSchema.safeParse({ status: "ARCHIVED" }).success).toBe(true));
});
