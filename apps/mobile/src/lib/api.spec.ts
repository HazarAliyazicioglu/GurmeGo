import { getVenues, getVenuesInBbox, getAllVenues, ApiValidationError } from "./api";

const originalFetch = globalThis.fetch;

describe("getVenues", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns validated venue list data on a well-formed response", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "550e8400-e29b-41d4-a716-446655440000",
            name: "Test Cafe",
            slug: "test-cafe",
            category: "cafe",
            priceRange: "MODERATE",
            isBoutique: true,
            editorialNote: null,
            googleRating: null,
            googleRatingCount: null,
          },
        ],
        meta: { next_cursor: null, has_more: false },
      }),
    }) as jest.Mock;

    const result = await getVenues({ districtId: "550e8400-e29b-41d4-a716-446655440001" });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe("Test Cafe");
  });

  it("sends an X-User-Location header when coords are given", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], meta: { next_cursor: null, has_more: false } }),
    }) as jest.Mock;

    await getVenues({}, { lat: 40.99, lng: 29.02 });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ "X-User-Location": "40.99,29.02" }) }),
    );
  });

  it("throws ApiValidationError when the response does not match the schema", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "not-a-uuid" }], meta: { next_cursor: null, has_more: false } }),
    }) as jest.Mock;

    await expect(getVenues({})).rejects.toThrow(ApiValidationError);
  });
});

describe("getAllVenues", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function venue(id: string, name: string) {
    return {
      id, name, slug: name.toLowerCase(), category: "cafe", priceRange: "MODERATE",
      isBoutique: true, editorialNote: null, googleRating: null, googleRatingCount: null,
    };
  }

  it("pages through cursor-paginated results and returns every venue in one flat list", async () => {
    const ID1 = "550e8400-e29b-41d4-a716-446655440001";
    const ID2 = "550e8400-e29b-41d4-a716-446655440002";
    const page1 = { data: [venue(ID1, "Cafe1")], meta: { next_cursor: "c1", has_more: true } };
    const page2 = { data: [venue(ID2, "Cafe2")], meta: { next_cursor: null, has_more: false } };
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => page1 })
      .mockResolvedValueOnce({ ok: true, json: async () => page2 }) as jest.Mock;

    const result = await getAllVenues();

    expect(result.map((v) => v.id)).toEqual([ID1, ID2]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    const secondCallUrl = (globalThis.fetch as jest.Mock).mock.calls[1][0] as string;
    expect(secondCallUrl).toContain("cursor=c1");
  });

  it("returns an empty list without throwing when the first page is empty", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], meta: { next_cursor: null, has_more: false } }),
    }) as jest.Mock;

    const result = await getAllVenues();

    expect(result).toEqual([]);
  });
});

describe("getVenuesInBbox", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("requests /venues/map with the bbox joined as a query param and returns the parsed list", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "550e8400-e29b-41d4-a716-446655440000", name: "Test Cafe", category: "cafe", lat: 40.99, lng: 29.02 },
      ],
    }) as jest.Mock;

    const result = await getVenuesInBbox([29.0, 40.9, 29.1, 41.0]);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/venues/map?bbox=29,40.9,29.1,41"),
      expect.any(Object),
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Test Cafe");
  });

  it("throws ApiValidationError when the response does not match the schema", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "not-a-uuid" }],
    }) as jest.Mock;

    await expect(getVenuesInBbox([29.0, 40.9, 29.1, 41.0])).rejects.toThrow(ApiValidationError);
  });
});
