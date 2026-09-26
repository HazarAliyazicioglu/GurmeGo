import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock("@gurmego/api-client", () => ({
  createApiClient: () => ({
    get: mockGet,
    post: mockPost,
  }),
}));

import {
  getVenueBySlug,
  getVenues,
  getVenuesInBbox,
  getDistricts,
  getNearestDistrict,
  getFavoriteLists,
  createFavoriteList,
  addFavoriteVenue,
  reportVenue,
  suggestVenue,
  locationHeaders,
  ApiValidationError,
} from "./api";

const VALID_VENUE_DETAIL = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  slug: "kadikoy-kahvecisi",
  name: "Kadıköy Kahvecisi",
  category: "cafe",
  cuisineType: null,
  priceRange: "MODERATE",
  signatureItems: ["Türk kahvesi"],
  transportNote: null,
  openingHours: { mon: "09:00-18:00" },
  editorialNote: null,
  isBoutique: true,
  verifiedAt: "2026-01-01T00:00:00.000Z",
  source: "MANUAL",
  googleRating: 4.5,
  googleRatingCount: 100,
  googlePlaceId: null,
  district: { name: "Kadıköy", slug: "kadikoy" },
  lat: 40.99,
  lng: 29.02,
  address: null,
  photos: [],
};

const VALID_VENUE_LIST_ITEM = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  name: "Kadıköy Kahvecisi",
  slug: "kadikoy-kahvecisi",
  category: "cafe",
  priceRange: "MODERATE",
  isBoutique: true,
  editorialNote: null,
  googleRating: 4.5,
  googleRatingCount: 100,
  coverPhoto: null,
};

const VALID_DISTRICT = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  cityId: "3fa85f64-5717-4562-b3fc-2c963f66afa7",
  name: "Kadıköy",
  slug: "kadikoy",
};

const VALID_FAVORITE_LIST = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  userId: "3fa85f64-5717-4562-b3fc-2c963f66afa7",
  name: "My List",
  createdAt: "2026-01-01T00:00:00.000Z",
  favorites: [
    {
      id: "3fa85f64-5717-4562-b3fc-2c963f66afa8",
      venueId: "3fa85f64-5717-4562-b3fc-2c963f66afa9",
      venue: {
        id: "3fa85f64-5717-4562-b3fc-2c963f66afa9",
        name: "Kadıköy Kahvecisi",
        slug: "kadikoy-kahvecisi",
        category: "cafe",
        priceRange: "MODERATE",
        isBoutique: true,
      },
    },
  ],
};

const VALID_FAVORITE = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa8",
  listId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  venueId: "3fa85f64-5717-4562-b3fc-2c963f66afa9",
  createdAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
});

describe("getVenueBySlug", () => {
  it("throws ApiValidationError when the response doesn't match VenueDetailSchema", async () => {
    mockGet.mockResolvedValue({ id: "not-a-uuid", name: "X" });
    await expect(getVenueBySlug("kadikoy-kahvecisi")).rejects.toThrow(ApiValidationError);
  });

  it("returns parsed data when the response matches VenueDetailSchema", async () => {
    mockGet.mockResolvedValue(VALID_VENUE_DETAIL);
    await expect(getVenueBySlug("kadikoy-kahvecisi")).resolves.toEqual(VALID_VENUE_DETAIL);
  });
});

describe("getVenues", () => {
  it("returns parsed data on a valid list response", async () => {
    mockGet.mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });
    await expect(getVenues({})).resolves.toEqual({ data: [], meta: { next_cursor: null, has_more: false } });
  });

  it("returns parsed data for a valid list item", async () => {
    mockGet.mockResolvedValue({
      data: [VALID_VENUE_LIST_ITEM],
      meta: { next_cursor: null, has_more: false },
    });
    await expect(getVenues({})).resolves.toEqual({
      data: [VALID_VENUE_LIST_ITEM],
      meta: { next_cursor: null, has_more: false },
    });
  });

  it("throws ApiValidationError on an invalid list response", async () => {
    mockGet.mockResolvedValue({ data: "not-an-array" });
    await expect(getVenues({})).rejects.toThrow(ApiValidationError);
  });

  it("throws ApiValidationError when a list item is missing a required field (id)", async () => {
    const { id: _id, ...itemMissingId } = VALID_VENUE_LIST_ITEM;
    mockGet.mockResolvedValue({
      data: [itemMissingId],
      meta: { next_cursor: null, has_more: false },
    });
    await expect(getVenues({})).rejects.toThrow(ApiValidationError);
  });
});

