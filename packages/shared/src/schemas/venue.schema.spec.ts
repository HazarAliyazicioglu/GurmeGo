import { describe, it, expect } from "vitest";
import { z } from "zod";
import { VenueSchema, VenueListQuerySchema, OptionalTrueFlag, VenueDetailSchema, BboxQuerySchema } from "./venue.schema";

describe("VenueSchema", () => {
  it("accepts a valid venue payload", () => {
    const result = VenueSchema.safeParse({
      id: "d290f1ee-6c54-4b01-90e6-d701748f0851",
      name: "Kadıköy Kahvecisi",
      slug: "kadikoy-kahvecisi",
      districtId: "d290f1ee-6c54-4b01-90e6-d701748f0852",
      category: "cafe",
      priceRange: "MODERATE",
      signatureItems: ["filtre kahve", "kaşarlı tost"],
      transportNote: "Kadıköy iskelesinden 5 dk yürüme",
      openingHours: { mon: "09:00-22:00" },
      editorialNote: "Sessiz, çalışmaya uygun, gerçek filtre kahve.",
      isBoutique: true,
      branchCount: 1,
      verifiedAt: "2026-07-24T00:00:00.000Z",
      status: "PUBLISHED",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid priceRange", () => {
    const result = VenueSchema.safeParse({
      id: "d290f1ee-6c54-4b01-90e6-d701748f0851",
      name: "X",
      slug: "x",
      districtId: "d290f1ee-6c54-4b01-90e6-d701748f0852",
      category: "cafe",
      priceRange: "FREE",
      signatureItems: [],
      openingHours: {},
      isBoutique: false,
      branchCount: 1,
      verifiedAt: "2026-07-24T00:00:00.000Z",
      status: "DRAFT",
    });
    expect(result.success).toBe(false);
  });

});

describe("OptionalTrueFlag", () => {
  it("stays undefined when absent", () => expect(z.object({ flag: OptionalTrueFlag }).parse({}).flag).toBeUndefined());
  it("parses 'true' as true", () => expect(z.object({ flag: OptionalTrueFlag }).parse({ flag: "true" }).flag).toBe(true));
  it("rejects 'false'", () => expect(z.object({ flag: OptionalTrueFlag }).safeParse({ flag: "false" }).success).toBe(false));
});

describe("VenueListQuerySchema", () => {
  it("no longer accepts lat/lng", () => expect((VenueListQuerySchema.parse({ lat: "40.99", lng: "29.02" }) as any).lat).toBeUndefined());
  it("openNow=true parses, openNow=false rejects", () => {
    expect(VenueListQuerySchema.parse({ openNow: "true" }).openNow).toBe(true);
    expect(VenueListQuerySchema.safeParse({ openNow: "false" }).success).toBe(false);
  });
  it("isBoutique=false rejects", () => expect(VenueListQuerySchema.safeParse({ isBoutique: "false" }).success).toBe(false));
});

describe("VenueDetailSchema", () => {
  const FULL = {
    id: "d290f1ee-6c54-4b01-90e6-d701748f0851", slug: "x", name: "X", category: "cafe",
    cuisineType: null, priceRange: "MODERATE", signatureItems: [], transportNote: null,
    openingHours: {}, editorialNote: null, isBoutique: false,
    verifiedAt: "2026-07-24T00:00:00.000Z", source: "MANUAL", googleRating: null,
    googleRatingCount: null, googlePlaceId: null, district: { name: "Kadıköy", slug: "kadikoy" },
    lat: 40.99, lng: 29.02, address: null, photos: [],
  };
  it("accepts the full shape", () => expect(VenueDetailSchema.safeParse(FULL).success).toBe(true));
  it("rejects when lat/lng are missing (proves required, not silently stripped)", () => {
    const { lat, lng, ...rest } = FULL;
    expect(VenueDetailSchema.safeParse(rest).success).toBe(false);
  });
  it("round-trips address/photos (proves captured, not stripped)", () => {
    const parsed = VenueDetailSchema.parse({ ...FULL, address: "Bahariye Cd. No:1", photos: ["p1"] });
    expect(parsed.address).toBe("Bahariye Cd. No:1");
    expect(parsed.photos).toEqual(["p1"]);
  });
});

describe("BboxQuerySchema", () => {
  it("rejects a malformed bbox string", () => expect(BboxQuerySchema.safeParse({ bbox: "not,numbers,here" }).success).toBe(false));
  it("rejects only 3 parts", () => expect(BboxQuerySchema.safeParse({ bbox: "29.0,40.9,29.1" }).success).toBe(false));
  it("rejects an empty leading part instead of treating it as 0 (Number('')===0 footgun)", () => expect(BboxQuerySchema.safeParse({ bbox: ",40.9,29.1,41" }).success).toBe(false));
  it("accepts a well-formed bbox", () => expect(BboxQuerySchema.parse({ bbox: "29.0,40.9,29.1,41.0" }).bbox).toEqual([29.0, 40.9, 29.1, 41.0]));
});
