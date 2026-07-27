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
const venueMapMock = vi.fn((_props: { venues: VenueListItem[]; center: [number, number] }) => (
  <div data-testid="mock-venue-map" />
));
vi.mock("@/components/venue-map", () => ({
  VenueMap: (props: { venues: VenueListItem[]; center: [number, number] }) => venueMapMock(props),
}));

describe("DiscoveryClient — quick-route and filter composition (final-review Finding 3)", () => {
  beforeEach(() => {
    getVenues.mockReset().mockResolvedValue({ data: [] as VenueListItem[], meta: { next_cursor: null, has_more: false } });
    useLocationContext.mockReset().mockReturnValue(null);
  });

  it("composes a quick-category pick with an already-active boutique filter into a single query, instead of one clobbering the other", async () => {
    render(<DiscoveryClient districtId="kadikoy" initialVenues={[]} center={[40.99, 29.02]} districtName="Kadıköy" />);

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
    render(<DiscoveryClient districtId="kadikoy" initialVenues={[]} center={[40.99, 29.02]} districtName="Kadıköy" />);

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
    render(<DiscoveryClient districtId="d1" initialVenues={[]} center={[40.99, 29.02]} districtName="Kadıköy" />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/yükleniyor/i));
    resolveVenues!({ data: [], meta: { next_cursor: null, has_more: false } });
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("shows an error message on failure", async () => {
    getVenues.mockRejectedValueOnce(new Error("500"));
    render(<DiscoveryClient districtId="d1" initialVenues={[]} center={[40.99, 29.02]} districtName="Kadıköy" />);
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
    render(<DiscoveryClient districtId="d1" initialVenues={[]} center={[40.99, 29.02]} districtName="Kadıköy" />);
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
    const { rerender } = render(<DiscoveryClient districtId="d1" initialVenues={[]} center={[40.99, 29.02]} districtName="Kadıköy" />);
    useLocationContext.mockReturnValue({ lat: 40.99, lng: 29.02 });
    rerender(<DiscoveryClient districtId="d1" initialVenues={[]} center={[40.99, 29.02]} districtName="Kadıköy" />);
    await waitFor(() => expect(getVenues).toHaveBeenCalledWith(expect.any(Object), { lat: 40.99, lng: 29.02 }));
    expect(getVenues).toHaveBeenCalledTimes(1);
    rerender(<DiscoveryClient districtId="d1" initialVenues={[]} center={[40.99, 29.02]} districtName="Kadıköy" />);
    expect(getVenues).toHaveBeenCalledTimes(1);
  });

  it("does not auto-refetch if the user already changed a filter before coords resolved", async () => {
    useLocationContext.mockReturnValue(null);
    const { rerender } = render(<DiscoveryClient districtId="d1" initialVenues={[]} center={[40.99, 29.02]} districtName="Kadıköy" />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    await waitFor(() => expect(getVenues).toHaveBeenCalledTimes(1));
    useLocationContext.mockReturnValue({ lat: 40.99, lng: 29.02 });
    rerender(<DiscoveryClient districtId="d1" initialVenues={[]} center={[40.99, 29.02]} districtName="Kadıköy" />);
    await new Promise((r) => setTimeout(r, 0));
    expect(getVenues).toHaveBeenCalledTimes(1);
  });
});

describe("DiscoveryClient — pagination ('load more' from GET /venues's keyset cursor)", () => {
  beforeEach(() => {
    getVenues.mockReset();
    useLocationContext.mockReset().mockReturnValue(null);
  });

  const venueA = { id: "v1", name: "First", slug: "first", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: null, googleRatingCount: null } satisfies VenueListItem;
  const venueB = { id: "v2", name: "Second", slug: "second", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: null, googleRatingCount: null } satisfies VenueListItem;
  const venueC = { id: "v3", name: "Third", slug: "third", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: null, googleRatingCount: null } satisfies VenueListItem;

  it("does not render a 'load more' button when has_more is false", () => {
    render(<DiscoveryClient districtId="d1" initialVenues={[venueA]} center={[40.99, 29.02]} districtName="Kadıköy" />);
    expect(screen.queryByTestId("load-more")).not.toBeInTheDocument();
  });

  it("renders a 'load more' button after a fetch reports has_more: true, and clicking it appends the next cursor page", async () => {
    getVenues.mockResolvedValueOnce({ data: [venueA], meta: { next_cursor: "cursor-1", has_more: true } });
    render(<DiscoveryClient districtId="d1" initialVenues={[]} center={[40.99, 29.02]} districtName="Kadıköy" />);

    fireEvent.click(screen.getByTestId("filter-boutique"));
    await waitFor(() => expect(screen.getByTestId("load-more")).toBeInTheDocument());

    getVenues.mockResolvedValueOnce({ data: [venueB], meta: { next_cursor: null, has_more: false } });
    fireEvent.click(screen.getByTestId("load-more"));

    // The second, "load more" call passes the cursor from the first response's meta.
    await waitFor(() =>
      expect(getVenues).toHaveBeenLastCalledWith(
        expect.objectContaining({ districtId: "d1", cursor: "cursor-1" }),
        null,
      ),
    );
    // Existing results stay, the new page is appended (not replacing).
    await waitFor(() => expect(screen.getByText("Second")).toBeInTheDocument());
    expect(screen.getByText("First")).toBeInTheDocument();
    // has_more is now false, so the button disappears.
    expect(screen.queryByTestId("load-more")).not.toBeInTheDocument();
  });

  it("a new filter fetch replaces venues and pagination state instead of appending to the old page", async () => {
    getVenues.mockResolvedValueOnce({ data: [venueA], meta: { next_cursor: "cursor-1", has_more: true } });
    render(<DiscoveryClient districtId="d1" initialVenues={[]} center={[40.99, 29.02]} districtName="Kadıköy" />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    await waitFor(() => expect(screen.getByTestId("load-more")).toBeInTheDocument());

    // User changes filters again before loading more -- this must replace, not append, and the
    // stale cursor from the FIRST fetch must not leak into a later "load more" click.
    getVenues.mockResolvedValueOnce({ data: [venueC], meta: { next_cursor: null, has_more: false } });
    fireEvent.click(screen.getByTestId("filter-open-now"));

    await waitFor(() => expect(screen.getByText("Third")).toBeInTheDocument());
    expect(screen.queryByText("First")).not.toBeInTheDocument();
    expect(screen.queryByTestId("load-more")).not.toBeInTheDocument();
  });

  it("discards a stale 'load more' response if a newer filter fetch has already superseded it", async () => {
    getVenues.mockResolvedValueOnce({ data: [venueA], meta: { next_cursor: "cursor-1", has_more: true } });
    render(<DiscoveryClient districtId="d1" initialVenues={[]} center={[40.99, 29.02]} districtName="Kadıköy" />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    await waitFor(() => expect(screen.getByTestId("load-more")).toBeInTheDocument());

    let resolveLoadMore: (v: unknown) => void;
    getVenues.mockReturnValueOnce(new Promise((resolve) => { resolveLoadMore = resolve; }));
    fireEvent.click(screen.getByTestId("load-more"));

    // A new filter change fires before the slow "load more" request resolves.
    getVenues.mockResolvedValueOnce({ data: [venueC], meta: { next_cursor: null, has_more: false } });
    fireEvent.click(screen.getByTestId("filter-open-now"));
    await waitFor(() => expect(screen.getByText("Third")).toBeInTheDocument());

    // The stale "load more" response for venueB now resolves -- it must not appear.
    resolveLoadMore!({ data: [venueB], meta: { next_cursor: null, has_more: false } });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText("Second")).not.toBeInTheDocument();
    expect(screen.getByText("Third")).toBeInTheDocument();
  });
});

describe("DiscoveryClient — forwards center to VenueMap (C3)", () => {
  beforeEach(() => {
    getVenues.mockReset().mockResolvedValue({ data: [] as VenueListItem[], meta: { next_cursor: null, has_more: false } });
    useLocationContext.mockReset().mockReturnValue(null);
    venueMapMock.mockClear();
  });

  it("passes the given center prop through to VenueMap when the map view is active", () => {
    render(<DiscoveryClient districtId="d1" initialVenues={[]} center={[41.0422, 29.0061]} districtName="Kadıköy" />);
    fireEvent.click(screen.getByTestId("view-mode-toggle"));
    expect(venueMapMock).toHaveBeenCalledWith(
      expect.objectContaining({ center: [41.0422, 29.0061] }),
    );
  });
});

describe("DiscoveryClient — sortedByDistance reaches CategoryQuickRoute correctly (via real rendered output, not a mock)", () => {
  // satisfies VenueListItem here too (round-10 finding: this fixture was missed when the same fix
  // was applied to Step 2's fixture) -- prevents priceRange: "BUDGET" widening to string, which
  // would otherwise fail typecheck once passed into DiscoveryClient's initialVenues prop below.
  const venue = { id: "v1", name: "First Cafe", slug: "first-cafe", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: null, googleRatingCount: null } satisfies VenueListItem;

  beforeEach(() => {
    getVenues.mockReset();
    useLocationContext.mockReset();
  });

  it("shows neutral quick-route copy when the user picks a category before coords ever resolve (auto-sort correctly never fires)", async () => {
    useLocationContext.mockReturnValue(null);
    getVenues.mockResolvedValue({ data: [venue], meta: { next_cursor: null, has_more: false } });
    render(<DiscoveryClient districtId="d1" districtName="Kadıköy" center={[40.99, 29.02]} initialVenues={[venue]} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    await waitFor(() => expect(screen.getByRole("link", { name: /cafe mekana git/i })).toBeInTheDocument());
    expect(screen.queryByText(/en yakın/i)).not.toBeInTheDocument();
  });

  it("shows 'En yakın' quick-route copy once coords resolve at mount AND a category is picked afterward — the link itself only ever renders once a category is active (CategoryQuickRoute's own contract from Step 2), so proving it requires both: the auto-sort effect setting sortedByDistance=true first, THEN a real category click", async () => {
    useLocationContext.mockReturnValue({ lat: 40.99, lng: 29.02 });
    getVenues.mockResolvedValue({ data: [venue], meta: { next_cursor: null, has_more: false } });
    render(<DiscoveryClient districtId="d1" districtName="Kadıköy" center={[40.99, 29.02]} initialVenues={[venue]} />);
    // Step 1: wait for the one-time auto-sort effect's coords-driven fetch to resolve (coords were
    // already non-null at mount, userInteractedRef is still false at this point) -- this is what
    // actually sets sortedByDistance=true; there's no directly-visible signal for it yet since no
    // category is active, so wait on the underlying call instead.
    await waitFor(() => expect(getVenues).toHaveBeenCalledTimes(1));
    // Step 2: NOW click a category -- userInteractedRef becomes true, but this fetch ALSO carries
    // coords (they were already resolved), so sortedByDistance stays true through this second,
    // real, coords-driven fetch too -- this is not the blocked transition from the neutral-copy
    // test above (that test had coords null throughout; this one has them present throughout).
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    await waitFor(() => expect(screen.getByRole("link", { name: /en yakın cafe mekana git/i })).toBeInTheDocument());
  });
});
