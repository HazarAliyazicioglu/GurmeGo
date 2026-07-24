import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { VenueListQuery } from "@gurmego/shared";

interface VenueRow {
  id: string;
  name: string;
  slug: string;
  distance_m?: number;
}

@Injectable()
export class VenuesRepository {
  constructor(private prisma: PrismaService) {}

  async searchPublished(filters: VenueListQuery) {
    const conditions: Prisma.Sql[] = [Prisma.sql`v.status = 'PUBLISHED'`];
    if (filters.districtId) conditions.push(Prisma.sql`v."districtId" = ${filters.districtId}`);
    if (filters.category) conditions.push(Prisma.sql`v.category = ${filters.category}`);
    if (filters.priceRange) conditions.push(Prisma.sql`v."priceRange" = ${filters.priceRange}::"PriceRange"`);
    if (filters.isBoutique !== undefined) conditions.push(Prisma.sql`v."isBoutique" = ${filters.isBoutique}`);

    const where = Prisma.join(conditions, " AND ");
    const limit = filters.limit ?? 20;

    const distanceSelect =
      filters.lat && filters.lng
        ? Prisma.sql`, ST_Distance(v.location, ST_SetSRID(ST_MakePoint(${filters.lng}, ${filters.lat}), 4326)::geography) AS distance_m`
        : Prisma.sql``;

    const radiusFilter =
      filters.lat && filters.lng && filters.radiusM
        ? Prisma.sql`AND ST_DWithin(v.location, ST_SetSRID(ST_MakePoint(${filters.lng}, ${filters.lat}), 4326)::geography, ${filters.radiusM})`
        : Prisma.sql``;

    const orderBy =
      filters.sort === "distance" && filters.lat && filters.lng
        ? Prisma.sql`ORDER BY v.location <-> ST_SetSRID(ST_MakePoint(${filters.lng}, ${filters.lat}), 4326)::geography ASC`
        : Prisma.sql`ORDER BY v."createdAt" DESC`;

    const rows = await this.prisma.$queryRaw<VenueRow[]>(Prisma.sql`
      SELECT v.id, v.name, v.slug, v."priceRange", v."isBoutique", v."editorialNote",
             v."googleRating", v."googleRatingCount"${distanceSelect}
      FROM "Venue" v
      WHERE ${where} ${radiusFilter}
      ${orderBy}
      LIMIT ${limit + 1}
    `);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? Buffer.from(JSON.stringify({ lastId: items[items.length - 1].id })).toString("base64") : null;

    return { items, nextCursor };
  }
}
