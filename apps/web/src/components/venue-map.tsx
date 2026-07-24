"use client";
import type { VenueListItem } from "@/lib/api";

// Minimal data/props-contract placeholder — the actual map rendering (static tile preview vs.
// a lightweight open-source map lib) is a separate design decision left to a later Codex visual
// pass (see task-5-brief.md Step 8). Keep `data-testid="venue-map"` and the `venues` prop stable;
// Task 6's venue-detail mini-map is expected to reuse whatever approach lands here.
export function VenueMap({ venues }: { venues: VenueListItem[] }) {
  return <div data-testid="venue-map">{venues.length} mekan haritada</div>;
}
