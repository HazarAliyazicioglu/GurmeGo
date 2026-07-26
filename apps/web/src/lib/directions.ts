// Shared Google Maps text-search deep link builder — extracted from `venue-detail.tsx` so
// `category-quick-route.tsx` (Task 6) can produce the same "Yol tarifi al"-style link from a
// venue name + district name without re-implementing the query-string construction.
//
// `findBySlug` (Plan 1) does not expose lat/lng — only `findInBbox`/the map endpoint does (ADR
// 002: raw SQL is the only way to read the `Unsupported("geography")` column, and the detail
// endpoint deliberately keeps to a standard Prisma `select` for the rest of its fields). Rather
// than adding a raw-SQL branch to the detail endpoint just for this, MVP uses a name+district
// text search — Google Maps resolves this to the correct place reliably at pilot scale (30-45
// known venues). Documented here as a deliberate simplification, not an oversight; revisit if the
// pilot shows mis-resolves.
export function directionsUrl(venueName: string, districtName: string): string {
  const query = encodeURIComponent(`${venueName} ${districtName}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}
