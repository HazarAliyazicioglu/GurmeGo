import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VenueCard } from "./venue-card";

import type { VenueListItem } from "@/lib/api";

const baseVenue = {
  id: "v1",
  name: "Cafe Test",
  slug: "cafe-test",
  category: "cafe",
  priceRange: "BUDGET",
  isBoutique: false,
  editorialNote: null,
  googleRating: 4.3,
  googleRatingCount: null,
  coverPhoto: null,
} satisfies VenueListItem;

describe("VenueCard — Google rating badge attribution text", () => {
  it("shows '4.3' and '· 120 Google yorumu' when a count is present", () => {
    // round-9 finding: the rating number and the attribution text render in two SEPARATE sibling
    // <span> elements (see the real markup below) -- a single getByText regex spanning both would
    // never match any one element's own text content. Assert each span separately instead.
    render(<VenueCard venue={{ ...baseVenue, googleRatingCount: 120 }} />);
    expect(screen.getByText("4.3")).toBeInTheDocument();
    expect(screen.getByText(/·\s*120 Google yorumu/)).toBeInTheDocument();
  });

  it("shows unlabeled 'Google yorumu' (no count) when googleRatingCount is null", () => {
    render(<VenueCard venue={{ ...baseVenue, googleRatingCount: null }} />);
    expect(screen.getByText(/Google yorumu/)).toBeInTheDocument();
    expect(screen.queryByText(/\d+ Google yorumu/)).not.toBeInTheDocument();
  });
});

describe("VenueCard — cover photo", () => {
  it("renders the cover photo when coverPhoto is present", () => {
    render(<VenueCard venue={{ ...baseVenue, coverPhoto: "https://cdn.example.com/photo1.jpg" }} />);
    const img = screen.getByRole("img", { name: `${baseVenue.name} fotoğrafı` });
    expect(img).toHaveAttribute("src", "https://cdn.example.com/photo1.jpg");
  });

  it("renders no image when coverPhoto is null (text-only layout preserved)", () => {
    render(<VenueCard venue={{ ...baseVenue, coverPhoto: null }} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
