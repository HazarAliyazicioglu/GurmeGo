import { AdminReportsService } from "./admin-reports.service";

describe("AdminReportsService.dataQuality", () => {
  it("aggregates venue counts per district, stale count, and source breakdown", async () => {
    const prisma = {
      venue: {
        groupBy: jest.fn()
          .mockResolvedValueOnce([{ districtId: "d1", _count: 12 }])
          .mockResolvedValueOnce([{ source: "MANUAL", _count: 12 }]),
        count: jest.fn().mockResolvedValue(3),
      },
      district: { findMany: jest.fn().mockResolvedValue([{ id: "d1", name: "Kadıköy" }]) },
    } as any;
    const service = new AdminReportsService(prisma);

    const result = await service.dataQuality();

    expect(result.perDistrict).toEqual([{ name: "Kadıköy", count: 12 }]);
    expect(result.staleCount).toBe(3);
    expect(result.bySource).toEqual([{ source: "MANUAL", count: 12 }]);
  });
});
