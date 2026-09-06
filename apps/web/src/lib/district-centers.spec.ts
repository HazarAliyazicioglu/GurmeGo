import { describe, it, expect } from "vitest";
import { DISTRICT_CENTERS, DEFAULT_CENTER } from "./district-centers";

describe("DISTRICT_CENTERS", () => {
  it("has entries for the three MVP districts as [lat, lng] tuples", () => {
    expect(DISTRICT_CENTERS.kadikoy).toEqual([40.9906, 29.0274]);
    expect(DISTRICT_CENTERS.besiktas).toEqual([41.0422, 29.0061]);
    expect(DISTRICT_CENTERS.beyoglu).toEqual([41.0370, 28.9850]);
  });
  it("has a numeric default fallback tuple for an unknown slug", () => {
    expect(DEFAULT_CENTER).toHaveLength(2);
  });
});
