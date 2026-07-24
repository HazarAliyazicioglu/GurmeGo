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
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const coords = useGeolocation();

  async function handleFilterChange(filters: FilterState) {
    const { data } = await getVenues({ districtId, ...serializeFilters(filters, coords) });
    setVenues(data);
  }

  // `CategoryQuickRoute.onSelect` is intentionally typed `(venues: unknown[]) => void` to keep
  // that component decoupled from the venue list shape; it always calls it with the real
  // `VenueListItem[]` from `getVenues` internally, so this narrowing is safe.
  function handleQuickSelect(selected: unknown[]) {
    setVenues(selected as VenueListItem[]);
  }

  return (
    <>
      <CategoryQuickRoute districtId={districtId} onSelect={handleQuickSelect} />
      <VenueFilters onChange={handleFilterChange} coordsAvailable={coords !== null} />
      <button
        type="button"
        data-testid="view-mode-toggle"
        onClick={() => setViewMode(toggleViewMode(viewMode))}
      >
        {viewMode === "list" ? "Haritada göster" : "Listede göster"}
      </button>
      {viewMode === "list" ? <VenueList venues={venues} /> : <VenueMap venues={venues} />}
    </>
  );
}
