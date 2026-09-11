import { render, screen, waitFor, fireEvent, act } from "@testing-library/react-native";
import DiscoveryScreen from "./DiscoveryScreen";
import { getVenues, getDistricts } from "../lib/api";
import { useLocation } from "../lib/use-location";

jest.mock("../lib/api", () => ({
  getVenues: jest.fn(),
  getDistricts: jest.fn(),
}));
jest.mock("../lib/use-location", () => ({ useLocation: jest.fn() }));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// Every test here mounts a tree containing two real VirtualizedLists whose data arrives
// asynchronously (districts, from the mocked getDistricts() promise via useEffect+setDistricts;
// venues, from getVenues() the same way) -- on a slow/shared CI runner, VirtualizedList's own
// internal setTimeout-based initial-cell-render deferral (a fixed 1240ms was observed for the
// venues list) can eat into a test's whole budget even for assertions that don't themselves touch
// either list (e.g. asserting on static CATEGORIES/PRICE_RANGES text, or on a mock's call args).
// apps/mobile/package.json's package-level `jest.testTimeout: 15000` (vs. Jest's 5000ms default)
// covers the overall per-test budget; the three `waitFor` calls below whose OWN target text lives
// inside one of those two async-fed lists (the first venue-list test, the district-filter test,
// and the stale-request race test) additionally need their own `{ timeout: 5000 }` bump, since
// waitFor's default internal timeout (1000ms) is shorter than the observed render delay.
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

    render(<DiscoveryScreen />);

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy(), { timeout: 5000 });
    fireEvent.press(screen.getByText("Test Cafe"));
    expect(mockNavigate).toHaveBeenCalledWith("VenueDetail", { slug: "test-cafe" });
  });

  it("filters by district when a district chip is pressed", async () => {
    (getVenues as jest.Mock).mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });

    render(<DiscoveryScreen />);

    await waitFor(() => expect(screen.getByText("Kadıköy")).toBeTruthy(), { timeout: 5000 });
    fireEvent.press(screen.getByText("Kadıköy"));

    await waitFor(() =>
      expect(getVenues).toHaveBeenLastCalledWith(expect.objectContaining({ districtId: "d1" }), null),
    );
  });

  it("filters by category when a category chip is pressed", async () => {
    (getVenues as jest.Mock).mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });

    render(<DiscoveryScreen />);

    await waitFor(() => expect(screen.getByText("Kahve")).toBeTruthy());
    fireEvent.press(screen.getByText("Kahve"));

    await waitFor(() =>
      expect(getVenues).toHaveBeenLastCalledWith(expect.objectContaining({ category: "cafe" }), null),
    );
  });

  it("filters by price range when a price chip is pressed", async () => {
    (getVenues as jest.Mock).mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });

    render(<DiscoveryScreen />);

    await waitFor(() => expect(screen.getByText("₺₺")).toBeTruthy());
    fireEvent.press(screen.getByText("₺₺"));

    await waitFor(() =>
      expect(getVenues).toHaveBeenLastCalledWith(expect.objectContaining({ priceRange: "MODERATE" }), null),
    );
  });

  it("passes the current coords from useLocation to getVenues", async () => {
    (useLocation as jest.Mock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    (getVenues as jest.Mock).mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });

    render(<DiscoveryScreen />);

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
