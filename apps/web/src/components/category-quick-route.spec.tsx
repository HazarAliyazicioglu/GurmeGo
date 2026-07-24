import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryQuickRoute } from "./category-quick-route";

// Final-review Finding 2: `QUICK_CATEGORIES` used to be `["kahve", "tatli", "kahvalti"]`, none of
// which ever match a real venue's `category` (real values: "cafe" | "restaurant" | "bakery" |
// "street-food" — see `apps/api/prisma/seed.ts`), so every quick-route button silently returned
// zero results. This locks in the real values and their Turkish labels.
describe("CategoryQuickRoute", () => {
  it("renders buttons for real backend category values with matching Turkish labels", () => {
    render(<CategoryQuickRoute onSelectCategory={vi.fn()} />);
    expect(screen.getByTestId("quick-category-cafe")).toHaveTextContent("Kahve");
    expect(screen.getByTestId("quick-category-bakery")).toHaveTextContent("Fırın");
    expect(screen.getByTestId("quick-category-restaurant")).toHaveTextContent("Restoran");
    expect(screen.queryByTestId("quick-category-kahve")).toBeNull();
    expect(screen.queryByTestId("quick-category-tatli")).toBeNull();
    expect(screen.queryByTestId("quick-category-kahvalti")).toBeNull();
  });

  it("calls onSelectCategory with the real category value when clicked", () => {
    const onSelectCategory = vi.fn();
    render(<CategoryQuickRoute onSelectCategory={onSelectCategory} />);
    fireEvent.click(screen.getByTestId("quick-category-bakery"));
    expect(onSelectCategory).toHaveBeenCalledWith("bakery");
  });

  it("reflects activeCategory as the pressed button", () => {
    render(<CategoryQuickRoute activeCategory="restaurant" onSelectCategory={vi.fn()} />);
    expect(screen.getByTestId("quick-category-restaurant")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("quick-category-cafe")).toHaveAttribute("aria-pressed", "false");
  });
});
