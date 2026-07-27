import { Injectable } from "@nestjs/common";
import { VenueSource } from "@prisma/client";
import { stringify } from "csv-stringify/sync";
import { PrismaService } from "../../prisma/prisma.service";
import { getStaleDays } from "../../common/rule-config";

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
    const staleDays = getStaleDays();
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

  async exportVenues(format: "json" | "csv"): Promise<string> {
    const venues = await this.prisma.venue.findMany({ where: { status: "PUBLISHED" } });
    if (format === "json") return JSON.stringify(venues);
    return stringify(venues, { header: true });
  }
}
