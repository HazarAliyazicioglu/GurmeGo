import { describe, it, expect, vi, beforeEach } from "vitest";
import { getVenues } from "./api";
import { getAllPublishedVenueSlugs } from "./all-published-venues";

vi.mock("./api", () => ({ getVenues: vi.fn() }));

describe("getAllPublishedVenueSlugs", () => {
  beforeEach(() => {
    vi.mocked(getVenues).mockReset();
  });

  it("returns every venue's slug from a single page when has_more is false", async () => {
    vi.mocked(getVenues).mockResolvedValue({
      data: [{ slug: "a" }, { slug: "b" }],
      meta: { next_cursor: null, has_more: false },
    } as never);

    const slugs = await getAllPublishedVenueSlugs();

    expect(slugs).toEqual(["a", "b"]);
    expect(getVenues).toHaveBeenCalledTimes(1);
  });

  it("walks every page via cursor until has_more is false", async () => {
    vi.mocked(getVenues)
      .mockResolvedValueOnce({ data: [{ slug: "a" }], meta: { next_cursor: "c1", has_more: true } } as never)
      .mockResolvedValueOnce({ data: [{ slug: "b" }], meta: { next_cursor: "c2", has_more: true } } as never)
      .mockResolvedValueOnce({ data: [{ slug: "c" }], meta: { next_cursor: null, has_more: false } } as never);

    const slugs = await getAllPublishedVenueSlugs();

    expect(slugs).toEqual(["a", "b", "c"]);
    expect(getVenues).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: "c1" }));
    expect(getVenues).toHaveBeenNthCalledWith(3, expect.objectContaining({ cursor: "c2" }));
  });

  it("returns an empty list when there are no published venues", async () => {
    vi.mocked(getVenues).mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } } as never);

    const slugs = await getAllPublishedVenueSlugs();

    expect(slugs).toEqual([]);
  });
});
