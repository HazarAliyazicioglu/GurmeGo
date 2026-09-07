import { directionsUrl } from "./directions";

describe("directionsUrl", () => {
  it("builds a Google Maps text-search deep link from venue name and district", () => {
    const url = directionsUrl("Test Cafe", "Kadıköy");
    expect(url).toBe("https://www.google.com/maps/dir/?api=1&destination=Test%20Cafe%20Kad%C4%B1k%C3%B6y");
  });
});
