import { describe, it, expect, vi } from "vitest";

const getDistrictsMock = vi.fn();
vi.mock("@/lib/api", () => ({ getDistricts: getDistrictsMock }));

// §L2 audit finding: the default district used to depend on whatever order the backend
// happened to return `/districts` in -- a silent, undocumented assumption. It's now an explicit
// constant, and (as a side effect) no longer needs a live backend to resolve, which is also what
// let this page be statically prerendered during `next build` without a running API.
describe("getDefaultDistrictSlug", () => {
  it("returns a fixed MVP default ('kadikoy') without calling the backend", async () => {
    const { getDefaultDistrictSlug } = await import("@/lib/discovery");
    const slug = await getDefaultDistrictSlug();
    expect(slug).toBe("kadikoy");
    expect(getDistrictsMock).not.toHaveBeenCalled();
  });
});
