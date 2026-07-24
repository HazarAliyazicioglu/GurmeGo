import { DistrictsRepository } from "./districts.repository";
import { PrismaService } from "../prisma/prisma.service";

describe("DistrictsRepository.findNearestDistrict", () => {
  it("queries the closest district by PostGIS distance and returns the first row", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ id: "2", name: "Beşiktaş" }]) } as unknown as PrismaService;
    const repo = new DistrictsRepository(prisma);

    const result = await repo.findNearestDistrict(41.04, 29.0);

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(result).toEqual({ id: "2", name: "Beşiktaş" });
  });

  it("returns undefined when no district is found", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as unknown as PrismaService;
    const repo = new DistrictsRepository(prisma);

    const result = await repo.findNearestDistrict(41.04, 29.0);

    expect(result).toBeUndefined();
  });
});
