import { randomUUID } from "crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { VenueListQuery } from "@gurmego/shared";

export interface VenueRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  distance_m?: number;
}

// Every column of `Venue` except the raw PostGIS `location`, plus its decomposed lat/lng — mirrors
// what `RETURNING ..., ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng` produces.
export interface AdminVenueRow {
  id: string;
  name: string;
  slug: string;
  districtId: string;
  category: string;
  cuisineType: string | null;
  priceRange: string;
  signatureItems: string[];
  transportNote: string | null;
  openingHours: Prisma.JsonValue;
  editorialNote: string | null;
  isBoutique: boolean;
  branchCount: number;
  franchiseFlag: boolean;
  source: string;
  verifiedAt: Date;
  status: string;
  googleRating: number | null;
  googleRatingCount: number | null;
  googlePlaceId: string | null;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
  lat: number;
  lng: number;
}

export interface CreateVenueWithLocationInput {
  name: string;
  slug: string;
  districtId: string;
  category: string;
  cuisineType?: string;
  priceRange: string;
  signatureItems: string[];
  transportNote?: string;
  openingHours: Record<string, unknown>;
  editorialNote?: string;
  isBoutique: boolean;
  branchCount: number;
  franchiseFlag: boolean;
  source: string;
  verifiedAt: Date;
  status: string;
  lat: number;
  lng: number;
}

// Same shape, but every field is optional (partial update) except the two that always travel together:
// if either lat or lng is supplied, both must be, so `location` can be recomputed atomically.
export type UpdateVenueWithLocationInput = Partial<Omit<CreateVenueWithLocationInput, "lat" | "lng">> & {
  lat?: number;
  lng?: number;
};

