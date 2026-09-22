import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import VenueDetailScreen from "./VenueDetailScreen";
import { getVenueBySlug } from "../lib/api";
import { useAuth } from "../lib/auth-context";

jest.mock("../lib/api", () => ({ getVenueBySlug: jest.fn() }));
jest.mock("../lib/auth-context", () => ({ useAuth: jest.fn() }));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useRoute: () => ({ params: { slug: "test-cafe" } }),
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock("react-native-maps", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: View, Marker: View };
});
jest.mock("../lib/env", () => ({ SITE_URL: "https://staging.gurmego.com" }));

const FULL_VENUE = {
  id: "v1", slug: "test-cafe", name: "Test Cafe", category: "cafe", cuisineType: "İtalyan",
  priceRange: "MODERATE", signatureItems: ["Flat white", "Cheesecake"], transportNote: "Metro Kadıköy'e 5 dk",
  openingHours: { mon: "09:00-22:00" }, editorialNote: "Sakin bir köşe.", isBoutique: true,
  verifiedAt: "2026-01-01T00:00:00.000Z", source: "MANUAL", googleRating: 4.5, googleRatingCount: 120,
  googlePlaceId: null, district: { name: "Kadıköy", slug: "kadikoy" }, lat: 40.99, lng: 29.02,
  address: "Moda Cd. No:1", photos: ["https://example.com/photo1.jpg"],
};

describe("VenueDetailScreen", () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, session: null });
  });

  it("fetches and shows the venue's name, price range, and editorial note", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue(FULL_VENUE);

    await render(<VenueDetailScreen />);

    // Default waitFor timeout (1000ms) is occasionally too short when the full suite runs many
    // test files concurrently (real async resolution + rerender under CPU contention) — same
    // scoped bump pattern used in DiscoveryScreen.spec.tsx for its VirtualizedList delay.
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy(), { timeout: 5000 });
    expect(screen.getByText("Sakin bir köşe.")).toBeTruthy();
    expect(getVenueBySlug).toHaveBeenCalledWith("test-cafe");
  });

  it("shows cuisine type, transport note, and address when present", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue(FULL_VENUE);

    await render(<VenueDetailScreen />);

    await waitFor(() => expect(screen.getByText("İtalyan")).toBeTruthy(), { timeout: 5000 });
    expect(screen.getByText("Metro Kadıköy'e 5 dk")).toBeTruthy();
    expect(screen.getByText("Moda Cd. No:1")).toBeTruthy();
  });

  it("shows each signature item", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue(FULL_VENUE);

    await render(<VenueDetailScreen />);

    await waitFor(() => expect(screen.getByText("Flat white")).toBeTruthy(), { timeout: 5000 });
    expect(screen.getByText("Cheesecake")).toBeTruthy();
  });

  it("does not crash and omits optional fields when they are null", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue({
      ...FULL_VENUE, cuisineType: null, transportNote: null, editorialNote: null, address: null, photos: [],
    });

    await render(<VenueDetailScreen />);

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy(), { timeout: 5000 });
  });

  it("shows boutique badge, Google rating, opening hours, and last-verified date", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue(FULL_VENUE);

    await render(<VenueDetailScreen />);

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy(), { timeout: 5000 });
    expect(screen.getByText(/butik/i)).toBeTruthy();
    expect(screen.getByText(/4\.5/)).toBeTruthy();
    expect(screen.getByText(/120/)).toBeTruthy();
    expect(screen.getByText(/09:00-22:00/)).toBeTruthy();
    expect(screen.getByText(/Son doğrulama/)).toBeTruthy();
  });

  it("omits Google rating when googleRating/googleRatingCount are null, and omits opening hours section when empty", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue({
      ...FULL_VENUE, googleRating: null, googleRatingCount: null, openingHours: {},
    });

    await render(<VenueDetailScreen />);

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy(), { timeout: 5000 });
    expect(screen.queryByText(/Google/)).toBeFalsy();
    expect(screen.queryByText(/09:00-22:00/)).toBeFalsy();
  });

  it("calls the native Share sheet with the venue name when the share button is pressed", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue(FULL_VENUE);
    const { Share } = require("react-native");
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction });

    await render(<VenueDetailScreen />);

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy(), { timeout: 5000 });
    fireEvent.press(screen.getByText("Paylaş"));

    expect(shareSpy).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Test Cafe") }));
  });

  // Denetim raporu §4.2 "Paylaşım linki her zaman gerçek (canlı) siteyi gösteriyor" -- was
  // hardcoded to https://gurmego.com regardless of environment. `../lib/env` is mocked (top of
  // file) to a DIFFERENT domain than the real default, so this only passes if the screen actually
  // reads SITE_URL from that module rather than a literal string.
  it("builds the share link from lib/env's SITE_URL, not a hardcoded domain", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue(FULL_VENUE);
    const { Share } = require("react-native");
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction });

    await render(<VenueDetailScreen />);

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy(), { timeout: 5000 });
    fireEvent.press(screen.getByText("Paylaş"));

    expect(shareSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("https://staging.gurmego.com/mekan/test-cafe") }),
    );
  });

  // Denetim raporu §4.2 "'Yol tarifi al' butonu bazen sessizce başarısız olabilir".
  it("shows an alert when opening the directions URL fails, instead of failing silently", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue(FULL_VENUE);
    const { Linking, Alert } = require("react-native");
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no maps app"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    await render(<VenueDetailScreen />);

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy(), { timeout: 5000 });
    fireEvent.press(screen.getByText("Buraya nasıl giderim"));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
  });
});

// §M3 audit finding: this screen previously rendered nothing at all while getVenueBySlug was
// in flight, or forever if it failed -- the user couldn't tell "still loading" from "crashed",
// and had no way to retry.
describe("VenueDetailScreen — loading and error states", () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, session: null });
    (getVenueBySlug as jest.Mock).mockReset();
  });

  it("shows a loading indicator while the venue is being fetched", async () => {
    let resolveVenue!: (v: unknown) => void;
    (getVenueBySlug as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveVenue = resolve; }));

    await render(<VenueDetailScreen />);

    expect(screen.getByTestId("venue-loading")).toBeTruthy();
    resolveVenue(FULL_VENUE);
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy());
  });

  it("shows a retry option instead of a blank screen when the fetch fails", async () => {
    (getVenueBySlug as jest.Mock).mockRejectedValue(new Error("network error"));

    await render(<VenueDetailScreen />);

    await waitFor(() => expect(screen.getByTestId("venue-error")).toBeTruthy());
    expect(screen.getByText(/Mekan yüklenemedi/)).toBeTruthy();
    expect(screen.getByText("Tekrar dene")).toBeTruthy();
  });

  it("retries the fetch and shows the venue when the retry button is pressed after a failure", async () => {
    (getVenueBySlug as jest.Mock).mockRejectedValueOnce(new Error("network error"));
    (getVenueBySlug as jest.Mock).mockResolvedValueOnce(FULL_VENUE);

    await render(<VenueDetailScreen />);
    await waitFor(() => expect(screen.getByTestId("venue-error")).toBeTruthy());

    fireEvent.press(screen.getByText("Tekrar dene"));

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy());
    expect(getVenueBySlug).toHaveBeenCalledTimes(2);
  });
});
