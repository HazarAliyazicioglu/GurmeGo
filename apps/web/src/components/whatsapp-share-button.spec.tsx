import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { VenueDetail as VenueDetailType } from "@gurmego/shared";
import { WhatsappShareButton, whatsappShareUrl } from "./whatsapp-share-button";

const venue: VenueDetailType = {
  id: "v1", slug: "test-cafe", name: "Test Cafe", category: "cafe", cuisineType: null,
  priceRange: "MODERATE", signatureItems: ["Latte"], transportNote: null,
  openingHours: { mon: "09:00-18:00" }, editorialNote: null, isBoutique: true,
  verifiedAt: "2026-01-01T00:00:00.000Z", source: "MANUAL",
  googleRating: null, googleRatingCount: null, googlePlaceId: null,
  district: { name: "Kadıköy", slug: "kadikoy" },
  lat: 40.99, lng: 29.02, address: null, photos: [],
};

describe("whatsappShareUrl", () => {
  it("builds a wa.me link containing the venue name and the given URL", () => {
    const url = whatsappShareUrl(venue, "https://gurmego.app/mekan/test-cafe?utm=x");
    expect(url).toContain("wa.me");
    expect(decodeURIComponent(url)).toContain("Test Cafe");
    expect(decodeURIComponent(url)).toContain("https://gurmego.app/mekan/test-cafe?utm=x");
  });
});

describe("WhatsappShareButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens a wa.me link built from window.location.href only on click, not during render", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<WhatsappShareButton venue={venue} />);

    expect(openSpy).not.toHaveBeenCalled();

    const link = screen.getByTestId("whatsapp-share");
    fireEvent.click(link);

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [openedUrl] = openSpy.mock.calls[0];
    expect(String(openedUrl)).toContain("wa.me");
    expect(decodeURIComponent(String(openedUrl))).toContain(window.location.href);
  });
});
