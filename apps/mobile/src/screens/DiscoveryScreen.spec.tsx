import { render, screen, waitFor, fireEvent, act } from "@testing-library/react-native";
import DiscoveryScreen from "./DiscoveryScreen";
import { getVenues, getDistricts } from "../lib/api";
import { useLocation } from "../lib/use-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";

jest.mock("../lib/api", () => ({
  getVenues: jest.fn(),
  getDistricts: jest.fn(),
}));
jest.mock("../lib/use-location", () => ({ useLocation: jest.fn() }));
// Spreading react-native's module object (`{ ...actual, FlatList: ... }`) eagerly evaluates every
// one of its lazy-getter exports and crashes with an invariant violation deep in
// @react-native/virtualized-lists -- redefine only the one property instead.
jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  const { mockFlatList } = require("../../test-utils/mock-flat-list");
  Object.defineProperty(actual, "FlatList", { value: mockFlatList, configurable: true });
  return actual;
});

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// FlatList is mocked (above) to render its items synchronously -- react-native's real
// VirtualizedList defers its initial cell render behind its own setTimeout, which was observed
// to occasionally exceed this whole file's 15s test budget on CI's shared runner (root-caused
// separately from the render()-await race this file also had; see git history). The remaining
// `{ timeout: 5000 }` bumps below are just a safety margin for the getVenues()/getDistricts()
// promise resolution itself, not for any virtualization delay.
describe("DiscoveryScreen", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    (getVenues as jest.Mock).mockReset();
    (useLocation as jest.Mock).mockReturnValue(null);
    (getDistricts as jest.Mock).mockResolvedValue([
      { id: "d1", cityId: "c1", name: "Kadıköy", slug: "kadikoy" },
    ]);
  });

  // Denetim raporu §4.2 "Filtreye uyan mekan yoksa kullanıcı bunu anlayamıyor".
  it("shows a 'no results' message once the (empty) response has actually loaded, not before", async () => {
    (getVenues as jest.Mock).mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });

    await render(<DiscoveryScreen />);

    await waitFor(() => expect(screen.getByText(/bu kriterlere uygun mekan bulunamadı/i)).toBeTruthy(), { timeout: 5000 });
  });

  it("does NOT show the 'no results' message while venues are still loading", async () => {
    let resolveVenues!: (v: unknown) => void;
    (getVenues as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveVenues = resolve; }));

    await render(<DiscoveryScreen />);

    expect(screen.queryByText(/bu kriterlere uygun mekan bulunamadı/i)).toBeFalsy();
    await act(async () => {
      resolveVenues({ data: [], meta: { next_cursor: null, has_more: false } });
      await Promise.resolve();
    });
  });

  it("lists venues returned by getVenues and navigates to detail on press", async () => {
    (getVenues as jest.Mock).mockResolvedValue({
      data: [
        { id: "v1", name: "Test Cafe", slug: "test-cafe", category: "cafe", priceRange: "MODERATE", isBoutique: true, editorialNote: null, googleRating: null, googleRatingCount: null },
      ],
      meta: { next_cursor: null, has_more: false },
    });

    await render(<DiscoveryScreen />);

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy(), { timeout: 5000 });
    fireEvent.press(screen.getByText("Test Cafe"));
    expect(mockNavigate).toHaveBeenCalledWith("VenueDetail", { slug: "test-cafe" });
  });

  it("filters by district when a district chip is pressed", async () => {
    (getVenues as jest.Mock).mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });

    await render(<DiscoveryScreen />);

    await waitFor(() => expect(screen.getByText("Kadıköy")).toBeTruthy(), { timeout: 5000 });
    fireEvent.press(screen.getByText("Kadıköy"));

    await waitFor(() =>
      expect(getVenues).toHaveBeenLastCalledWith(expect.objectContaining({ districtId: "d1" }), null),
    );
  });

  it("filters by category when a category chip is pressed", async () => {
    (getVenues as jest.Mock).mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });

    await render(<DiscoveryScreen />);

    await waitFor(() => expect(screen.getByText("Kahve")).toBeTruthy());
    fireEvent.press(screen.getByText("Kahve"));

    await waitFor(() =>
      expect(getVenues).toHaveBeenLastCalledWith(expect.objectContaining({ category: "cafe" }), null),
    );
  });

  it("filters by price range when a price chip is pressed", async () => {
    (getVenues as jest.Mock).mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });

    await render(<DiscoveryScreen />);

    await waitFor(() => expect(screen.getByText("₺₺")).toBeTruthy());
    fireEvent.press(screen.getByText("₺₺"));

    await waitFor(() =>
      expect(getVenues).toHaveBeenLastCalledWith(expect.objectContaining({ priceRange: "MODERATE" }), null),
    );
  });

  it("passes the current coords from useLocation to getVenues", async () => {
    (useLocation as jest.Mock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    (getVenues as jest.Mock).mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });

    await render(<DiscoveryScreen />);

    await waitFor(() =>
      expect(getVenues).toHaveBeenLastCalledWith(expect.any(Object), { lat: 40.99, lng: 29.02 }),
    );
  });

  it("does not let a slower, older request's response clobber a newer request's results", async () => {
    let resolveOld: (v: unknown) => void;
    const pendingOld = new Promise((resolve) => {
      resolveOld = resolve;
    });
    const NEW_VENUE = {
      id: "v-new", name: "New Result Cafe", slug: "new-result-cafe", category: "cafe",
      priceRange: "MODERATE", isBoutique: true, editorialNote: null, googleRating: null, googleRatingCount: null,
    };
    const OLD_VENUE = {
      id: "v-old", name: "Old Stale Cafe", slug: "old-stale-cafe", category: "cafe",
      priceRange: "MODERATE", isBoutique: true, editorialNote: null, googleRating: null, googleRatingCount: null,
    };

    (getVenues as jest.Mock)
      .mockReturnValueOnce(pendingOld) // initial request (coords=null), stays pending
      .mockResolvedValueOnce({ data: [NEW_VENUE], meta: { next_cursor: null, has_more: false } }); // newer request once coords resolve

    (useLocation as jest.Mock).mockReturnValue(null);

    const { rerender } = await render(<DiscoveryScreen />);

    // Simulate location permission resolving after mount -- coords changes, firing a newer request.
    (useLocation as jest.Mock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    await rerender(<DiscoveryScreen />);

    await waitFor(() => expect(screen.getByText("New Result Cafe")).toBeTruthy(), { timeout: 5000 });
    await waitFor(() => expect(getVenues).toHaveBeenCalledTimes(2));

    // Now resolve the old, slower request -- it must NOT overwrite the newer results.
    await act(async () => {
      resolveOld({ data: [OLD_VENUE], meta: { next_cursor: null, has_more: false } });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText("Old Stale Cafe")).toBeFalsy();
    expect(screen.getByText("New Result Cafe")).toBeTruthy();
  });

  it("clears the category filter when its already-selected chip is pressed again", async () => {
    (getVenues as jest.Mock).mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });

    await render(<DiscoveryScreen />);

    await waitFor(() => expect(screen.getByText("Kahve")).toBeTruthy());
    fireEvent.press(screen.getByText("Kahve"));

    await waitFor(() =>
      expect(getVenues).toHaveBeenLastCalledWith(expect.objectContaining({ category: "cafe" }), null),
    );

    fireEvent.press(screen.getByText("Kahve"));

    await waitFor(() =>
      expect(getVenues).toHaveBeenLastCalledWith(expect.not.objectContaining({ category: expect.anything() }), null),
    );
  });

  // §M1 audit finding: this tab's own header is hidden (TabNavigator.tsx), so nothing accounted
  // for the status bar/notch -- the district-chip row (this screen's first content) could render
  // half-hidden under it.
  it("pads its top by the device's real safe-area inset, not a fixed guess", async () => {
    (getVenues as jest.Mock).mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });
    (useSafeAreaInsets as jest.Mock).mockReturnValue({ top: 44, right: 0, bottom: 0, left: 0 });

    await render(<DiscoveryScreen />);

    expect(screen.getByTestId("discovery-root").props.style).toEqual(
      expect.objectContaining({ paddingTop: 44 }),
    );
  });

  // §M2 audit finding: the backend paginates /venues (has_more/next_cursor), but this screen
  // only ever showed the first page -- once a district's venue count passed the first page size,
  // the rest were permanently unreachable (no filter could surface them).
  describe("pagination (onEndReached)", () => {
    const PAGE_1_VENUE = {
      id: "v1", name: "First Page Cafe", slug: "first-page-cafe", category: "cafe",
      priceRange: "MODERATE", isBoutique: true, editorialNote: null, googleRating: null, googleRatingCount: null,
    };
    const PAGE_2_VENUE = {
      id: "v2", name: "Second Page Cafe", slug: "second-page-cafe", category: "cafe",
      priceRange: "MODERATE", isBoutique: true, editorialNote: null, googleRating: null, googleRatingCount: null,
    };

    it("fetches and appends the next page when the list end is reached and has_more is true", async () => {
      (getVenues as jest.Mock)
        .mockResolvedValueOnce({ data: [PAGE_1_VENUE], meta: { next_cursor: "cursor-1", has_more: true } })
        .mockResolvedValueOnce({ data: [PAGE_2_VENUE], meta: { next_cursor: null, has_more: false } });

      await render(<DiscoveryScreen />);
      await waitFor(() => expect(screen.getByText("First Page Cafe")).toBeTruthy(), { timeout: 5000 });

      await act(async () => {
        screen.getByTestId("venues-list").props.onEndReached();
      });

      await waitFor(() => expect(screen.getByText("Second Page Cafe")).toBeTruthy());
      expect(screen.getByText("First Page Cafe")).toBeTruthy();
      expect(getVenues).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "cursor-1" }), null);
    });

    // cross-model-review finding (MAJOR): FlatList can fire onEndReached more than once before
    // the first page's request resolves -- without an in-flight guard, both calls would pass the
    // same has_more/cursor check and fetch (and append) the same page twice.
    it("does not start a second fetch while the first onEndReached request is still in flight", async () => {
      let resolvePage2!: (v: unknown) => void;
      (getVenues as jest.Mock)
        .mockResolvedValueOnce({ data: [PAGE_1_VENUE], meta: { next_cursor: "cursor-1", has_more: true } })
        .mockReturnValueOnce(new Promise((resolve) => { resolvePage2 = resolve; }));

      await render(<DiscoveryScreen />);
      await waitFor(() => expect(screen.getByText("First Page Cafe")).toBeTruthy(), { timeout: 5000 });

      // Both calls happen synchronously (before either request can resolve), same as two
      // onEndReached firings in quick succession would on a real device.
      await act(async () => {
        screen.getByTestId("venues-list").props.onEndReached();
        screen.getByTestId("venues-list").props.onEndReached();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(getVenues).toHaveBeenCalledTimes(2); // 1 initial load + 1 page-2 fetch, not 2 page-2 fetches
      // Let the in-flight request settle fully before the test (and RNTL's implicit unmount)
      // ends -- otherwise its state updates can land after this test's own teardown, on
      // whatever component the NEXT test happens to have mounted by then.
      await act(async () => {
        resolvePage2({ data: [PAGE_2_VENUE], meta: { next_cursor: null, has_more: false } });
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => expect(screen.getByText("Second Page Cafe")).toBeTruthy());
    });

    it("does not fetch again once has_more is false", async () => {
      (getVenues as jest.Mock).mockResolvedValue({
        data: [PAGE_1_VENUE],
        meta: { next_cursor: null, has_more: false },
      });

      await render(<DiscoveryScreen />);
      await waitFor(() => expect(screen.getByText("First Page Cafe")).toBeTruthy(), { timeout: 5000 });
      const callsBefore = (getVenues as jest.Mock).mock.calls.length;

      await act(async () => {
        screen.getByTestId("venues-list").props.onEndReached();
      });

      expect((getVenues as jest.Mock).mock.calls.length).toBe(callsBefore);
    });

    it("resets to the first page's results when a filter changes mid-pagination", async () => {
      (getVenues as jest.Mock)
        .mockResolvedValueOnce({ data: [PAGE_1_VENUE], meta: { next_cursor: "cursor-1", has_more: true } })
        .mockResolvedValueOnce({ data: [PAGE_2_VENUE], meta: { next_cursor: null, has_more: false } })
        .mockResolvedValueOnce({ data: [], meta: { next_cursor: null, has_more: false } });

      await render(<DiscoveryScreen />);
      await waitFor(() => expect(screen.getByText("First Page Cafe")).toBeTruthy(), { timeout: 5000 });
      await act(async () => {
        screen.getByTestId("venues-list").props.onEndReached();
      });
      await waitFor(() => expect(screen.getByText("Second Page Cafe")).toBeTruthy());

      fireEvent.press(screen.getByText("Kahve"));

      await waitFor(() => expect(screen.queryByText("Second Page Cafe")).toBeFalsy());
      expect(screen.queryByText("First Page Cafe")).toBeFalsy();
    });
  });
});
