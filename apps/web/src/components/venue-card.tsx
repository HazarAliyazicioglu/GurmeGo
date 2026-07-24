import Link from "next/link";
import type { VenueListItem } from "@/lib/api";

// Typed against `VenueListItem` (the real, narrower `GET /venues` response shape — see
// `lib/api.ts`), not `Partial<Venue>`: the API's nullable fields (`editorialNote`, etc.) don't
// match `Venue`'s optional-but-not-nullable fields, which `tsc` correctly rejects.
export function VenueCard({ venue }: { venue: VenueListItem }) {
  return (
    <Link href={`/mekan/${venue.slug}`} data-testid="venue-card">
      <span>{venue.name}</span>
    </Link>
  );
}
