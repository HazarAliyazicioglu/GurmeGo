import type { VenueDetail } from "@gurmego/shared";

const PRICE_RANGE_SYMBOLS: Record<VenueDetail["priceRange"], string> = {
  BUDGET: "₺",
  MODERATE: "₺₺",
  EXPENSIVE: "₺₺₺",
  PREMIUM: "₺₺₺₺",
};

// schema.org Restaurant covers Google's rich-result eligibility for the food-establishment
// categories this catalog actually has (cafe/restaurant/bakery/street-food) -- mapping each
// `category` to a more specific subtype (CafeOrCoffeeShop, Bakery, ...) is possible but adds
// mapping surface for uncertain SEO benefit at MVP scale; revisit if Google Search Console shows
// a rich-result eligibility gap for a specific category.
export function buildVenueJsonLd(venue: VenueDetail, url: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: venue.name,
    url,
    ...(venue.cuisineType ? { servesCuisine: venue.cuisineType } : {}),
    priceRange: PRICE_RANGE_SYMBOLS[venue.priceRange],
    ...(venue.photos[0] ? { image: venue.photos[0] } : {}),
    geo: { "@type": "GeoCoordinates", latitude: venue.lat, longitude: venue.lng },
    ...(venue.address
      ? { address: { "@type": "PostalAddress", streetAddress: venue.address, addressLocality: venue.district.name, addressCountry: "TR" } }
      : {}),
    // Never fabricated: both googleRating AND googleRatingCount must be present. schema.org's
    // AggregateRating requires a review count alongside the value -- presenting one without the
    // other would be a claim we can't back.
    ...(venue.googleRating !== null && venue.googleRatingCount !== null
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: venue.googleRating, reviewCount: venue.googleRatingCount } }
      : {}),
  };
}

// `JSON.stringify` does not escape `<`, so a curator-controlled string (venue name, editorial
// note) containing `</script>` could close the surrounding <script type="application/ld+json">
// tag early and inject arbitrary markup -- the standard JSON-LD-in-React XSS vector. Escaping `<`
// to its unicode form keeps the JSON valid (browsers/parsers un-escape `<` transparently)
// while making a tag-close sequence impossible to form in the rendered HTML.
export function toSafeJsonLdString(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
