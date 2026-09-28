import { getVenues, reportVenue, ApiValidationError } from "./api";

const originalFetch = globalThis.fetch;

// Web parity audit (2026-09-28): apps/web's reportVenue already supported an optional structured
// correction (field/suggestedValue) since PR #38; mobile's was left at reason-only.
describe("reportVenue", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends only reason when no correction is given", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ urgent: false }) }) as jest.Mock;

    await reportVenue("v1", "spam");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/report"),
      expect.objectContaining({ body: JSON.stringify({ reason: "spam" }) }),
    );
  });

  it("includes field/suggestedValue in the request body when given (structured correction)", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ urgent: false }) }) as jest.Mock;

    await reportVenue("v1", "yanlış", { field: "Fiyat aralığı", suggestedValue: "MID" });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/report"),
      expect.objectContaining({ body: JSON.stringify({ reason: "yanlış", field: "Fiyat aralığı", suggestedValue: "MID" }) }),
    );
  });
});

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
            coverPhoto: null,
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
