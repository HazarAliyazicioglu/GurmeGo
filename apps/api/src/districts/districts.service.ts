import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DistrictsService {
  constructor(private prisma: PrismaService) {}

  findAll(citySlug: string) {
    return this.prisma.district.findMany({ where: { city: { slug: citySlug } } });
  }

  async findNearest(lat: number, lng: number) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; name: string }>>(
      Prisma.sql`
        SELECT d.id, d.name
        FROM "District" d
        JOIN "Venue" v ON v."districtId" = d.id
        ORDER BY v.location <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        LIMIT 1
      `,
    );
    return rows[0];
  }
}
