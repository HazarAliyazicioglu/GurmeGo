"use client";

import dynamic from "next/dynamic";
import type { VenueListItem } from "@/lib/api";
import type { FocusVenue } from "./venue-map-leaflet";

const VenueMapCanvas = dynamic(
  () => import("./venue-map-leaflet").then((module) => module.VenueMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div
        className="grid h-full place-items-center bg-sandLight"
        role="status"
        aria-label="Harita yükleniyor"
      >
        <div className="flex items-center gap-3 rounded-full border border-ink/10 bg-cream/95 px-4 py-2.5 text-xs font-bold text-ink/65 shadow-sm">
          <span className="size-2 animate-pulse rounded-full bg-terracotta" aria-hidden="true" />
          Harita hazırlanıyor
        </div>
      </div>
    ),
  },
);

export function VenueMap({
  venues,
  center,
  focusVenue,
}: {
  venues: VenueListItem[];
  center: [number, number];
  focusVenue?: FocusVenue;
}) {
  return (
    <section
      data-testid="venue-map"
      className="relative isolate mt-9 overflow-hidden rounded-[1.5rem] border border-ink/15 bg-ink shadow-[0_18px_45px_rgba(32,29,24,0.12)]"
      aria-labelledby="venue-map-title"
    >
      <div className="flex items-end justify-between gap-4 bg-ink px-4 py-4 text-cream sm:px-5">
        <div>
          <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-terracottaSoft">
            Mahalle görünümü
          </p>
          <h2
            id="venue-map-title"
            className="mt-1 font-serif text-2xl font-semibold tracking-[-0.035em]"
          >
            Mekanları haritada keşfet
          </h2>
        </div>
        <span className="mb-1 shrink-0 text-xs font-bold tabular-nums text-cream/55">
          {(focusVenue ? 1 : venues.length).toString().padStart(2, "0")} mekan
        </span>
      </div>

      <div className="h-[60vh] min-h-[24rem] max-h-[38rem] w-full">
        <VenueMapCanvas venues={venues} center={center} focusVenue={focusVenue} />
      </div>
    </section>
  );
}
