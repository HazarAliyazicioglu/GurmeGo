import { describe, it, expect, vi } from "vitest";
import { getDefaultDistrictSlug } from "@/lib/discovery";

vi.mock("@/lib/api", () => ({
  getDistricts: vi.fn().mockResolvedValue([{ slug: "kadikoy", name: "Kadıköy" }]),
}));

describe("getDefaultDistrictSlug", () => {
  it("returns the first district's slug as the MVP default", async () => {
    const slug = await getDefaultDistrictSlug();
    expect(slug).toBe("kadikoy");
  });
});
