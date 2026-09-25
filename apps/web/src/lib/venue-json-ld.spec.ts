import { describe, it, expect } from "vitest";
import { buildVenueJsonLd, toSafeJsonLdString } from "./venue-json-ld";
import type { VenueDetail } from "@gurmego/shared";

// 2026-09-25 audit finding: no JSON-LD structured data anywhere -- Google rich results (star
// rating, price, address) never show up for a GurmeGo venue link, unlike the reference products
// (Michelin/TripAdvisor/Yelp) this project's vizyonunda cited.
const BASE_VENUE: VenueDetail = {
  id: "d290f1ee-6c54-4b01-90e6-d701748f0851",
  slug: "kadikoy-kahvecisi",
  name: "Kadıköy Kahvecisi",
  category: "cafe",
  cuisineType: "türk",
  priceRange: "MODERATE",
  signatureItems: ["filtre kahve"],
  transportNote: "Kadıköy iskelesinden 5 dk",
  openingHours: {},
  editorialNote: "Sessiz, çalışmaya uygun.",
  isBoutique: true,
  verifiedAt: "2026-07-24T00:00:00.000Z",
  source: "MANUAL",
  googleRating: 4.6,
  googleRatingCount: 312,
  googlePlaceId: null,
  district: { name: "Kadıköy", slug: "kadikoy" },
  lat: 40.99,
  lng: 29.02,
  address: "Moda Cd. No:1",
  photos: ["https://cdn.example.com/1.jpg"],
};

describe("buildVenueJsonLd", () => {
  it("builds a Restaurant JSON-LD object with the core fields", () => {
    const jsonLd = buildVenueJsonLd(BASE_VENUE, "https://gurmego.com/mekan/kadikoy-kahvecisi");
    expect(jsonLd).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Restaurant",
      name: "Kadıköy Kahvecisi",
      servesCuisine: "türk",
      priceRange: "₺₺",
      url: "https://gurmego.com/mekan/kadikoy-kahvecisi",
      image: "https://cdn.example.com/1.jpg",
      geo: { "@type": "GeoCoordinates", latitude: 40.99, longitude: 29.02 },
      address: { "@type": "PostalAddress", streetAddress: "Moda Cd. No:1", addressLocality: "Kadıköy", addressCountry: "TR" },
      aggregateRating: { "@type": "AggregateRating", ratingValue: 4.6, reviewCount: 312 },
    });
  });

  it("omits address when the venue has none", () => {
    const jsonLd = buildVenueJsonLd({ ...BASE_VENUE, address: null }, "https://gurmego.com/mekan/x");
    expect(jsonLd.address).toBeUndefined();
  });

  it("omits image when the venue has no photos", () => {
    const jsonLd = buildVenueJsonLd({ ...BASE_VENUE, photos: [] }, "https://gurmego.com/mekan/x");
    expect(jsonLd.image).toBeUndefined();
  });

  it("omits aggregateRating when googleRating is null (never fabricates a rating)", () => {
    const jsonLd = buildVenueJsonLd({ ...BASE_VENUE, googleRating: null }, "https://gurmego.com/mekan/x");
    expect(jsonLd.aggregateRating).toBeUndefined();
  });

  it("omits aggregateRating when googleRatingCount is null even if googleRating is set (schema.org requires both)", () => {
    const jsonLd = buildVenueJsonLd({ ...BASE_VENUE, googleRatingCount: null }, "https://gurmego.com/mekan/x");
    expect(jsonLd.aggregateRating).toBeUndefined();
  });

  it("omits servesCuisine when cuisineType is null", () => {
    const jsonLd = buildVenueJsonLd({ ...BASE_VENUE, cuisineType: null }, "https://gurmego.com/mekan/x");
    expect(jsonLd.servesCuisine).toBeUndefined();
  });
});

describe("toSafeJsonLdString", () => {
  // The standard JSON-LD/React XSS vector: JSON.stringify does not escape `<`, so a curator-
  // controlled string containing `</script><script>...` inside e.g. editorialNote-derived data
  // could break out of the <script type="application/ld+json"> tag if injected raw.
  it("escapes '<' so a value cannot close the surrounding <script> tag", () => {
    const unsafe = { name: '</script><script>alert(1)</script>' };
    const result = toSafeJsonLdString(unsafe);
    expect(result).not.toContain("</script>");
    expect(result).toContain("\\u003c/script>");
  });

  it("still round-trips as valid JSON after escaping", () => {
    const original = { a: "<b>", n: 1 };
    const escaped = toSafeJsonLdString(original);
    expect(JSON.parse(escaped.replace(/\\u003c/g, "<"))).toEqual(original);
  });
});
