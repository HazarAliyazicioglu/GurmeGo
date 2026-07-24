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
