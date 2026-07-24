import type { VenueDetail as VenueDetailType } from "@gurmego/shared";
import { PRICE_RANGE_LABELS } from "@gurmego/shared";

// `findBySlug` (Plan 1) does not expose lat/lng — only `findInBbox`/the map endpoint does (ADR 002:
// raw SQL is the only way to read the `Unsupported("geography")` column, and the detail endpoint
// deliberately keeps to a standard Prisma `select` for the rest of its fields). Rather than adding a
// raw-SQL branch to the detail endpoint just for this, MVP uses a name+district text search — Google
// Maps resolves this to the correct place reliably at pilot scale (30-45 known venues). Documented
// here as a deliberate simplification, not an oversight; revisit if the pilot shows mis-resolves.
function directionsUrl(venue: VenueDetailType): string {
  const query = encodeURIComponent(`${venue.name} ${venue.district.name}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}

function whatsappShareUrl(venue: VenueDetailType): string {
  const text = encodeURIComponent(`${venue.name} — GurmeGo'da keşfet: ${window.location.href}`);
  return `https://wa.me/?text=${text}`;
}

export function VenueDetail({ venue }: { venue: VenueDetailType }) {
  return (
    <article data-testid="venue-detail">
      <h1>{venue.name}</h1>
      <p data-testid="district-name">{venue.district.name}</p>
      <p data-testid="price-range">{PRICE_RANGE_LABELS[venue.priceRange]}</p>
      {venue.editorialNote && <p data-testid="editorial-note">{venue.editorialNote}</p>}
      {venue.transportNote && <p data-testid="transport-note">{venue.transportNote}</p>}
      <ul data-testid="signature-items">
        {venue.signatureItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p data-testid="opening-hours">
        {Object.entries(venue.openingHours).map(([day, hours]) => `${day}: ${hours}`).join(" · ")}
      </p>
      <p data-testid="verified-at">Son doğrulama: {new Date(venue.verifiedAt).toLocaleDateString("tr-TR")}</p>
      {venue.googleRating && (
        <a data-testid="google-rating" href={`https://maps.google.com/?q=${encodeURIComponent(venue.name)}`} target="_blank" rel="noreferrer">
          {venue.googleRating}★ · {venue.googleRatingCount} Google yorumu
        </a>
      )}
      <a data-testid="directions-link" href={directionsUrl(venue)} target="_blank" rel="noreferrer">
        Yol tarifi al
      </a>
      <a data-testid="whatsapp-share" href={whatsappShareUrl(venue)} target="_blank" rel="noreferrer">
        WhatsApp'ta paylaş
      </a>
      {/* Mini-map, report form — composed in by Tasks 5/7/9's components and Codex's visual pass */}
    </article>
  );
}
