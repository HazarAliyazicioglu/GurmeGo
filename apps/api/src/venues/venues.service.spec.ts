import { VenuesService } from "./venues.service";
import { VenuesRepository } from "./venues.repository";

describe("VenuesService.list", () => {
  it("wraps repository result in the API envelope", async () => {
    const repo = {
      searchPublished: jest.fn().mockResolvedValue({ items: [{ id: "v1" }], nextCursor: "abc" }),
    } as unknown as VenuesRepository;
    const service = new VenuesService(repo);

    const result = await service.list({ sort: "newest", limit: 20 } as any);

    expect(result).toEqual({
      data: [{ id: "v1" }],
      meta: { next_cursor: "abc", has_more: true },
    });
  });
});

describe("VenuesService.list — sort default", () => {
  it("defaults to distance when location is provided and sort is unset", async () => {
    const repo = { searchPublished: jest.fn().mockResolvedValue({ items: [], nextCursor: null }) } as any;
    await new VenuesService(repo).list({ limit: 20 } as any, { lat: 40.99, lng: 29.02 });
    expect(repo.searchPublished).toHaveBeenCalledWith(expect.objectContaining({ sort: "distance", lat: 40.99, lng: 29.02 }));
  });
  it("defaults to newest when no location is provided", async () => {
    const repo = { searchPublished: jest.fn().mockResolvedValue({ items: [], nextCursor: null }) } as any;
    await new VenuesService(repo).list({ limit: 20 } as any, undefined);
    expect(repo.searchPublished).toHaveBeenCalledWith(expect.objectContaining({ sort: "newest" }));
  });
  it("an explicit sort=distance with no header still reaches the repository as sort=distance -- the repository's own hasLocation guard (Step 3) is what actually falls back to createdAt ordering, not this service", async () => {
    const repo = { searchPublished: jest.fn().mockResolvedValue({ items: [], nextCursor: null }) } as any;
    await new VenuesService(repo).list({ limit: 20, sort: "distance" } as any, undefined);
    expect(repo.searchPublished).toHaveBeenCalledWith(expect.objectContaining({ sort: "distance", lat: undefined, lng: undefined }));
  });
});

describe("VenuesService.detail", () => {
  it("throws NotFoundException when venue missing", async () => {
    const repo = { findBySlug: jest.fn().mockResolvedValue(null) } as unknown as VenuesRepository;
    const service = new VenuesService(repo);

    await expect(service.detail("missing-slug")).rejects.toThrow("Mekan bulunamadı");
  });

  it("returns venue detail when found", async () => {
    const venue = { id: "v1", slug: "a", name: "A" };
    const repo = { findBySlug: jest.fn().mockResolvedValue(venue) } as unknown as VenuesRepository;
    const service = new VenuesService(repo);

    const result = await service.detail("a");

    expect(result).toEqual(venue);
  });
});
