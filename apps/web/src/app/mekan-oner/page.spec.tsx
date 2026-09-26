import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MekanOnerPage from "./page";

const getDistricts = vi.fn();
vi.mock("@/lib/api", () => ({ getDistricts: (...args: unknown[]) => getDistricts(...args) }));
vi.mock("@/components/suggest-venue-form", () => ({
  SuggestVenueForm: ({ districts }: { districts: Array<{ name: string }> }) => (
    <div data-testid="suggest-form">{districts.map((d) => d.name).join(",")}</div>
  ),
}));

describe("MekanOnerPage", () => {
  it("fetches districts and passes them to the form", async () => {
    getDistricts.mockResolvedValue([{ id: "d1", cityId: "c1", name: "Kadıköy", slug: "kadikoy" }]);
    const jsx = await MekanOnerPage();
    render(jsx);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/mekan öner/i);
    expect(screen.getByTestId("suggest-form")).toHaveTextContent("Kadıköy");
  });
});
