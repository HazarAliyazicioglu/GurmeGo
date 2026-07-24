import { Test } from "@nestjs/testing";
import { DistrictsService } from "./districts.service";
import { DistrictsRepository } from "./districts.repository";
import { PrismaService } from "../prisma/prisma.service";

describe("DistrictsService", () => {
  it("findAll returns districts for a city slug", async () => {
    const prisma = {
      district: { findMany: jest.fn().mockResolvedValue([{ id: "1", name: "Kadıköy" }]) },
    };
    const repo = { findNearestDistrict: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        DistrictsService,
        { provide: PrismaService, useValue: prisma },
        { provide: DistrictsRepository, useValue: repo },
      ],
    }).compile();
    const service = moduleRef.get(DistrictsService);

    const result = await service.findAll("istanbul");

    expect(prisma.district.findMany).toHaveBeenCalledWith({
      where: { city: { slug: "istanbul" } },
    });
    expect(result).toEqual([{ id: "1", name: "Kadıköy" }]);
  });

  it("findNearest delegates to the repository and returns the closest district", async () => {
    const prisma = { district: { findMany: jest.fn() } };
    const repo = { findNearestDistrict: jest.fn().mockResolvedValue({ id: "2", name: "Beşiktaş" }) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        DistrictsService,
        { provide: PrismaService, useValue: prisma },
        { provide: DistrictsRepository, useValue: repo },
      ],
    }).compile();
    const service = moduleRef.get(DistrictsService);

    const result = await service.findNearest(41.04, 29.0);

    expect(repo.findNearestDistrict).toHaveBeenCalledWith(41.04, 29.0);
    expect(result).toEqual({ id: "2", name: "Beşiktaş" });
  });
});
