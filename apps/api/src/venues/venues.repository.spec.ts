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
