import { describe, it, expect } from "vitest";
import { serializeFilters } from "./venue-filters";

describe("serializeFilters", () => {
  it("omits unset filters and includes set ones as query params", () => {
    const result = serializeFilters({ category: "cafe", priceRange: undefined, isBoutique: true, radiusM: undefined });
    expect(result).toEqual({ category: "cafe", isBoutique: "true" });
  });

  it("only includes radiusM when both radiusM and coordinates are present (distance filtering needs lat/lng too)", () => {
    const result = serializeFilters({ radiusM: 1500 }, { lat: 40.99, lng: 29.02 });
    expect(result).toEqual({ radiusM: "1500", lat: "40.99", lng: "29.02" });
  });

  it("omits radiusM when coordinates are unavailable — server ignores radiusM without lat/lng anyway", () => {
    const result = serializeFilters({ radiusM: 1500 }, null);
    expect(result).toEqual({});
  });
});
