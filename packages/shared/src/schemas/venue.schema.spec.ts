import { describe, it, expect } from "vitest";
import { z } from "zod";
import { VenueSchema, VenueListQuerySchema, OptionalTrueFlag } from "./venue.schema";

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
