import { parseUserLocationHeader } from "./user-location.decorator";

describe("parseUserLocationHeader", () => {
  it("parses 'lat,lng'", () => expect(parseUserLocationHeader("40.99,29.02")).toEqual({ lat: 40.99, lng: 29.02 }));
  it("undefined header -> undefined", () => expect(parseUserLocationHeader(undefined)).toBeUndefined());
  it("malformed (empty parts, Number('')===0 footgun) -> undefined", () => {
    expect(parseUserLocationHeader(",")).toBeUndefined();
    expect(parseUserLocationHeader("40.99,")).toBeUndefined();
  });
  it("out-of-range -> undefined", () => expect(parseUserLocationHeader("999,29.02")).toBeUndefined());
});
