import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toggleViewMode, DiscoveryClient } from "./discovery-client";
import type { VenueListItem } from "@/lib/api";

describe("toggleViewMode", () => {
  it("switches between list and map", () => {
    expect(toggleViewMode("list")).toBe("map");
    expect(toggleViewMode("map")).toBe("list");
  });
});

const getVenues = vi.fn();
const useGeolocation = vi.fn();
vi.mock("@/lib/api", () => ({
  getVenues: (...args: unknown[]) => getVenues(...args),
}));
vi.mock("@/lib/use-geolocation", () => ({
  useGeolocation: () => useGeolocation(),
}));

describe("DiscoveryClient — quick-route and filter composition (final-review Finding 3)", () => {
  beforeEach(() => {
    getVenues.mockReset().mockResolvedValue({ data: [] as VenueListItem[], meta: { next_cursor: null, has_more: false } });
    useGeolocation.mockReset().mockReturnValue(null);
  });

  it("composes a quick-category pick with an already-active boutique filter into a single query, instead of one clobbering the other", async () => {
    render(<DiscoveryClient districtId="kadikoy" initialVenues={[]} />);

    // Activate the boutique toggle via VenueFilters first.
    fireEvent.click(screen.getByTestId("filter-boutique"));
    await waitFor(() => expect(getVenues).toHaveBeenCalledWith({ districtId: "kadikoy", isBoutique: "true" }, null));

    // Now pick a quick-route category — it must be merged with the still-active boutique filter,
    // not replace it via an independent fetch.
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    await waitFor(() =>
      expect(getVenues).toHaveBeenLastCalledWith(
        { districtId: "kadikoy", isBoutique: "true", category: "cafe" },
        null,
      ),
    );

    // The filter UI stays truthful: the boutique button is still visually pressed.
    expect(screen.getByTestId("filter-boutique")).toHaveAttribute("aria-pressed", "true");
    // ...and the quick-route button reflects the selection too.
    expect(screen.getByTestId("quick-category-cafe")).toHaveAttribute("aria-pressed", "true");
  });

  it("passes the current coords from useGeolocation as getVenues's second argument", async () => {
    useGeolocation.mockReturnValue({ lat: 40.99, lng: 29.02 });
    render(<DiscoveryClient districtId="kadikoy" initialVenues={[]} />);

    fireEvent.click(screen.getByTestId("filter-boutique"));
    await waitFor(() =>
      expect(getVenues).toHaveBeenCalledWith({ districtId: "kadikoy", isBoutique: "true" }, { lat: 40.99, lng: 29.02 }),
    );
  });
});