describe("getVenuesInBbox", () => {
  const VALID_MAP_VENUE = {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    name: "Kadıköy Kahvecisi",
    category: "cafe",
    lat: 40.99,
    lng: 29.03,
  };

  it("returns parsed data on a valid response", async () => {
    mockGet.mockResolvedValue([VALID_MAP_VENUE]);
    await expect(getVenuesInBbox([29.0, 40.9, 29.1, 41.0])).resolves.toEqual([VALID_MAP_VENUE]);
  });

  it("throws ApiValidationError on an invalid response", async () => {
    mockGet.mockResolvedValue([{ id: "not-a-uuid" }]);
    await expect(getVenuesInBbox([29.0, 40.9, 29.1, 41.0])).rejects.toThrow(ApiValidationError);
  });
});

describe("getDistricts", () => {
  it("returns parsed data on a valid response", async () => {
    mockGet.mockResolvedValue([VALID_DISTRICT]);
    await expect(getDistricts()).resolves.toEqual([VALID_DISTRICT]);
  });

  it("throws ApiValidationError on an invalid response", async () => {
    mockGet.mockResolvedValue([{ id: "not-a-uuid" }]);
    await expect(getDistricts()).rejects.toThrow(ApiValidationError);
  });
});

describe("getNearestDistrict", () => {
  it("returns parsed data on a valid response", async () => {
    mockGet.mockResolvedValue(VALID_DISTRICT);
    await expect(getNearestDistrict({ lat: 40.99, lng: 29.03 })).resolves.toEqual(VALID_DISTRICT);
  });

  it("throws ApiValidationError on an invalid response", async () => {
    mockGet.mockResolvedValue({ id: "not-a-uuid" });
    await expect(getNearestDistrict({ lat: 40.99, lng: 29.03 })).rejects.toThrow(ApiValidationError);
  });
});

describe("locationHeaders", () => {
  it("returns X-User-Location when coords provided", () => {
    expect(locationHeaders({ lat: 40.99, lng: 29.02 })).toEqual({ "X-User-Location": "40.99,29.02" });
  });
  it("returns an empty object when coords is null/undefined", () => {
    expect(locationHeaders(null)).toEqual({});
    expect(locationHeaders(undefined)).toEqual({});
  });
});

describe("getVenues — new optional coords parameter sends a location header", () => {
  it("sends the exact X-User-Location header derived from coords", async () => {
    mockGet.mockResolvedValueOnce({ data: [], meta: { next_cursor: null, has_more: false } });
    await getVenues({ districtId: "d1" }, { lat: 40.99, lng: 29.02 });
    expect(mockGet.mock.calls[0][1]).toEqual({ headers: { "X-User-Location": "40.99,29.02" }, next: { revalidate: 60 } });
  });

  it("sends no location header when coords is omitted", async () => {
    mockGet.mockResolvedValueOnce({ data: [], meta: { next_cursor: null, has_more: false } });
    await getVenues({ districtId: "d1" });
    expect(mockGet.mock.calls[0][1]).toEqual({ headers: {}, next: { revalidate: 60 } });
  });
});

describe("getNearestDistrict — now takes one coords object instead of two number arguments", () => {
  it("sends the exact X-User-Location header, no lat/lng query params", async () => {
    mockGet.mockResolvedValueOnce(VALID_DISTRICT);
    await getNearestDistrict({ lat: 40.99, lng: 29.02 });
    const [pathArg, optionsArg] = mockGet.mock.calls[0];
    expect(pathArg).toBe("/districts/nearest");
    expect(optionsArg).toEqual({ headers: { "X-User-Location": "40.99,29.02" } });
  });
});

