"use client";
import { CATEGORY_LABELS } from "@/lib/category-labels";
import { directionsUrl } from "@/lib/directions";
import type { VenueListItem } from "@/lib/api";

// Real backend category values only — the API's `category` field is one of
// "cafe" | "restaurant" | "bakery" | "street-food" (see `apps/api/prisma/seed.ts`,
// `venue-card.tsx`'s `CATEGORY_LABELS`). There is no "breakfast"/"kahvaltı" category in the real
// taxonomy, so it's dropped rather than invented (final-review Finding 2 — the old
// "kahve"/"tatli"/"kahvalti" values never matched any real venue, so every quick-route button
// silently returned zero results).
const QUICK_CATEGORIES = ["cafe", "bakery", "restaurant"] as const;

// Selection is lifted to the parent (`DiscoveryClient`) instead of this component doing its own
// `getVenues` call: it now merges into the SAME `FilterState` that `VenueFilters` manages, so an
// active "Butik" toggle (or any other filter) composes with the quick-category pick rather than
// being silently discarded (final-review Finding 3).
export function CategoryQuickRoute({
  activeCategory,
  venues,
  districtName,
  sortedByDistance,
  onSelectCategory,
}: {
  activeCategory?: string;
  venues: VenueListItem[];
  districtName: string;
  sortedByDistance: boolean;
  onSelectCategory: (category: string | undefined) => void;
}) {
  // The one venue (if any) driving the "go to the nearest {category} venue" directions link below
  // — first match is good enough at pilot scale/list ordering; when `sortedByDistance` is true
  // this list is already coords-sorted (Task 4/`DiscoveryClient`'s auto-sort effect), so "first"
  // genuinely means "nearest".
  const activeVenue = activeCategory ? venues.find((v) => v.category === activeCategory) : undefined;

  return (
    <div data-testid="category-quick-route" className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-4 px-1">
        <div>
          <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-terracotta">Hızlı rota</p>
          <h2 className="mt-1 font-serif text-xl font-semibold tracking-[-0.025em]">Bugün neyin peşindesin?</h2>
        </div>
        <svg viewBox="0 0 28 28" className="size-7 shrink-0 text-ink/18" aria-hidden="true">
          <path d="M5 22c2-7 5-11 9-11 3.5 0 4 4 7 4 1.2 0 2-.6 2-2 0-2-2-4-5-4M5 22l2-5m-2 5 5-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK_CATEGORIES.map((c, index) => {
          const isActive = activeCategory === c;

          return (
            <button
              key={c}
              data-testid={`quick-category-${c}`}
              aria-pressed={isActive}
              onClick={() => onSelectCategory(isActive ? undefined : c)}
              className={[
                "group relative min-h-[4.75rem] min-w-[9rem] flex-1 overflow-hidden rounded-[1.15rem] border px-4 py-3 text-left transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
                isActive
                  ? "border-ink bg-ink text-cream shadow-[0_8px_22px_rgba(32,29,24,0.15)]"
                  : "border-ink/12 bg-sand/65 text-ink hover:border-ink/30 hover:bg-sand",
              ].join(" ")}
            >
              <span className={["absolute right-3 top-2 font-serif text-3xl font-semibold italic transition-colors", isActive ? "text-terracottaLight/55" : "text-terracotta/20"].join(" ")} aria-hidden="true">
                0{index + 1}
              </span>
              <span className={["block text-[0.58rem] font-black uppercase tracking-[0.15em]", isActive ? "text-terracottaLight" : "text-terracottaDeep"].join(" ")}>Rota</span>
              <span className="mt-2 block font-serif text-lg font-semibold tracking-[-0.02em]">{CATEGORY_LABELS[c]}</span>
            </button>
          );
        })}
      </div>

      {activeVenue && (
        <a
          data-testid="quick-route-directions-link"
          href={directionsUrl(activeVenue.name, districtName)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-terracotta px-4 text-sm font-black text-white shadow-[0_8px_22px_rgba(158,66,43,0.24)] transition-all hover:-translate-y-0.5 hover:bg-terracottaDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
        >
          {sortedByDistance ? `En yakın ${activeCategory} mekana git` : `${activeCategory} mekana git`}
        </a>
      )}
    </div>
  );
}
