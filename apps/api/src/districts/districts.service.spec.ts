import { Test } from "@nestjs/testing";
import { DistrictsService } from "./districts.service";
import { PrismaService } from "../prisma/prisma.service";

describe("DistrictsService", () => {
  it("findAll returns districts for a city slug", async () => {
    const prisma = {
      district: { findMany: jest.fn().mockResolvedValue([{ id: "1", name: "Kadıköy" }]) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [DistrictsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const service = moduleRef.get(DistrictsService);

    const result = await service.findAll("istanbul");

    expect(prisma.district.findMany).toHaveBeenCalledWith({
      where: { city: { slug: "istanbul" } },
    });
    expect(result).toEqual([{ id: "1", name: "Kadıköy" }]);
  });

  it("findNearest picks the closest district by centroid distance", async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: "2", name: "Beşiktaş" }]),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [DistrictsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const service = moduleRef.get(DistrictsService);

    const result = await service.findNearest(41.04, 29.0);

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(result).toEqual({ id: "2", name: "Beşiktaş" });
  });
});
