import { describe, it, expect } from "vitest";
import { directionsUrl } from "./directions";

describe("directionsUrl", () => {
  it("builds a Google Maps text-search deep link from name + district", () => {
    expect(directionsUrl("Cafe Test", "Kadıköy")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent("Cafe Test Kadıköy"),
    );
  });
});
