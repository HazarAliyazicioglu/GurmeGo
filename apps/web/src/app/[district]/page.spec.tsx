import { describe, it, expect, vi } from "vitest";
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
  it("calls notFound() when params.district matches no known district slug", async () => {
    vi.mocked(getDistricts).mockResolvedValue([
      { id: "d1", slug: "kadikoy", name: "Kadıköy" },
    ] as never);
    vi.mocked(getVenues).mockResolvedValue({ data: [] } as never);

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
    vi.mocked(getVenues).mockResolvedValue({ data: [] } as never);

    await DiscoveryPage({ params: { district: "besiktas" } });

    expect(getVenues).toHaveBeenCalledWith({ districtId: "d2", sort: "newest" });
  });
});
