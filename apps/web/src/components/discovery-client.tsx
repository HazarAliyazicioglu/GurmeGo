"use client";
import { useEffect, useRef, useState } from "react";
import { VenueFilters, serializeFilters, type FilterState } from "@/components/venue-filters";
import { VenueList } from "@/components/venue-list";
import { VenueMap } from "@/components/venue-map";
import { CategoryQuickRoute } from "@/components/category-quick-route";
import { useLocationContext } from "@/lib/location-context";
import type { Coords } from "@/lib/use-geolocation";
import { getVenues, type VenueListItem } from "@/lib/api";

export function toggleViewMode(current: "list" | "map"): "list" | "map" {
  return current === "list" ? "map" : "list";
}

export function DiscoveryClient({
  districtId,
  initialVenues,
  center,
  districtName,
}: {
  districtId: string;
  initialVenues: VenueListItem[];
  center: [number, number];
  districtName: string;
}) {
  const [venues, setVenues] = useState(initialVenues);
  const [filters, setFilters] = useState<FilterState>({});
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const coords = useLocationContext();

  const latestRequest = useRef(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Pagination metadata from `GET /venues`'s keyset cursor -- `null` means "no further page",
  // matching the API's own `next_cursor: null` convention rather than an empty-string sentinel.
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  // `sortedByDistance` becomes true only immediately after a successful coords-driven fetch,
  // not merely "coords exist" -- passed to CategoryQuickRoute so its "En yakın" copy only ever
  // describes what's actually on screen.
  const [sortedByDistance, setSortedByDistance] = useState(false);
  const autoSortedRef = useRef(false);
  const userInteractedRef = useRef(false);

  // Shared fetch path used by both user-driven filter changes (`applyFilters`) and the one-time
  // auto-sort effect below — both write into the SAME `FilterState` and go through this function,
  // so a quick-category pick composes with an already-active filter (e.g. "Butik") instead of the
  // two clobbering each other's `venues` state independently (final-review Finding 3), and the
  // race-condition guard (`latestRequest`) covers both origins of a fetch.
  async function runFetch(next: FilterState, requestCoords: Coords | null) {
    const requestId = ++latestRequest.current;
    setFilters(next);
    setLoading(true);
    setError(null);
    try {
      const { data, meta } = await getVenues({ districtId, ...serializeFilters(next, requestCoords) }, requestCoords);
      if (requestId !== latestRequest.current) return;
      setVenues(data);
      setSortedByDistance(Boolean(requestCoords));
      // A fresh filter/search fetch always replaces the page-1 result set, so pagination state
      // resets alongside it rather than carrying over a cursor from the PREVIOUS query's pages.
      setCursor(meta.next_cursor);
      setHasMore(meta.has_more);
    } catch {
      if (requestId !== latestRequest.current) return;
      setError("Mekanlar yüklenirken bir hata oluştu.");
      setSortedByDistance(false);
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }

  function applyFilters(next: FilterState) {
    userInteractedRef.current = true;
    void runFetch(next, coords);
  }

  // Fetches the next keyset page for the CURRENT filters/coords and appends it below the
  // existing results. Shares `latestRequest` with `runFetch` so that if a filter change (or
  // another "load more" click) starts a newer request while this one is still in flight, the
  // stale response here is discarded instead of appending pages out of order or onto a result
  // set that's since been replaced.
  async function loadMore() {
    if (!hasMore || !cursor || loadingMore) return;
    const requestId = ++latestRequest.current;
    setLoadingMore(true);
    try {
      const { data, meta } = await getVenues(
        { districtId, ...serializeFilters(filters, coords), cursor },
        coords,
      );
      if (requestId !== latestRequest.current) return;
      setVenues((prev) => [...prev, ...data]);
      setCursor(meta.next_cursor);
      setHasMore(meta.has_more);
    } catch {
      if (requestId !== latestRequest.current) return;
      setError("Daha fazla mekan yüklenirken bir hata oluştu.");
    } finally {
      if (requestId === latestRequest.current) setLoadingMore(false);
    }
  }

  // One-time auto-sort: fires once when coords first resolve, but only if the user hasn't already
  // changed a filter before coords resolved (guarded by `userInteractedRef`) — otherwise it would
  // clobber the user's own choice with a coords-only refetch.
  useEffect(() => {
    if (coords && !autoSortedRef.current && !userInteractedRef.current) {
      autoSortedRef.current = true;
      void runFetch(filters, coords);
    }
  }, [coords]);

  function handleQuickCategory(category: string | undefined) {
    applyFilters({ ...filters, category });
  }

  return (
    <>
      <CategoryQuickRoute
        venues={venues}
        districtName={districtName}
        sortedByDistance={sortedByDistance}
        activeCategory={filters.category}
        onSelectCategory={handleQuickCategory}
      />
      <VenueFilters value={filters} onChange={applyFilters} coordsAvailable={coords !== null} />
      {loading && <p role="status" aria-live="polite">Yükleniyor…</p>}
      {error && <p role="status" aria-live="polite">{error}</p>}
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
      {viewMode === "list" ? (
        <>
          <VenueList venues={venues} />
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                data-testid="load-more"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="min-h-11 rounded-full border border-[#201d18]/15 bg-white/45 px-6 text-sm font-black text-[#201d18] transition-colors hover:border-[#d75d3b]/50 hover:bg-[#d75d3b] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d75d3b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f0e7]"
              >
                {loadingMore ? "Yükleniyor…" : "Daha fazla göster"}
              </button>
            </div>
          )}
        </>
      ) : (
        <VenueMap key={districtId} venues={venues} center={center} />
      )}
    </>
  );
}
