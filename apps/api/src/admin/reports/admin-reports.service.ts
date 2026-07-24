import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AdminReportsService {
  constructor(private prisma: PrismaService) {}

  async dataQuality() {
    const staleDays = Number(process.env.RULES_STALE_DAYS ?? 90);
    const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

    const [byDistrict, districts, staleCount, bySourceRaw] = await Promise.all([
      this.prisma.venue.groupBy({ by: ["districtId"], _count: true }),
      this.prisma.district.findMany(),
      this.prisma.venue.count({ where: { verifiedAt: { lt: cutoff } } }),
      this.prisma.venue.groupBy({ by: ["source"], _count: true }),
    ]);

    const districtMap = new Map(districts.map((d) => [d.id, d.name]));
    return {
      perDistrict: byDistrict.map((row: any) => ({ name: districtMap.get(row.districtId), count: row._count })),
      staleCount,
      bySource: bySourceRaw.map((row: any) => ({ source: row.source, count: row._count })),
    };
  }
}
