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

  // Final whole-branch review finding: `updateWithLocation` (apps/api's venues.repository.ts)
  // only touches the `location` column when BOTH lat AND lng are present -- a lat-only or
  // lng-only payload silently drops the coordinate change while AdminVenuesService.update()
  // still snapshots a VenueVersion and stamps a fresh verifiedAt, falsely marking the venue as
  // re-verified. Must be rejected at the schema level, before it ever reaches the repository.
  it("rejects a payload with only lat set", () => expect(AdminVenueUpdateSchema.safeParse({ lat: 40.99 }).success).toBe(false));
  it("rejects a payload with only lng set", () => expect(AdminVenueUpdateSchema.safeParse({ lng: 29.02 }).success).toBe(false));
  it("accepts a payload with both lat and lng set", () => expect(AdminVenueUpdateSchema.safeParse({ lat: 40.99, lng: 29.02 }).success).toBe(true));
  it("accepts a payload with neither lat nor lng set", () => expect(AdminVenueUpdateSchema.safeParse({ status: "ARCHIVED" }).success).toBe(true));
});
