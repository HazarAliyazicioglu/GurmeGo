import { Injectable } from "@nestjs/common";
import { VenueSource } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type DistrictGroupResult = {
  districtId: string;
  _count: number;
};

type SourceGroupResult = {
  source: VenueSource;
  _count: number;
};

@Injectable()
export class AdminReportsService {
  constructor(private prisma: PrismaService) {}

  async dataQuality() {
    const rawStaleDays = Number(process.env.RULES_STALE_DAYS ?? 90);
    const staleDays = isNaN(rawStaleDays) ? 90 : rawStaleDays;
    const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

    const [byDistrict, districts, staleCount, bySourceRaw] = await Promise.all([
      this.prisma.venue.groupBy({ by: ["districtId"], _count: true }),
      this.prisma.district.findMany(),
      this.prisma.venue.count({ where: { verifiedAt: { lt: cutoff } } }),
      this.prisma.venue.groupBy({ by: ["source"], _count: true }),
    ]);

    const districtMap = new Map(districts.map((d) => [d.id, d.name]));
    return {
      perDistrict: byDistrict.map((row: DistrictGroupResult) => ({ name: districtMap.get(row.districtId), count: row._count })),
      staleCount,
      bySource: bySourceRaw.map((row: SourceGroupResult) => ({ source: row.source, count: row._count })),
    };
  }
}
