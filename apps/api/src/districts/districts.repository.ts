import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface NearestDistrictRow {
  id: string;
  name: string;
  cityId: string;
  slug: string;
}

@Injectable()
export class DistrictsRepository {
  constructor(private prisma: PrismaService) {}

  // ADR 002: all PostGIS raw SQL lives only in the repository layer, never in a service.
  async findNearestDistrict(lat: number, lng: number): Promise<NearestDistrictRow | undefined> {
    const rows = await this.prisma.$queryRaw<NearestDistrictRow[]>(
      Prisma.sql`
        SELECT d.id, d.name, d."cityId", d.slug
        FROM "District" d
        JOIN "Venue" v ON v."districtId" = d.id
        WHERE v.status = 'PUBLISHED'
        ORDER BY v.location <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        LIMIT 1
      `,
    );
    return rows[0];
  }
}
