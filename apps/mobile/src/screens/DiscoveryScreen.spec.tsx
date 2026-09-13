import { render, screen, waitFor, fireEvent, act } from "@testing-library/react-native";
import DiscoveryScreen from "./DiscoveryScreen";
import { getVenues, getDistricts } from "../lib/api";
import { useLocation } from "../lib/use-location";

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
});
