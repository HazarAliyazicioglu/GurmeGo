import { Prisma } from "@prisma/client";
import { VenuesRepository } from "./venues.repository";
import { PrismaService } from "../prisma/prisma.service";

describe("VenuesRepository.searchPublished", () => {
  it("builds a distance-sorted query when lat/lng given and returns cursor", async () => {
    const rows = [
      { id: "v1", name: "A", slug: "a", distance_m: 120 },
      { id: "v2", name: "B", slug: "b", distance_m: 340 },
      { id: "v3", name: "C", slug: "c", distance_m: 560 },
    ];
    const prisma = { $queryRaw: jest.fn().mockResolvedValue(rows) } as unknown as PrismaService;
    const repo = new VenuesRepository(prisma);

    const result = await repo.searchPublished({
      lat: 40.99,
      lng: 29.02,
      radiusM: 3000,
      sort: "distance",
      limit: 2,
    } as any);

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
  });

  it("returns null cursor when fewer rows than limit", async () => {
    const rows = [{ id: "v1", name: "A", slug: "a", distance_m: 120 }];
    const prisma = { $queryRaw: jest.fn().mockResolvedValue(rows) } as unknown as PrismaService;
    const repo = new VenuesRepository(prisma);

    const result = await repo.searchPublished({ sort: "newest", limit: 20 } as any);

    expect(result.nextCursor).toBeNull();
  });
});

describe("VenuesRepository.updateWithLocation", () => {
  it("throws a clean error envelope when the venue does not exist (regression: no top-level message field)", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as unknown as PrismaService;
    const repo = new VenuesRepository(prisma);

    try {
      await repo.updateWithLocation("missing-id", { name: "New name" });
      throw new Error("expected updateWithLocation to throw");
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        error: { code: "VENUE_NOT_FOUND", message: "Mekan bulunamadı" },
      });
      expect(err.getResponse().message).toBeUndefined();
      expect(err.message).toBe("Mekan bulunamadı");
    }
  });
});

describe("VenuesRepository.findInBbox", () => {
  it("queries venues within the bounding box", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1", name: "A", location: {} }]) } as any;
    const repo = new VenuesRepository(prisma);

    const result = await repo.findInBbox([28.9, 40.9, 29.1, 41.1]);

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });
});
