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
  getDistricts,
  getNearestDistrict,
  getFavoriteLists,
  createFavoriteList,
  reportVenue,
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
    await expect(getNearestDistrict(40.99, 29.03)).resolves.toEqual(VALID_DISTRICT);
  });

  it("throws ApiValidationError on an invalid response", async () => {
    mockGet.mockResolvedValue({ id: "not-a-uuid" });
    await expect(getNearestDistrict(40.99, 29.03)).rejects.toThrow(ApiValidationError);
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
