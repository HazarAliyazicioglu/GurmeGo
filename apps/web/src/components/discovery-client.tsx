"use client";
import { useState } from "react";
import { VenueFilters, serializeFilters, type FilterState } from "@/components/venue-filters";
import { VenueList } from "@/components/venue-list";
import { VenueMap } from "@/components/venue-map";
import { CategoryQuickRoute } from "@/components/category-quick-route";
import { useGeolocation } from "@/lib/use-geolocation";
import { getVenues, type VenueListItem } from "@/lib/api";

export function toggleViewMode(current: "list" | "map"): "list" | "map" {
  return current === "list" ? "map" : "list";
}

export function DiscoveryClient({ districtId, initialVenues }: { districtId: string; initialVenues: VenueListItem[] }) {
  const [venues, setVenues] = useState(initialVenues);
  const [filters, setFilters] = useState<FilterState>({});
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const coords = useGeolocation();

  // Single refetch path shared by `VenueFilters` and `CategoryQuickRoute` — both write into the
  // SAME `FilterState` and go through this function, so a quick-category pick composes with an
  // already-active filter (e.g. "Butik") instead of the two clobbering each other's `venues`
  // state independently (final-review Finding 3).
  async function applyFilters(next: FilterState) {
    setFilters(next);
    const { data } = await getVenues({ districtId, ...serializeFilters(next, coords) });
    setVenues(data);
  }

  function handleQuickCategory(category: string) {
    void applyFilters({ ...filters, category });
  }

  return (
    <>
      <CategoryQuickRoute activeCategory={filters.category} onSelectCategory={handleQuickCategory} />
      <VenueFilters value={filters} onChange={applyFilters} coordsAvailable={coords !== null} />
      <button
        type="button"
        data-testid="view-mode-toggle"
        onClick={() => setViewMode(toggleViewMode(viewMode))}
        className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#201d18]/15 bg-white/45 px-4 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#201d18] transition-colors hover:border-[#d75d3b]/50 hover:bg-[#d75d3b] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d75d3b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f0e7]"
      >
        <span className="grid size-6 place-items-center rounded-full bg-[#201d18] text-[#f4f0e7]" aria-hidden="true">
          {viewMode === "list" ? (
            <svg viewBox="0 0 24 24" className="size-3.5 fill-none">
              <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="10" r="2" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-3.5 fill-none">
              <path d="M7 7h12M7 12h12M7 17h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="3.5" cy="7" r="1" fill="currentColor" />
              <circle cx="3.5" cy="12" r="1" fill="currentColor" />
              <circle cx="3.5" cy="17" r="1" fill="currentColor" />
            </svg>
          )}
        </span>
        {viewMode === "list" ? "Haritada göster" : "Listede göster"}
      </button>
      {viewMode === "list" ? <VenueList venues={venues} /> : <VenueMap venues={venues} />}
    </>
  );
}
