import { describe, it, expect, vi, beforeEach } from "vitest";
import { notFound } from "next/navigation";
import type { VenueDetail as VenueDetailType } from "@gurmego/shared";
import { ApiHttpError } from "@gurmego/api-client";
import { getVenueBySlug } from "@/lib/api";
import VenueDetailPage, { generateStaticParams, generateMetadata } from "./page";

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
      VenueDetailPage({ params: Promise.resolve({ slug: "missing-venue" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalled();
  });

  it("calls notFound() when getVenueBySlug rejects with a genuine 404 ApiHttpError", async () => {
    vi.mocked(getVenueBySlug).mockRejectedValue(new ApiHttpError(404, "Not Found"));

    await expect(
      VenueDetailPage({ params: Promise.resolve({ slug: "missing-venue" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalled();
  });

  it("propagates a non-404 ApiHttpError (e.g. 500) instead of rendering not-found", async () => {
    const serverError = new ApiHttpError(500, "Internal Server Error");
    vi.mocked(getVenueBySlug).mockRejectedValue(serverError);

    await expect(
      VenueDetailPage({ params: Promise.resolve({ slug: "kadikoy-kahvecisi" }) }),
    ).rejects.toBe(serverError);

    expect(notFound).not.toHaveBeenCalled();
  });

  it("propagates a plain network error instead of rendering not-found", async () => {
    const networkError = new Error("fetch failed");
    vi.mocked(getVenueBySlug).mockRejectedValue(networkError);

    await expect(
      VenueDetailPage({ params: Promise.resolve({ slug: "kadikoy-kahvecisi" }) }),
    ).rejects.toBe(networkError);

    expect(notFound).not.toHaveBeenCalled();
  });

  it("renders VenueDetail with the fetched venue and does not call notFound()", async () => {
    vi.mocked(getVenueBySlug).mockResolvedValue(venue as never);

    const result = await VenueDetailPage({ params: Promise.resolve({ slug: "test-cafe" }) });

    expect(getVenueBySlug).toHaveBeenCalledWith("test-cafe");
    expect(notFound).not.toHaveBeenCalled();
    // The page now returns a fragment (<script type="application/ld+json"> + <VenueDetail>) --
    // the VenueDetail element is the fragment's second child.
    const children = result.props.children as unknown[];
    const venueDetailElement = children[1] as { props: { venue: unknown } };
    expect(venueDetailElement.props.venue).toEqual(venue);
  });
});

// 2026-09-25 audit finding: no JSON-LD structured data anywhere -- Google rich results (star
// rating, price, address) never render for a venue link.
describe("venue detail page JSON-LD", () => {
  it("renders a script[type=application/ld+json] with the venue's structured data", async () => {
    vi.mocked(getVenueBySlug).mockResolvedValue(venue as never);

    const result = await VenueDetailPage({ params: Promise.resolve({ slug: "test-cafe" }) });
    const children = result.props.children as unknown[];
    const scriptElement = children[0] as { type: string; props: { type: string; dangerouslySetInnerHTML: { __html: string } } };

    expect(scriptElement.type).toBe("script");
    expect(scriptElement.props.type).toBe("application/ld+json");
    const parsed = JSON.parse(scriptElement.props.dangerouslySetInnerHTML.__html);
    expect(parsed).toMatchObject({ "@context": "https://schema.org", "@type": "Restaurant", name: "Test Cafe" });
  });
});

// §W1 audit finding: every venue page shared the root layout's generic title/description, so
// Google and share-card previews showed "GurmeGo — İstanbul'un butik mekan rehberi" for every
// single venue instead of that venue's own name/district.
describe("venue detail page metadata", () => {
  it("titles the page with the venue's name and district", async () => {
    vi.mocked(getVenueBySlug).mockResolvedValue(venue as never);

    const meta = await generateMetadata({ params: Promise.resolve({ slug: "test-cafe" }) });
    expect(getVenueBySlug).toHaveBeenCalledWith("test-cafe");

    expect(meta.title).toBe("Test Cafe — Kadıköy | GurmeGo");
  });

  it("uses the venue's editorial note as the description when present", async () => {
    vi.mocked(getVenueBySlug).mockResolvedValue(
      { ...venue, editorialNote: "Sessiz, çalışmaya uygun, gerçek filtre kahve." } as never,
    );

    const meta = await generateMetadata({ params: Promise.resolve({ slug: "test-cafe" }) });

    expect(meta.description).toBe("Sessiz, çalışmaya uygun, gerçek filtre kahve.");
  });

  it("falls back to a generic description when there is no editorial note", async () => {
    vi.mocked(getVenueBySlug).mockResolvedValue({ ...venue, editorialNote: null } as never);

    const meta = await generateMetadata({ params: Promise.resolve({ slug: "test-cafe" }) });

    expect(meta.description).toBe("Kadıköy'de GurmeGo tarafından kürasyonlu bir mekan: Test Cafe.");
  });

  it("uses the venue's first photo as the Open Graph image when present", async () => {
    vi.mocked(getVenueBySlug).mockResolvedValue(
      { ...venue, photos: ["https://cdn.example.com/p1.jpg", "https://cdn.example.com/p2.jpg"] } as never,
    );

    const meta = await generateMetadata({ params: Promise.resolve({ slug: "test-cafe" }) });

    expect(meta.openGraph?.images).toEqual(["https://cdn.example.com/p1.jpg"]);
  });

  it("omits the Open Graph image field when the venue has no photos", async () => {
    vi.mocked(getVenueBySlug).mockResolvedValue({ ...venue, photos: [] } as never);

    const meta = await generateMetadata({ params: Promise.resolve({ slug: "test-cafe" }) });

    expect(meta.openGraph?.images).toBeUndefined();
  });

  it("returns empty metadata when the venue can't be found, letting Next.js inherit the root layout's generic title/description instead of overriding with something wrong", async () => {
    vi.mocked(getVenueBySlug).mockResolvedValue(null as never);

    const meta = await generateMetadata({ params: Promise.resolve({ slug: "missing-venue" }) });

    expect(meta).toEqual({});
  });

  it("returns empty metadata (same fallback) when the venue lookup itself throws", async () => {
    vi.mocked(getVenueBySlug).mockRejectedValue(new Error("fetch failed"));

    const meta = await generateMetadata({ params: Promise.resolve({ slug: "test-cafe" }) });

    expect(meta).toEqual({});
  });
});
