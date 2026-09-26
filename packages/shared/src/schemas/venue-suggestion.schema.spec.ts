import { describe, it, expect } from "vitest";
import { SuggestVenueSchema } from "./venue-suggestion.schema";

const valid = {
  name: "Moda Kahvecisi",
  districtSlug: "kadikoy",
  category: "cafe",
  address: "Moda Cd. No:1",
  note: "Harika filtre kahve yapıyorlar",
};

describe("SuggestVenueSchema", () => {
  it("accepts a fully filled submission", () => {
    expect(SuggestVenueSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a submission without the optional address/note", () => {
    const { address: _address, note: _note, ...minimal } = valid;
    expect(SuggestVenueSchema.safeParse(minimal).success).toBe(true);
  });

  it("rejects a name shorter than 2 characters", () => {
    expect(SuggestVenueSchema.safeParse({ ...valid, name: "A" }).success).toBe(false);
  });

  it("rejects a missing districtSlug or category", () => {
    const { districtSlug: _d, ...noDistrict } = valid;
    expect(SuggestVenueSchema.safeParse(noDistrict).success).toBe(false);
    const { category: _c, ...noCategory } = valid;
    expect(SuggestVenueSchema.safeParse(noCategory).success).toBe(false);
  });

  it("rejects a note longer than 500 characters", () => {
    expect(SuggestVenueSchema.safeParse({ ...valid, note: "a".repeat(501) }).success).toBe(false);
  });

  it("trims a name that is only whitespace to empty and rejects it", () => {
    expect(SuggestVenueSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
  });
});
