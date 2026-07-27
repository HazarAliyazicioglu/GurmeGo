import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { VenueDetail as VenueDetailType } from "@gurmego/shared";
import { VenueDetail } from "./venue-detail";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: null, session: null, loading: false }) }));
const venueMapMock = vi.fn(
  ({ center, focusVenue }: { center: [number, number]; focusVenue?: { lat: number; lng: number } }) => {
    const effectiveCenter = focusVenue ? [focusVenue.lat, focusVenue.lng] : center;
    return <div data-testid="map-container" data-center={effectiveCenter.join(",")} />;
  },
);

vi.mock("@/components/venue-map", () => ({
  VenueMap: (props: { center: [number, number]; focusVenue?: { lat: number; lng: number } }) =>
    venueMapMock(props),
}));

const venue: VenueDetailType = {
  id: "v1", slug: "test-cafe", name: "Test Cafe", category: "cafe", cuisineType: null,
  priceRange: "MODERATE", signatureItems: ["Latte"], transportNote: null,
  openingHours: { mon: "09:00-18:00" }, editorialNote: null, isBoutique: true,
  verifiedAt: "2026-01-01T00:00:00.000Z", source: "MANUAL",
  googleRating: null, googleRatingCount: null, googlePlaceId: null,
  district: { name: "Kadıköy", slug: "kadikoy" },
  lat: 40.99, lng: 29.02, address: null, photos: [],
};

describe("VenueDetail", () => {
  it("renders a directions link built from name + district", () => {
    render(<VenueDetail venue={venue} />);
    const link = screen.getByTestId("directions-link") as HTMLAnchorElement;
    expect(link.href).toContain("Test%20Cafe%20Kad");
    expect(link.href).toContain("maps/dir");
  });

  it("renders a WhatsApp share button", () => {
    render(<VenueDetail venue={venue} />);
    const link = screen.getByTestId("whatsapp-share") as HTMLAnchorElement;
    expect(link.href).toContain("wa.me");
  });
});

describe("VenueDetail — address, single-marker map, photo grid (net-new section, existing decorative directions section untouched)", () => {
  const baseVenue: VenueDetailType = {
    ...venue,
    address: "Bahariye Cd. No:1",
    lat: 40.99,
    lng: 29.02,
    photos: ["https://x/1.jpg", "https://x/2.jpg"],
  };

  it("renders the venue's address when present", () => {
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.getByText("Bahariye Cd. No:1")).toBeInTheDocument();
  });

  it("does not render an address section when address is null", () => {
    render(<VenueDetail venue={{ ...baseVenue, address: null }} />);
    expect(screen.queryByTestId("venue-address")).not.toBeInTheDocument();
  });

  it("still renders the existing 'Sıradaki durak' directions section unchanged", () => {
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.getByTestId("directions-link")).toBeInTheDocument();
  });

  it("renders the new map focused on the venue's real coordinates", () => {
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.getByTestId("map-container")).toHaveAttribute("data-center", "40.99,29.02");
  });

  it("passes a focusVenue prop (not just a matching center) to VenueMap, proving single-marker mode is engaged", () => {
    venueMapMock.mockClear();
    render(<VenueDetail venue={baseVenue} />);
    expect(venueMapMock).toHaveBeenCalledWith(
      expect.objectContaining({
        focusVenue: {
          id: baseVenue.id,
          name: baseVenue.name,
          slug: baseVenue.slug,
          category: baseVenue.category,
          lat: baseVenue.lat,
          lng: baseVenue.lng,
        },
      }),
    );
  });

  it("renders a photo grid using real <img> elements", () => {
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.getAllByRole("img", { name: new RegExp(baseVenue.name) })).toHaveLength(2);
  });

  it("renders an empty state when photos is empty", () => {
    render(<VenueDetail venue={{ ...baseVenue, photos: [] }} />);
    expect(screen.getByText(/henüz fotoğraf eklenmedi/i)).toBeInTheDocument();
  });
});
