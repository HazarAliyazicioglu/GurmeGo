import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VenueList } from "./venue-list";
import type { VenueListItem } from "@/lib/api";

const VENUE: VenueListItem = {
  id: "v1", name: "Test Cafe", slug: "test-cafe", category: "cafe", priceRange: "BUDGET", isBoutique: true,
  googleRating: 4.5, googleRatingCount: 10, coverPhoto: null,
} as VenueListItem;

describe("VenueList", () => {
  it("renders the venue cards when there are results", () => {
    render(<VenueList venues={[VENUE]} />);
    expect(screen.getByTestId("venue-list")).toBeInTheDocument();
    expect(screen.queryByTestId("empty-state")).toBeNull();
  });

  it("shows the empty state with a link to suggest the venue when there are no results", () => {
    render(<VenueList venues={[]} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /mekan öner/i })).toHaveAttribute("href", "/mekan-oner");
  });
});
