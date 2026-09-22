"use client";

export interface FilterState {
  category?: string;
  priceRange?: string;
  isBoutique?: boolean;
  radiusM?: number;
  openNow?: boolean;
}

interface Coords {
  lat: number;
  lng: number;
}

// `radiusM` alone does nothing server-side — Plan 1's ST_DWithin filter only activates when lat+lng
// are ALSO present (verified in venues.repository.ts). Without known coordinates, drop radiusM rather
// than send a query param that silently has no effect.
export function serializeFilters(filters: FilterState, coords?: Coords | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.category) out.category = filters.category;
  if (filters.priceRange) out.priceRange = filters.priceRange;
  if (filters.isBoutique === true) out.isBoutique = String(filters.isBoutique);
  if (filters.radiusM !== undefined && coords) out.radiusM = String(filters.radiusM);
  if (filters.openNow) out.openNow = "true";
  return out;
}

// Controlled component: `value` is the single source of truth for filter state, owned by the
// parent (`DiscoveryClient`) so that `CategoryQuickRoute`'s quick-category selection and this
// component's own controls read/write the SAME `FilterState` instead of racing each other
// (final-review Finding 3 — the two used to maintain independent state and clobber one another).
export function VenueFilters({
  value,
  onChange,
  coordsAvailable,
}: {
  value: FilterState;
  onChange: (filters: FilterState) => void;
  coordsAvailable: boolean;
}) {
  const filters = value;
  function update(patch: Partial<FilterState>) {
    onChange({ ...filters, ...patch });
  }

  return (
    <div data-testid="venue-filters" className="mt-7 border-y border-ink/10 py-4">
      <div className="mb-3 flex items-center gap-2 px-1">
        <svg viewBox="0 0 20 20" className="size-4 text-terracotta" aria-hidden="true">
          <path d="M3 5h14M5.5 10h9M8 15h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-ink/45">Seçkiyi daralt</span>
        <span className="h-px flex-1 bg-ink/10" aria-hidden="true" />
      </div>

      <div className="-mx-1 flex items-start gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <label className="relative shrink-0">
          <span className="sr-only">Kategori</span>
          <select
            aria-label="Kategori"
            value={filters.category ?? ""}
            onChange={(e) => update({ category: e.target.value || undefined })}
            className={[
              "min-h-11 cursor-pointer appearance-none rounded-full border py-2 pl-4 pr-9 text-sm font-bold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
              filters.category ? "border-ink bg-ink text-cream" : "border-ink/15 bg-white/45 text-ink/65 hover:border-ink/30",
            ].join(" ")}
          >
            <option value="">Kategori</option>
            <option value="cafe">Kahve</option>
            <option value="restaurant">Restoran</option>
            <option value="bakery">Fırın &amp; tatlı</option>
            <option value="street-food">Sokak lezzeti</option>
          </select>
          <svg viewBox="0 0 16 16" className="pointer-events-none absolute right-3.5 top-1/2 size-3.5 -translate-y-1/2" aria-hidden="true">
            <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </label>

        <label className="relative shrink-0">
          <span className="sr-only">Fiyat aralığı</span>
          <select
            data-testid="filter-price"
            value={filters.priceRange ?? ""}
            onChange={(e) => update({ priceRange: e.target.value || undefined })}
            className={[
              "min-h-11 cursor-pointer appearance-none rounded-full border py-2 pl-4 pr-9 text-sm font-bold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
              filters.priceRange ? "border-ink bg-ink text-cream" : "border-ink/15 bg-white/45 text-ink/65 hover:border-ink/30",
            ].join(" ")}
          >
            <option value="">Fiyat</option>
            <option value="BUDGET">₺</option>
            <option value="MODERATE">₺₺</option>
            <option value="EXPENSIVE">₺₺₺</option>
            <option value="PREMIUM">₺₺₺₺</option>
          </select>
          <svg viewBox="0 0 16 16" className="pointer-events-none absolute right-3.5 top-1/2 size-3.5 -translate-y-1/2" aria-hidden="true">
            <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </label>

        <div className="shrink-0">
          <label className="relative block">
            <span className="sr-only">Mesafe</span>
            <select
              data-testid="filter-radius"
              disabled={!coordsAvailable}
              value={filters.radiusM ?? ""}
              onChange={(e) => update({ radiusM: e.target.value ? Number(e.target.value) : undefined })}
              className={[
                "min-h-11 appearance-none rounded-full border py-2 pl-4 pr-9 text-sm font-bold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
                !coordsAvailable
                  ? "cursor-not-allowed border-ink/8 bg-ink/5 text-ink/28"
                  : filters.radiusM
                    ? "cursor-pointer border-ink bg-ink text-cream"
                    : "cursor-pointer border-ink/15 bg-white/45 text-ink/65 hover:border-ink/30",
              ].join(" ")}
            >
              <option value="">Mesafe</option>
              <option value="500">500m</option>
              <option value="1500">1.5km</option>
              <option value="3000">3km</option>
            </select>
            {coordsAvailable ? (
              <svg viewBox="0 0 16 16" className="pointer-events-none absolute right-3.5 top-1/2 size-3.5 -translate-y-1/2" aria-hidden="true">
                <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" className="pointer-events-none absolute right-3.5 top-1/2 size-3.5 -translate-y-1/2 text-ink/30" aria-hidden="true">
                <rect x="3.5" y="7" width="9" height="6.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            )}
          </label>
          {!coordsAvailable && <p className="mt-1.5 px-2 text-[0.6rem] font-semibold text-ink/38">Konum izni gerekli</p>}
        </div>

        <button
          data-testid="filter-boutique"
          onClick={() => update({ isBoutique: filters.isBoutique ? undefined : true })}
          aria-pressed={Boolean(filters.isBoutique)}
          className={[
            "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
            filters.isBoutique
              ? "border-terracotta bg-terracotta text-white shadow-[0_5px_14px_rgba(215,93,59,0.18)]"
              : "border-ink/15 bg-white/45 text-ink/65 hover:border-ink/30",
          ].join(" ")}
        >
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
            <path d="M8 1.8 9.4 6l4.4 1.1-3.4 2.6.2 4.5L8 11.8l-2.6 2.4.2-4.5-3.4-2.6L6.6 6 8 1.8Z" fill="currentColor" />
          </svg>
          Butik
        </button>

        <button
          data-testid="filter-open-now"
          onClick={() => update({ openNow: filters.openNow ? undefined : true })}
          aria-pressed={Boolean(filters.openNow)}
          className={[
            "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
            filters.openNow
              ? "border-terracotta bg-terracotta text-white shadow-[0_5px_14px_rgba(215,93,59,0.18)]"
              : "border-ink/15 bg-white/45 text-ink/65 hover:border-ink/30",
          ].join(" ")}
        >
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
            <path d="M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8 5v3.2l2.2 1.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Şimdi açık
        </button>
      </div>
    </div>
  );
}