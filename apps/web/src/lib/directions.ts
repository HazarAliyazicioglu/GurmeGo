// Shared Google Maps text-search deep link builder — extracted from `venue-detail.tsx` so
// `category-quick-route.tsx` (Task 6) can produce the same "Yol tarifi al"-style link from a
// venue name + district name without re-implementing the query-string construction.
//
// Uses a name+district text search rather than lat/lng coordinates -- Google Maps resolves this
// to the correct place reliably at pilot scale (30-45 known venues). `VenueDetail` does have real
// lat/lng (Plan 4b), used elsewhere for the single-marker map, but this deep link intentionally
// stays text-based since it already works and a coordinate-based query wouldn't improve pilot-scale
// accuracy. Documented here as a deliberate choice, not an oversight; revisit if the pilot shows
// mis-resolves.
export function directionsUrl(venueName: string, districtName: string): string {
  const query = encodeURIComponent(`${venueName} ${districtName}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}
