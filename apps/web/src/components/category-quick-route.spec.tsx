import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryQuickRoute } from "./category-quick-route";
import type { VenueListItem } from "@/lib/api";

// Final-review Finding 2: `QUICK_CATEGORIES` used to be `["kahve", "tatli", "kahvalti"]`, none of
// which ever match a real venue's `category` (real values: "cafe" | "restaurant" | "bakery" |
// "street-food" — see `apps/api/prisma/seed.ts`), so every quick-route button silently returned
// zero results. This locks in the real values and their Turkish labels.
describe("CategoryQuickRoute", () => {
  it("renders buttons for real backend category values with matching Turkish labels", () => {
    render(<CategoryQuickRoute venues={[]} districtName="Kadıköy" sortedByDistance={false} onSelectCategory={vi.fn()} />);
    expect(screen.getByTestId("quick-category-cafe")).toHaveTextContent("Kahve");
    expect(screen.getByTestId("quick-category-bakery")).toHaveTextContent("Fırın");
    expect(screen.getByTestId("quick-category-restaurant")).toHaveTextContent("Restoran");
    expect(screen.queryByTestId("quick-category-kahve")).toBeNull();
    expect(screen.queryByTestId("quick-category-tatli")).toBeNull();
    expect(screen.queryByTestId("quick-category-kahvalti")).toBeNull();
  });

  it("calls onSelectCategory with the real category value when clicked", () => {
    const onSelectCategory = vi.fn();
    render(<CategoryQuickRoute venues={[]} districtName="Kadıköy" sortedByDistance={false} onSelectCategory={onSelectCategory} />);
    fireEvent.click(screen.getByTestId("quick-category-bakery"));
    expect(onSelectCategory).toHaveBeenCalledWith("bakery");
  });

  it("reflects activeCategory as the pressed button", () => {
    render(<CategoryQuickRoute venues={[]} districtName="Kadıköy" sortedByDistance={false} activeCategory="restaurant" onSelectCategory={vi.fn()} />);
    expect(screen.getByTestId("quick-category-restaurant")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("quick-category-cafe")).toHaveAttribute("aria-pressed", "false");
  });
});

// `satisfies VenueListItem[]` (not a bare array literal) prevents TypeScript from widening
// `priceRange: "BUDGET"` to `string` — round-9 finding — which would otherwise fail to satisfy
// this component's real, narrower `venues: VenueListItem[]` prop type.
const venues = [{ id: "v1", name: "First Cafe", slug: "first-cafe", category: "cafe", priceRange: "BUDGET", isBoutique: true, editorialNote: null, googleRating: null, googleRatingCount: null }] satisfies VenueListItem[];

describe("CategoryQuickRoute — widened contract: venues, districtName, sortedByDistance, deselect", () => {
  it("calls onSelectCategory(category), then renders a directions link once re-rendered with the new activeCategory, labeled 'En yakın' when sortedByDistance is true", () => {
    const onSelectCategory = vi.fn();
    const { rerender } = render(<CategoryQuickRoute venues={venues} districtName="Kadıköy" sortedByDistance onSelectCategory={onSelectCategory} activeCategory={undefined} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    expect(onSelectCategory).toHaveBeenCalledWith("cafe");
    rerender(<CategoryQuickRoute venues={venues} districtName="Kadıköy" sortedByDistance onSelectCategory={onSelectCategory} activeCategory="cafe" />);
    const link = screen.getByRole("link", { name: /en yakın cafe mekana git/i });
    expect(link).toHaveAttribute("href", expect.stringContaining(encodeURIComponent("First Cafe Kadıköy")));
  });

  it("uses neutral copy when sortedByDistance is false", () => {
    const onSelectCategory = vi.fn();
    const { rerender } = render(<CategoryQuickRoute venues={venues} districtName="Kadıköy" sortedByDistance={false} onSelectCategory={onSelectCategory} activeCategory={undefined} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    rerender(<CategoryQuickRoute venues={venues} districtName="Kadıköy" sortedByDistance={false} onSelectCategory={onSelectCategory} activeCategory="cafe" />);
    expect(screen.getByRole("link", { name: /cafe mekana git/i })).toBeInTheDocument();
    expect(screen.queryByText(/en yakın/i)).not.toBeInTheDocument();
  });

  it("renders no directions link when no venue matches the active category", () => {
    render(<CategoryQuickRoute venues={[]} districtName="Kadıköy" sortedByDistance onSelectCategory={vi.fn()} activeCategory="cafe" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("calls onSelectCategory(undefined) when the already-active category is clicked again", () => {
    const onSelectCategory = vi.fn();
    render(<CategoryQuickRoute venues={venues} districtName="Kadıköy" sortedByDistance onSelectCategory={onSelectCategory} activeCategory="cafe" />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    expect(onSelectCategory).toHaveBeenCalledWith(undefined);
  });
});
