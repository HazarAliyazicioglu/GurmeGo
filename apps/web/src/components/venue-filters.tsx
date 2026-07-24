"use client";
import { useState } from "react";

export interface FilterState {
  category?: string;
  priceRange?: string;
  isBoutique?: boolean;
  radiusM?: number;
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
  if (filters.isBoutique !== undefined) out.isBoutique = String(filters.isBoutique);
  if (filters.radiusM !== undefined && coords) {
    out.radiusM = String(filters.radiusM);
    out.lat = String(coords.lat);
    out.lng = String(coords.lng);
  }
  return out;
}

export function VenueFilters({ onChange, coordsAvailable }: { onChange: (filters: FilterState) => void; coordsAvailable: boolean }) {
  const [filters, setFilters] = useState<FilterState>({});
  function update(patch: Partial<FilterState>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    onChange(next);
  }
  // Placeholder markup — Codex visual pass (Step 6 below) replaces this with real chip/filter UI.
  // The distance select must be disabled (not just hidden) when `coordsAvailable` is false, so the
  // user understands why it's unavailable rather than it silently vanishing.
  return (
    <div data-testid="venue-filters">
      <button data-testid="filter-boutique" onClick={() => update({ isBoutique: !filters.isBoutique })}>Butik</button>
      <select
        data-testid="filter-radius"
        disabled={!coordsAvailable}
        onChange={(e) => update({ radiusM: e.target.value ? Number(e.target.value) : undefined })}
      >
        <option value="">Mesafe</option>
        <option value="500">500m</option>
        <option value="1500">1.5km</option>
        <option value="3000">3km</option>
      </select>
      <select data-testid="filter-price" onChange={(e) => update({ priceRange: e.target.value || undefined })}>
        <option value="">Fiyat</option>
        <option value="BUDGET">₺</option>
        <option value="MODERATE">₺₺</option>
        <option value="EXPENSIVE">₺₺₺</option>
        <option value="PREMIUM">₺₺₺₺</option>
      </select>
    </div>
  );
}
