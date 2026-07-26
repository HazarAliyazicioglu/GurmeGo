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
const useLocationContext = vi.fn();
vi.mock("@/lib/api", () => ({
  getVenues: (...args: unknown[]) => getVenues(...args),
}));
vi.mock("@/lib/location-context", () => ({
  useLocationContext: () => useLocationContext(),
}));

describe("DiscoveryClient — quick-route and filter composition (final-review Finding 3)", () => {
  beforeEach(() => {
    getVenues.mockReset().mockResolvedValue({ data: [] as VenueListItem[], meta: { next_cursor: null, has_more: false } });
    useLocationContext.mockReset().mockReturnValue(null);
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

  it("passes the current coords from useLocationContext as getVenues's second argument", async () => {
    useLocationContext.mockReturnValue({ lat: 40.99, lng: 29.02 });
    render(<DiscoveryClient districtId="kadikoy" initialVenues={[]} />);

    fireEvent.click(screen.getByTestId("filter-boutique"));
    await waitFor(() =>
      expect(getVenues).toHaveBeenCalledWith({ districtId: "kadikoy", isBoutique: "true" }, { lat: 40.99, lng: 29.02 }),
    );
  });
});

describe("DiscoveryClient — loading, error, and stale-response discarding (C2)", () => {
  beforeEach(() => {
    getVenues.mockReset().mockResolvedValue({ data: [] as VenueListItem[], meta: { next_cursor: null, has_more: false } });
    useLocationContext.mockReset().mockReturnValue(null);
  });

  it("shows a loading indicator while a request is genuinely still in flight", async () => {
    let resolveVenues: (v: unknown) => void;
    getVenues.mockReturnValueOnce(new Promise((resolve) => { resolveVenues = resolve; }));
    render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/yükleniyor/i));
    resolveVenues!({ data: [], meta: { next_cursor: null, has_more: false } });
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("shows an error message on failure", async () => {
    getVenues.mockRejectedValueOnce(new Error("500"));
    render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/hata/i));
  });

  it("ignores a slow first response if a second request has already started", async () => {
    let resolveFirst: (v: unknown) => void;
    const venueA = { id: "v1", name: "First", slug: "first", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: null, googleRatingCount: null };
    const venueB = { id: "v2", name: "Second", slug: "second", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: null, googleRatingCount: null };
    getVenues
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ data: [venueB], meta: { next_cursor: null, has_more: false } });
    render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    fireEvent.click(screen.getByTestId("filter-boutique")); // toggles back off -- a second, distinct request
    await waitFor(() => expect(screen.getByText("Second")).toBeInTheDocument());
    resolveFirst!({ data: [venueA], meta: { next_cursor: null, has_more: false } });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText("First")).not.toBeInTheDocument();
  });
});

describe("DiscoveryClient — one-time auto-sort effect", () => {
  beforeEach(() => {
    getVenues.mockReset().mockResolvedValue({ data: [] as VenueListItem[], meta: { next_cursor: null, has_more: false } });
    useLocationContext.mockReset().mockReturnValue(null);
  });

  it("auto-refetches with resolved coords exactly once via rerender", async () => {
    useLocationContext.mockReturnValue(null);
    const { rerender } = render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    useLocationContext.mockReturnValue({ lat: 40.99, lng: 29.02 });
    rerender(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    await waitFor(() => expect(getVenues).toHaveBeenCalledWith(expect.any(Object), { lat: 40.99, lng: 29.02 }));
    expect(getVenues).toHaveBeenCalledTimes(1);
    rerender(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    expect(getVenues).toHaveBeenCalledTimes(1);
  });

  it("does not auto-refetch if the user already changed a filter before coords resolved", async () => {
    useLocationContext.mockReturnValue(null);
    const { rerender } = render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    await waitFor(() => expect(getVenues).toHaveBeenCalledTimes(1));
    useLocationContext.mockReturnValue({ lat: 40.99, lng: 29.02 });
    rerender(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(getVenues).toHaveBeenCalledTimes(1);
  });
});
