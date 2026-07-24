import Link from "next/link";
import type { VenueListItem } from "@/lib/api";

const PRICE_SYMBOLS: Record<VenueListItem["priceRange"], string> = {
  BUDGET: "₺",
  MODERATE: "₺₺",
  EXPENSIVE: "₺₺₺",
  PREMIUM: "₺₺₺₺",
};

// Real backend category values only (`apps/api/prisma/seed.ts` / `VenuesRepository`) — the API
// never returns anything else, so this map is exported and reused wherever a category needs a
// Turkish label instead of each caller inventing its own vocabulary.
export const CATEGORY_LABELS: Record<string, string> = {
  cafe: "Kahve",
  restaurant: "Restoran",
  bakery: "Fırın",
  "street-food": "Sokak lezzeti",
};

// Typed against `VenueListItem` (the real, narrower `GET /venues` response shape — see
// `lib/api.ts`), not `Partial<Venue>`: the API's nullable fields (`editorialNote`, etc.) don't
// match `Venue`'s optional-but-not-nullable fields, which `tsc` correctly rejects.
export function VenueCard({ venue }: { venue: VenueListItem }) {
  return (
    <Link
      href={`/mekan/${venue.slug}`}
      data-testid="venue-card"
      className="group relative block h-full overflow-hidden rounded-[1.4rem] border border-[#201d18]/12 bg-[#faf7f0] p-5 shadow-[0_1px_0_rgba(32,29,24,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#201d18]/25 hover:shadow-[0_14px_36px_rgba(71,52,35,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d75d3b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f0e7] sm:p-6"
    >
      <span
        className="absolute inset-y-0 left-0 w-1 origin-bottom scale-y-0 bg-[#d75d3b] transition-transform duration-300 group-hover:scale-y-100 group-focus-visible:scale-y-100"
        aria-hidden="true"
      />

      <article className="flex h-full min-h-48 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-[0.65rem] font-black uppercase tracking-[0.17em] text-[#9e422b]">
              {CATEGORY_LABELS[venue.category] ?? venue.category.replaceAll("-", " ")}
            </span>
            {venue.isBoutique && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#eadfce] px-2 py-1 text-[0.58rem] font-black uppercase tracking-[0.13em] text-[#75402f]">
                <svg viewBox="0 0 16 16" className="size-3 fill-none" aria-hidden="true">
                  <path d="M8 1.8 9.4 6l4.4 1.1-3.4 2.6.2 4.5L8 11.8l-2.6 2.4.2-4.5-3.4-2.6L6.6 6 8 1.8Z" fill="currentColor" />
                </svg>
                Butik
              </span>
            )}
          </div>

          <span className="shrink-0 font-serif text-sm font-semibold tracking-[0.08em] text-[#201d18]/55" aria-label={`Fiyat aralığı ${PRICE_SYMBOLS[venue.priceRange]}`}>
            {PRICE_SYMBOLS[venue.priceRange]}
          </span>
        </div>

        <h2 className="mt-5 max-w-[18ch] font-serif text-[1.75rem] font-semibold leading-[1.03] tracking-[-0.035em] text-[#201d18] transition-colors duration-200 group-hover:text-[#9e422b] sm:text-[2rem]">
          {venue.name}
        </h2>

        {venue.editorialNote ? (
          <p className="mt-3 line-clamp-2 max-w-[42ch] text-sm font-medium leading-relaxed text-[#201d18]/58">{venue.editorialNote}</p>
        ) : (
          <p className="mt-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#201d18]/35">GurmeGo editör seçkisi</p>
        )}

        <div className="mt-auto flex items-end justify-between gap-4 pt-7">
          {venue.googleRating !== null ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#201d18]/55">
              <svg viewBox="0 0 16 16" className="size-3.5 text-[#d75d3b]" aria-hidden="true">
                <path d="m8 1.4 1.7 4.1 4.4.4-3.4 2.9 1 4.3L8 10.8l-3.7 2.3 1-4.3-3.4-2.9 4.4-.4L8 1.4Z" fill="currentColor" />
              </svg>
              <span>{venue.googleRating.toFixed(1)}</span>
              {venue.googleRatingCount !== null && <span className="font-medium text-[#201d18]/35">({venue.googleRatingCount})</span>}
            </span>
          ) : (
            <span />
          )}

          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-[#201d18]/12 bg-[#f4f0e7] text-[#201d18] transition-all duration-200 group-hover:border-[#d75d3b] group-hover:bg-[#d75d3b] group-hover:text-white" aria-hidden="true">
            <svg viewBox="0 0 20 20" className="size-4 fill-none transition-transform duration-200 group-hover:translate-x-0.5">
              <path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </article>
    </Link>
  );
}