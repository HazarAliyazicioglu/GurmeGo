import { render, screen, waitFor } from "@testing-library/react-native";
import VenueDetailScreen from "./VenueDetailScreen";
import { getVenueBySlug } from "../lib/api";

jest.mock("../lib/api", () => ({ getVenueBySlug: jest.fn() }));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useRoute: () => ({ params: { slug: "test-cafe" } }),
}));
jest.mock("react-native-maps", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: View, Marker: View };
});

const FULL_VENUE = {
  id: "v1", slug: "test-cafe", name: "Test Cafe", category: "cafe", cuisineType: "İtalyan",
  priceRange: "MODERATE", signatureItems: ["Flat white", "Cheesecake"], transportNote: "Metro Kadıköy'e 5 dk",
  openingHours: { mon: "09:00-22:00" }, editorialNote: "Sakin bir köşe.", isBoutique: true,
  verifiedAt: "2026-01-01T00:00:00.000Z", source: "MANUAL", googleRating: 4.5, googleRatingCount: 120,
  googlePlaceId: null, district: { name: "Kadıköy", slug: "kadikoy" }, lat: 40.99, lng: 29.02,
  address: "Moda Cd. No:1", photos: ["https://example.com/photo1.jpg"],
};

describe("VenueDetailScreen", () => {
  it("fetches and shows the venue's name, price range, and editorial note", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue(FULL_VENUE);

    render(<VenueDetailScreen />);

    // Default waitFor timeout (1000ms) is occasionally too short when the full suite runs many
    // test files concurrently (real async resolution + rerender under CPU contention) — same
    // scoped bump pattern used in DiscoveryScreen.spec.tsx for its VirtualizedList delay.
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy(), { timeout: 5000 });
    expect(screen.getByText("Sakin bir köşe.")).toBeTruthy();
    expect(getVenueBySlug).toHaveBeenCalledWith("test-cafe");
  });

  it("shows cuisine type, transport note, and address when present", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue(FULL_VENUE);

    render(<VenueDetailScreen />);

    await waitFor(() => expect(screen.getByText("İtalyan")).toBeTruthy(), { timeout: 5000 });
    expect(screen.getByText("Metro Kadıköy'e 5 dk")).toBeTruthy();
    expect(screen.getByText("Moda Cd. No:1")).toBeTruthy();
  });

  it("shows each signature item", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue(FULL_VENUE);

    render(<VenueDetailScreen />);

    await waitFor(() => expect(screen.getByText("Flat white")).toBeTruthy(), { timeout: 5000 });
    expect(screen.getByText("Cheesecake")).toBeTruthy();
  });

  it("does not crash and omits optional fields when they are null", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue({
      ...FULL_VENUE, cuisineType: null, transportNote: null, editorialNote: null, address: null, photos: [],
    });

    render(<VenueDetailScreen />);

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy(), { timeout: 5000 });
  });
});
