import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { getDistricts, getVenues } from "@/lib/api";
import DiscoveryPage from "./page";

vi.mock("@/lib/api", () => ({
  getDistricts: vi.fn(),
  getVenues: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/components/district-picker", () => ({
  DistrictPicker: () => null,
}));

describe("DiscoveryPage", () => {
  beforeEach(() => {
    vi.mocked(getDistricts).mockReset();
    vi.mocked(getVenues).mockReset();
    vi.mocked(notFound).mockClear();
  });

  it("calls notFound() when params.district matches no known district slug", async () => {
    vi.mocked(getDistricts).mockResolvedValue([
      { id: "d1", slug: "kadikoy", name: "Kadıköy" },
    ] as never);
    vi.mocked(getVenues).mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } } as never);

    await expect(
      DiscoveryPage({ params: { district: "unknown-district" } }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalled();
  });

  it("calls getVenues with the matched district's id and newest sort", async () => {
    vi.mocked(getDistricts).mockResolvedValue([
      { id: "d1", slug: "kadikoy", name: "Kadıköy" },
      { id: "d2", slug: "besiktas", name: "Beşiktaş" },
    ] as never);
    vi.mocked(getVenues).mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } } as never);

    await DiscoveryPage({ params: { district: "besiktas" } });

    expect(getVenues).toHaveBeenCalledWith({ districtId: "d2", sort: "newest" });
  });
});

describe("DiscoveryPage — forwards SSR pagination metadata to DiscoveryClient (final-review Major 1)", () => {
  beforeEach(() => {
    vi.mocked(getDistricts).mockReset();
    vi.mocked(getVenues).mockReset();
  });

  it("shows the 'Load more' button on initial render when the server-side fetch's meta reports has_more: true, with no client-side fetch required", async () => {
    vi.mocked(getDistricts).mockResolvedValue([{ id: "d1", slug: "kadikoy", name: "Kadıköy" }] as never);
    vi.mocked(getVenues).mockResolvedValue({
      data: [
        { id: "v1", name: "First", slug: "first", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: null, googleRatingCount: null },
      ],
      meta: { next_cursor: "cursor-1", has_more: true },
    } as never);

    const page = await DiscoveryPage({ params: { district: "kadikoy" } });
    render(page);

    // No further `getVenues` call should have been necessary for the button to show up.
    expect(getVenues).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("load-more")).toBeInTheDocument();
  });

  it("does not show the 'Load more' button when the server-side fetch's meta reports has_more: false", async () => {
    vi.mocked(getDistricts).mockResolvedValue([{ id: "d1", slug: "kadikoy", name: "Kadıköy" }] as never);
    vi.mocked(getVenues).mockResolvedValue({
      data: [],
      meta: { next_cursor: null, has_more: false },
    } as never);

    const page = await DiscoveryPage({ params: { district: "kadikoy" } });
    render(page);

    expect(screen.queryByTestId("load-more")).not.toBeInTheDocument();
  });
});