describe("getFavoriteLists", () => {
  it("returns parsed data on a valid response", async () => {
    mockGet.mockResolvedValue([VALID_FAVORITE_LIST]);
    await expect(getFavoriteLists("token")).resolves.toEqual([VALID_FAVORITE_LIST]);
  });

  it("throws ApiValidationError on an invalid response", async () => {
    mockGet.mockResolvedValue([{ id: "not-a-uuid" }]);
    await expect(getFavoriteLists("token")).rejects.toThrow(ApiValidationError);
  });
});

describe("createFavoriteList", () => {
  it("returns parsed data on a valid response", async () => {
    mockPost.mockResolvedValue(VALID_FAVORITE_LIST);
    await expect(createFavoriteList("token", "My List")).resolves.toEqual(VALID_FAVORITE_LIST);
  });

  it("throws ApiValidationError on an invalid response", async () => {
    mockPost.mockResolvedValue({ id: "not-a-uuid" });
    await expect(createFavoriteList("token", "My List")).rejects.toThrow(ApiValidationError);
  });
});

describe("addFavoriteVenue", () => {
  it("resolves without throwing on a valid response", async () => {
    mockPost.mockResolvedValue(VALID_FAVORITE);
    await expect(addFavoriteVenue("token", "list1", "venue1")).resolves.toBeUndefined();
  });

  it("throws ApiValidationError on an invalid response", async () => {
    mockPost.mockResolvedValue({ id: "not-a-uuid" });
    await expect(addFavoriteVenue("token", "list1", "venue1")).rejects.toThrow(ApiValidationError);
  });
});

describe("reportVenue", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns parsed data on a valid response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ urgent: true }),
    }) as unknown as typeof fetch;
    await expect(reportVenue("3fa85f64-5717-4562-b3fc-2c963f66afa6", "spam")).resolves.toEqual({
      urgent: true,
    });
  });

  it("throws ApiValidationError on an invalid response shape", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ urgent: "yes" }),
    }) as unknown as typeof fetch;
    await expect(reportVenue("3fa85f64-5717-4562-b3fc-2c963f66afa6", "spam")).rejects.toThrow(
      ApiValidationError,
    );
  });

  it("throws a plain Error when the HTTP response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as unknown as typeof fetch;
    await expect(reportVenue("3fa85f64-5717-4562-b3fc-2c963f66afa6", "spam")).rejects.toThrow(
      "Report failed: 500",
    );
  });
});

describe("suggestVenue", () => {
  const originalFetch = global.fetch;
  const SUBMISSION = { name: "Moda Kahvecisi", districtSlug: "kadikoy", category: "cafe" };

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("posts the submission and returns the parsed response on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }) as unknown as typeof fetch;
    await expect(suggestVenue(SUBMISSION)).resolves.toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/venue-suggestions"),
      expect.objectContaining({ method: "POST", body: JSON.stringify(SUBMISSION) }),
    );
  });

  it("throws ApiValidationError on an invalid response shape", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: false }) }) as unknown as typeof fetch;
    await expect(suggestVenue(SUBMISSION)).rejects.toThrow(ApiValidationError);
  });

  it("throws a plain Error when the HTTP response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch;
    await expect(suggestVenue(SUBMISSION)).rejects.toThrow("Suggestion failed: 429");
  });
});

// Next 15+ stopped caching bare fetch(); the server-rendered list/district reads opt back into a short
// TTL so a busy page doesn't send every view to the API (see DISTRICTS_REVALIDATE_S in api.ts).
describe("server-rendered reads opt into a Next.js data-cache TTL", () => {
  beforeEach(() => mockGet.mockReset());

  it("getDistricts asks the data cache to revalidate every 300s", async () => {
    mockGet.mockResolvedValue([]);
    await getDistricts();
    expect(mockGet).toHaveBeenCalledWith("/districts?city=istanbul", expect.objectContaining({ next: { revalidate: 300 } }));
  });

  it("getVenues asks the data cache to revalidate every 60s", async () => {
    mockGet.mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });
    await getVenues({ districtId: "d1" });
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining("/venues?"),
      expect.objectContaining({ next: { revalidate: 60 } }),
    );
  });

  it("does not add a TTL to per-user or venue-detail reads", async () => {
    mockGet.mockResolvedValue([]);
    await getFavoriteLists("tok");
    expect(mockGet.mock.calls[0][1]).not.toHaveProperty("next");
  });
});