const ADMIN_VENUE_RETURNING = Prisma.sql`
  RETURNING id, name, slug, "districtId", category, "cuisineType", "priceRange", "signatureItems",
    "transportNote", "openingHours", "editorialNote", "isBoutique", "branchCount", "franchiseFlag",
    source, "verifiedAt", status, "googleRating", "googleRatingCount", "googlePlaceId", featured,
    "createdAt", "updatedAt",
    ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
`;

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
      SELECT v.id, v.name, v.slug, v.category, v."priceRange", v."isBoutique", v."editorialNote",
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

  findBySlug(slug: string) {
    return this.prisma.venue.findFirst({
      where: { slug, status: "PUBLISHED" },
      select: {
        id: true, slug: true, name: true, category: true, cuisineType: true,
        priceRange: true, signatureItems: true, transportNote: true, openingHours: true,
        editorialNote: true, isBoutique: true, verifiedAt: true, source: true,
        googleRating: true, googleRatingCount: true, googlePlaceId: true,
        district: { select: { name: true, slug: true } },
      },
    });
  }

  async findInBbox([minLng, minLat, maxLng, maxLat]: [number, number, number, number]) {
    return this.prisma.$queryRaw<Array<{ id: string; name: string; category: string; lat: number; lng: number }>>(Prisma.sql`
      SELECT v.id, v.name, v.category,
             ST_Y(v.location::geometry) AS lat, ST_X(v.location::geometry) AS lng
      FROM "Venue" v
      WHERE v.status = 'PUBLISHED'
        AND ST_Intersects(v.location::geometry, ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326))
    `);
  }

  // ADR 002: `Venue.location` is an `Unsupported("geography(Point,4326)")` NOT NULL column, so the
  // generated Prisma client omits `create`/`upsert` (and can't touch `location` on `update`) for this
  // model. Writing it requires raw SQL, kept in this repository layer per the ADR.
  async createWithLocation(input: CreateVenueWithLocationInput): Promise<AdminVenueRow> {
    const id = randomUUID();
    const rows = await this.prisma.$queryRaw<AdminVenueRow[]>(Prisma.sql`
      INSERT INTO "Venue" (
        id, name, slug, "districtId", category, "cuisineType", "priceRange", "signatureItems",
        "transportNote", "openingHours", "editorialNote", "isBoutique", "branchCount", "franchiseFlag",
        source, "verifiedAt", status, location, "updatedAt"
      ) VALUES (
        ${id}, ${input.name}, ${input.slug}, ${input.districtId}, ${input.category},
        ${input.cuisineType ?? null}, ${input.priceRange}::"PriceRange", ${input.signatureItems},
        ${input.transportNote ?? null}, ${JSON.stringify(input.openingHours)}::jsonb,
        ${input.editorialNote ?? null}, ${input.isBoutique}, ${input.branchCount}, ${input.franchiseFlag},
        ${input.source}::"VenueSource", ${input.verifiedAt}, ${input.status}::"VenueStatus",
        ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
        now()
      )
      ${ADMIN_VENUE_RETURNING}
    `);
    return rows[0];
  }

  async updateWithLocation(id: string, input: UpdateVenueWithLocationInput): Promise<AdminVenueRow> {
    const assignments: Prisma.Sql[] = [];
    if (input.name !== undefined) assignments.push(Prisma.sql`name = ${input.name}`);
    if (input.slug !== undefined) assignments.push(Prisma.sql`slug = ${input.slug}`);
    if (input.districtId !== undefined) assignments.push(Prisma.sql`"districtId" = ${input.districtId}`);
    if (input.category !== undefined) assignments.push(Prisma.sql`category = ${input.category}`);
    if (input.cuisineType !== undefined) assignments.push(Prisma.sql`"cuisineType" = ${input.cuisineType}`);
    if (input.priceRange !== undefined) assignments.push(Prisma.sql`"priceRange" = ${input.priceRange}::"PriceRange"`);
    if (input.signatureItems !== undefined) assignments.push(Prisma.sql`"signatureItems" = ${input.signatureItems}`);
    if (input.transportNote !== undefined) assignments.push(Prisma.sql`"transportNote" = ${input.transportNote}`);
    if (input.openingHours !== undefined) assignments.push(Prisma.sql`"openingHours" = ${JSON.stringify(input.openingHours)}::jsonb`);
    if (input.editorialNote !== undefined) assignments.push(Prisma.sql`"editorialNote" = ${input.editorialNote}`);
    if (input.isBoutique !== undefined) assignments.push(Prisma.sql`"isBoutique" = ${input.isBoutique}`);
    if (input.branchCount !== undefined) assignments.push(Prisma.sql`"branchCount" = ${input.branchCount}`);
    if (input.franchiseFlag !== undefined) assignments.push(Prisma.sql`"franchiseFlag" = ${input.franchiseFlag}`);
    if (input.source !== undefined) assignments.push(Prisma.sql`source = ${input.source}::"VenueSource"`);
    if (input.verifiedAt !== undefined) assignments.push(Prisma.sql`"verifiedAt" = ${input.verifiedAt}`);
    if (input.status !== undefined) assignments.push(Prisma.sql`status = ${input.status}::"VenueStatus"`);
    // lat/lng always travel together (validated by the admin zod schema); only touch `location` if given,
    // otherwise leave the existing point untouched.
    if (input.lat !== undefined && input.lng !== undefined) {
      assignments.push(Prisma.sql`location = ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography`);
    }
    assignments.push(Prisma.sql`"updatedAt" = now()`);

    const rows = await this.prisma.$queryRaw<AdminVenueRow[]>(Prisma.sql`
      UPDATE "Venue"
      SET ${Prisma.join(assignments, ", ")}
      WHERE id = ${id}
      ${ADMIN_VENUE_RETURNING}
    `);
    if (rows.length === 0) {
      // The HTTP response body must stay exactly `{ error: { code, message } }` per
      // docs/api-spec.md (no top-level `message`), but NestJS's HttpException only
      // derives `.message` (the Error message, used by e.g. `toThrow`) from a
      // top-level `message` property on the response object. Set it explicitly
      // after construction so the JSON body is unaffected.
      const notFound = new NotFoundException({ error: { code: "VENUE_NOT_FOUND", message: "Mekan bulunamadı" } });
      notFound.message = "Mekan bulunamadı";
      throw notFound;
    }
    return rows[0];
  }
}
