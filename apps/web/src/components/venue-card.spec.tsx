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
