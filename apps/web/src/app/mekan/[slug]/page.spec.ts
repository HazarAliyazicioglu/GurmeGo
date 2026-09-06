import { describe, it, expect, vi, beforeEach } from "vitest";
import { notFound } from "next/navigation";
import type { VenueDetail as VenueDetailType } from "@gurmego/shared";
import { ApiHttpError } from "@gurmego/api-client";
import { getVenueBySlug } from "@/lib/api";
import VenueDetailPage, { generateStaticParams } from "./page";

vi.mock("@/lib/api", () => ({
  getVenueBySlug: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: null, session: null, loading: false }),
}));

const venue: VenueDetailType = {
  id: "v1", slug: "test-cafe", name: "Test Cafe", category: "cafe", cuisineType: null,
  priceRange: "MODERATE", signatureItems: ["Latte"], transportNote: null,
  openingHours: { mon: "09:00-18:00" }, editorialNote: null, isBoutique: true,
  verifiedAt: "2026-01-01T00:00:00.000Z", source: "MANUAL",
  googleRating: null, googleRatingCount: null, googlePlaceId: null,
  district: { name: "Kadıköy", slug: "kadikoy" },
  lat: 40.99, lng: 29.02, address: null, photos: [],
};

describe("venue detail page", () => {
  beforeEach(() => {
    vi.mocked(notFound).mockClear();
  });

  it("generateStaticParams is exported for SSG", () => {
    expect(typeof generateStaticParams).toBe("function");
  });

  it("calls notFound() when getVenueBySlug resolves to null", async () => {
    vi.mocked(getVenueBySlug).mockResolvedValue(null as never);

    await expect(
      VenueDetailPage({ params: { slug: "missing-venue" } }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalled();
  });

  it("calls notFound() when getVenueBySlug rejects with a genuine 404 ApiHttpError", async () => {
    vi.mocked(getVenueBySlug).mockRejectedValue(new ApiHttpError(404, "Not Found"));

    await expect(
      VenueDetailPage({ params: { slug: "missing-venue" } }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalled();
  });

  it("propagates a non-404 ApiHttpError (e.g. 500) instead of rendering not-found", async () => {
    const serverError = new ApiHttpError(500, "Internal Server Error");
    vi.mocked(getVenueBySlug).mockRejectedValue(serverError);

    await expect(
      VenueDetailPage({ params: { slug: "kadikoy-kahvecisi" } }),
    ).rejects.toBe(serverError);

    expect(notFound).not.toHaveBeenCalled();
  });

  it("propagates a plain network error instead of rendering not-found", async () => {
    const networkError = new Error("fetch failed");
    vi.mocked(getVenueBySlug).mockRejectedValue(networkError);

    await expect(
      VenueDetailPage({ params: { slug: "kadikoy-kahvecisi" } }),
    ).rejects.toBe(networkError);

    expect(notFound).not.toHaveBeenCalled();
  });

  it("renders VenueDetail with the fetched venue and does not call notFound()", async () => {
    vi.mocked(getVenueBySlug).mockResolvedValue(venue as never);

    const result = await VenueDetailPage({ params: { slug: "test-cafe" } });

    expect(notFound).not.toHaveBeenCalled();
    expect(result.type).toBeDefined();
    expect(result.props.venue).toEqual(venue);
  });
});
