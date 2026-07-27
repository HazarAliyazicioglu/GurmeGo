"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Map as LeafletMap } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  getVenuesInBbox,
  type MapVenue,
  type VenueListItem,
} from "@/lib/api";

type LocatedVenue = MapVenue & { slug: string };
type LoadState = "loading" | "ready" | "error";

export type FocusVenue = {
  id: string;
  name: string;
  slug: string;
  category: string;
  lat: number;
  lng: number;
};

function markerEventHandlers(name: string) {
  return {
    add: (e: { target: { getElement: () => HTMLElement | null; openPopup: () => void } }) => {
      const layer = e.target;
      const el = layer.getElement();
      if (!el) return;
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", name);
      el.addEventListener("keydown", (evt: KeyboardEvent) => {
        if (evt.key === "Enter" || evt.key === " ") {
          evt.preventDefault();
          layer.openPopup();
        }
      });
    },
  };
}

function BoundsVenueLoader({
  venues,
  onLocationsChange,
  onLoadStateChange,
}: {
  venues: VenueListItem[];
  onLocationsChange: (venues: LocatedVenue[]) => void;
  onLoadStateChange: (state: LoadState) => void;
}) {
  const latestRequest = useRef(0);
  const venuesById = useMemo(
    () => new Map(venues.map((venue) => [venue.id, venue])),
    [venues],
  );
  const map = useMap();

  const loadVisibleVenues = useCallback(
    async (activeMap: LeafletMap) => {
      const requestId = ++latestRequest.current;

      if (venuesById.size === 0) {
        onLocationsChange([]);
        onLoadStateChange("ready");
        return;
      }

      const bounds = activeMap.getBounds();
      const bbox: [number, number, number, number] = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ];

      onLoadStateChange("loading");

      try {
        const mapVenues = await getVenuesInBbox(bbox);
        if (requestId !== latestRequest.current) return;

        const visibleLocations = mapVenues.flatMap((venue) => {
          const listVenue = venuesById.get(venue.id);
          return listVenue ? [{ ...venue, slug: listVenue.slug }] : [];
        });

        onLocationsChange(visibleLocations);
        onLoadStateChange("ready");
      } catch {
        if (requestId !== latestRequest.current) return;
        onLoadStateChange("error");
      }
    },
    [onLoadStateChange, onLocationsChange, venuesById],
  );

  useMapEvents({
    moveend() {
      void loadVisibleVenues(map);
    },
  });

  useEffect(() => {
    void loadVisibleVenues(map);
    return () => {
      latestRequest.current += 1;
    };
  }, [loadVisibleVenues, map]);

  return null;
}

export function VenueMapCanvas({
  venues,
  center,
  focusVenue,
}: {
  venues: VenueListItem[];
  center: [number, number];
  focusVenue?: FocusVenue;
}) {
  const [locations, setLocations] = useState<LocatedVenue[]>([]);
  const [loadState, setLoadState] = useState<LoadState>(focusVenue ? "ready" : "loading");

  const handleLocationsChange = useCallback((nextLocations: LocatedVenue[]) => {
    setLocations(nextLocations);
  }, []);

  const handleLoadStateChange = useCallback((nextState: LoadState) => {
    setLoadState(nextState);
  }, []);

  const effectiveCenter: [number, number] = focusVenue
    ? [focusVenue.lat, focusVenue.lng]
    : center;

  const markers: LocatedVenue[] = focusVenue
    ? [{ id: focusVenue.id, slug: focusVenue.slug, name: focusVenue.name, category: focusVenue.category, lat: focusVenue.lat, lng: focusVenue.lng }]
    : locations;

  return (
    <div
      className="relative h-full w-full"
      role="region"
      aria-label="Mekanların konumlarını gösteren interaktif harita"
    >
      <MapContainer
        center={effectiveCenter}
        zoom={13}
        minZoom={10}
        scrollWheelZoom={false}
        className="h-full w-full bg-[#e8e1d5]"
        aria-label="Mekanların konumlarını gösteren interaktif harita"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıda bulunanlar'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {!focusVenue && (
          <BoundsVenueLoader
            venues={venues}
            onLocationsChange={handleLocationsChange}
            onLoadStateChange={handleLoadStateChange}
          />
        )}

        {markers.map((venue) => (
          <CircleMarker
            key={venue.id}
            center={[venue.lat, venue.lng]}
            radius={9}
            pathOptions={{
              color: "#f4f0e7",
              fillColor: "#d75d3b",
              fillOpacity: 1,
              opacity: 1,
              weight: 3,
            }}
            eventHandlers={markerEventHandlers(venue.name)}
          >
            <Popup minWidth={180}>
              <div className="font-sans text-[#201d18]">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#d75d3b]">
                  {venue.category}
                </p>
                <p className="mt-1 font-serif text-lg font-semibold leading-tight">
                  {venue.name}
                </p>
                <Link
                  href={`/mekan/${venue.slug}`}
                  className="mt-3 inline-flex min-h-9 items-center rounded-full bg-[#201d18] px-3.5 text-xs font-bold text-[#f4f0e7] transition-colors hover:bg-[#d75d3b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d75d3b] focus-visible:ring-offset-2"
                >
                  Mekanı incele
                  <span className="ml-1.5" aria-hidden="true">
                    →
                  </span>
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {loadState === "loading" && (
        <div
          className="pointer-events-none absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-full border border-[#201d18]/10 bg-[#f4f0e7]/95 px-3 py-2 text-[0.68rem] font-bold text-[#201d18]/70 shadow-md backdrop-blur-sm"
          role="status"
        >
          <span className="size-2 animate-pulse rounded-full bg-[#d75d3b]" aria-hidden="true" />
          Bu alandaki mekanlar aranıyor
        </div>
      )}

      {loadState === "error" && (
        <div
          className="absolute bottom-8 left-3 right-3 z-[500] rounded-xl border border-[#201d18]/10 bg-[#f4f0e7]/95 px-4 py-3 text-sm font-semibold text-[#201d18] shadow-lg backdrop-blur-sm sm:left-auto sm:max-w-sm"
          role="status"
        >
          Konumlar şu an yüklenemedi. Haritayı yine de inceleyebilirsin.
        </div>
      )}

      {!focusVenue && loadState === "ready" && locations.length === 0 && (
        <div
          className="pointer-events-none absolute bottom-8 left-3 right-3 z-[500] rounded-xl border border-[#201d18]/10 bg-[#f4f0e7]/95 px-4 py-3 text-sm font-semibold text-[#201d18] shadow-lg backdrop-blur-sm sm:left-auto sm:max-w-sm"
          role="status"
        >
          Bu görünümde seçili mekanlardan biri yok. Haritayı hareket ettirerek çevreye bakabilirsin.
        </div>
      )}
    </div>
  );
}
