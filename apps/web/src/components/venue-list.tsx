import { VenueCard } from "./venue-card";
import type { VenueListItem } from "@/lib/api";

export function VenueList({ venues }: { venues: VenueListItem[] }) {
  if (venues.length === 0) return <p data-testid="empty-state">Bu filtrelerle mekan bulunamadı.</p>;
  return (
    <div data-testid="venue-list">
      {venues.map((v) => (
        <VenueCard key={v.id} venue={v} />
      ))}
    </div>
  );
}
