import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { VenueDetail as VenueDetailType } from "@gurmego/shared";
import { VenueDetail } from "./venue-detail";

const venue: VenueDetailType = {
  id: "v1", slug: "test-cafe", name: "Test Cafe", category: "cafe", cuisineType: null,
  priceRange: "MODERATE", signatureItems: ["Latte"], transportNote: null,
  openingHours: { mon: "09:00-18:00" }, editorialNote: null, isBoutique: true,
  verifiedAt: "2026-01-01T00:00:00.000Z", source: "MANUAL",
  googleRating: null, googleRatingCount: null, googlePlaceId: null,
  district: { name: "Kadıköy", slug: "kadikoy" },
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
