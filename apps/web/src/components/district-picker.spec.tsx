import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { DistrictPicker } from "./district-picker";
import type { District } from "@gurmego/shared";

const getNearestDistrict = vi.fn();
const useGeolocation = vi.fn();

vi.mock("@/lib/api", () => ({
  getNearestDistrict: (...args: unknown[]) => getNearestDistrict(...args),
}));
vi.mock("@/lib/use-geolocation", () => ({
  useGeolocation: () => useGeolocation(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const DISTRICTS: District[] = [
  { id: "d1", cityId: "c1", name: "Kadıköy", slug: "kadikoy" },
  { id: "d2", cityId: "c1", name: "Beşiktaş", slug: "besiktas" },
];

describe("DistrictPicker — getNearestDistrict call site", () => {
  beforeEach(() => {
    getNearestDistrict.mockReset();
    useGeolocation.mockReset();
  });

  it("calls getNearestDistrict with a single coords object, not two number arguments", async () => {
    useGeolocation.mockReturnValue({ lat: 40.99, lng: 29.02 });
    getNearestDistrict.mockResolvedValue({ id: "d2", cityId: "c1", name: "Beşiktaş", slug: "besiktas" });

    render(<DistrictPicker districts={DISTRICTS} current="kadikoy" />);

    await waitFor(() => expect(getNearestDistrict).toHaveBeenCalledWith({ lat: 40.99, lng: 29.02 }));
  });

  it("does not call getNearestDistrict when coords are unavailable", () => {
    useGeolocation.mockReturnValue(null);
    render(<DistrictPicker districts={DISTRICTS} current="kadikoy" />);
    expect(getNearestDistrict).not.toHaveBeenCalled();
  });
});
