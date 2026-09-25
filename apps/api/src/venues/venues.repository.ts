import { randomUUID } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { VenueListQuery } from "@gurmego/shared";

export interface VenueRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  distance_m?: number;
  coverPhoto: string | null;
}

// Internal-only row shape used while building a page: carries `created_at` (needed to encode a
// resumable "newest" cursor) which is stripped back out before the row is returned to callers --
// the public `VenueRow`/`VenueListQuerySchema` response contract has no `createdAt` field, and
// leaking one here would silently widen the public API response shape.
type VenueRowInternal = VenueRow & { created_at?: Date };

// Cursor shape differs by sort: "newest" resumes on (createdAt, id) since ORDER BY is
// createdAt DESC, id DESC; "distance" resumes on (distance_m, id) since ORDER BY is
// distance ASC, id ASC -- a distance-sorted page cannot be resumed by id alone, the last row's
// distance value is also needed to keep filtering "further than the last one seen."
interface NewestCursor { lastId: string; lastCreatedAt: string }
interface DistanceCursor { lastId: string; lastDistanceM: number }
type Cursor = NewestCursor | DistanceCursor;

// `lastId` gets an explicit `::uuid` cast when building the keyset WHERE clause (see
// searchPublished) -- a non-UUID-shaped `lastId` in a corrupted/forged cursor would make that cast
// throw a runtime SQL error (500) instead of the fail-open "ignore the cursor" behavior this
// method otherwise guarantees. Validated once here so a bad shape is treated the same as any other
// malformed cursor.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function encodeCursor(payload: Cursor): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

// Malformed/foreign cursors (bad base64, bad JSON, wrong shape for the requested sort) are
// ignored rather than thrown on -- same fail-open posture as this repository's openNow handling:
// a broken cursor silently restarting at page 1 is a much better failure mode than a 500 on the
// public search endpoint.
function decodeCursor(raw: string | undefined): Partial<NewestCursor & DistanceCursor> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    return typeof parsed === "object" && parsed !== null ? parsed : undefined;
  } catch {
    return undefined;
  }
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
  address: string | null;
  photos: string[];
  createdAt: Date;
  updatedAt: Date;
  lat: number;
  lng: number;
}

// Public detail endpoint row: all the fields needed by VenueDetailSchema (no admin-only branchCount,
// franchiseFlag, status, featured, createdAt, updatedAt; district nested as {name, slug}, not districtId).
export interface VenueDetailRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  cuisineType: string | null;
  priceRange: string;
  signatureItems: string[];
  transportNote: string | null;
  openingHours: Prisma.JsonValue;
  editorialNote: string | null;
  isBoutique: boolean;
  verifiedAt: Date;
  source: string;
  googleRating: number | null;
  googleRatingCount: number | null;
  googlePlaceId: string | null;
  address: string | null;
  photos: string[];
  lat: number;
  lng: number;
  district: { name: string; slug: string };
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
  googleRating?: number;
  googleRatingCount?: number;
  googlePlaceId?: string;
  address?: string;
  photos?: string[];
}

// Update semantics differ from create: `undefined` means "leave alone"; for nullable-in-DB fields,
// `null` is a distinct, meaningful value ("clear this field") -- needed by revert() restoring a
// venue to a state where e.g. editorialNote was empty.
type NullableUpdateFields = "cuisineType" | "transportNote" | "editorialNote" | "googleRating" | "googleRatingCount" | "googlePlaceId" | "address";
export type UpdateVenueWithLocationInput = Partial<Omit<CreateVenueWithLocationInput, "lat" | "lng" | NullableUpdateFields>> & {
  lat?: number;
  lng?: number;
  cuisineType?: string | null;
  transportNote?: string | null;
  editorialNote?: string | null;
  googleRating?: number | null;
  googleRatingCount?: number | null;
  googlePlaceId?: string | null;
  address?: string | null;
};

// Pure mapping, no DB access. revert() uses this to turn a VenueVersion snapshot back into a
// valid updateWithLocation input. `source` is included (round 3 finding: it was omitted, meaning
// revert lost that field). `verifiedAt` is deliberately NOT copied here -- revert() sets a fresh
// timestamp itself, treating a revert as a re-verification event, same as update().
export function snapshotToUpdateInput(row: AdminVenueRow): UpdateVenueWithLocationInput {
  return {
    name: row.name, slug: row.slug, districtId: row.districtId, category: row.category,
    cuisineType: row.cuisineType, priceRange: row.priceRange, signatureItems: row.signatureItems,
    transportNote: row.transportNote,
    // `row.openingHours` is a Prisma `Json` column (`Prisma.JsonValue`) -- its static type is a
    // union of primitives/objects/arrays and carries no domain knowledge that opening hours are
    // always stored as a JSON object (never a bare string/number/array). No narrower type is
    // possible without a runtime shape check nothing downstream needs (same reasoning as the
    // `version.snapshot` cast in admin-venues.service.ts's revert()).
    openingHours: row.openingHours as Record<string, unknown>,
    editorialNote: row.editorialNote, isBoutique: row.isBoutique, branchCount: row.branchCount,
    franchiseFlag: row.franchiseFlag, status: row.status, source: row.source,
    googleRating: row.googleRating, googleRatingCount: row.googleRatingCount,
    googlePlaceId: row.googlePlaceId, address: row.address, photos: row.photos,
    lat: row.lat, lng: row.lng,
  };
}

// Internal only. VenueListQuery no longer carries lat/lng (ADR 004) or a resolved sort;
// VenuesService.list() merges the header-derived location and computed sort in.
export type VenueSearchFilters = Omit<VenueListQuery, "sort"> & { sort: "distance" | "newest"; lat?: number; lng?: number };

const ADMIN_VENUE_RETURNING = Prisma.sql`
  RETURNING id, name, slug, "districtId", category, "cuisineType", "priceRange", "signatureItems",
    "transportNote", "openingHours", "editorialNote", "isBoutique", "branchCount", "franchiseFlag",
    source, "verifiedAt", status, "googleRating", "googleRatingCount", "googlePlaceId", featured,
    address, photos, "createdAt", "updatedAt",
    ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
`;

@Injectable()
export class VenuesRepository {
  constructor(private prisma: PrismaService) {}

  async searchPublished(filters: VenueSearchFilters) {
    const conditions: Prisma.Sql[] = [Prisma.sql`v.status = 'PUBLISHED'`];
    if (filters.districtId) conditions.push(Prisma.sql`v."districtId" = ${filters.districtId}`);
    if (filters.category) conditions.push(Prisma.sql`v.category = ${filters.category}`);
    if (filters.priceRange) conditions.push(Prisma.sql`v."priceRange" = ${filters.priceRange}::"PriceRange"`);
    if (filters.isBoutique !== undefined) conditions.push(Prisma.sql`v."isBoutique" = ${filters.isBoutique}`);
    if (filters.q) {
      // Plain ILIKE, not pg_trgm/unaccent -- MVP's 3-district scope doesn't need a search index
      // (docs/REVIEW-PLAN.md, 2026-09-25). Known limitation: no accent-folding, so "cay" won't
      // match "çay". `%`/`_`/`\` are escaped so a term containing them (e.g. a venue literally
      // named "50% İndirim") matches that literal text instead of using the user's own character
      // as an extra LIKE wildcard -- Postgres's default LIKE escape character is `\`.
      const escaped = filters.q.replace(/[\\%_]/g, (c) => `\\${c}`);
      const term = `%${escaped}%`;
      conditions.push(
        Prisma.sql`(v.name ILIKE ${term} OR v."cuisineType" ILIKE ${term} OR v."editorialNote" ILIKE ${term})`,
      );
    }
    if (filters.openNow) {
      // Fail-open by design (docs/superpowers/specs/2026-07-26-backend-fixes-design.md, 10
      // plan-red-team rounds): missing/malformed openingHours resolve to `true` (included), not
      // excluded -- accidentally hiding a venue is worse UX than accidentally showing one, and a
      // data-quality bug in one venue's `openingHours` must never surface as a 500 on this whole
      // query. Each bucket's raw "HH:MM-HH:MM" text is validated by regex before being cast to
      // `::time` so a malformed value can never reach the cast (which would error the whole
      // query); if the regex fails or the key is absent, the CASE falls through to ELSE true.
      // The open/close comparison itself handles venues open across midnight (e.g. "22:00-02:00"):
      // when close < open, "now" is open either from `open` through midnight, OR from midnight
      // through `close" -- a plain BETWEEN cannot express that wrap-around, so each bucket branch
      // is an explicit OR of the same-day and wrapped-day cases instead.
      //
      // IMPORTANT: the regex validity check must live in the CASE's WHEN condition (not inside
      // THEN) -- if it were inside THEN and the value were missing/malformed, THEN would evaluate
      // to `false`/`NULL` and that becomes the CASE's actual result, never falling through to
      // `ELSE true`. Keeping it in WHEN means a bad/missing value makes the WHEN condition itself
      // false, so control correctly falls through to the next WHEN/ELSE.
      const hoursCheck = (bucket: "mon_fri" | "sat_sun") => Prisma.sql`
        (
          ( (split_part(v."openingHours"->>${bucket}, '-', 2))::time >= (split_part(v."openingHours"->>${bucket}, '-', 1))::time
            AND (now() AT TIME ZONE 'Europe/Istanbul')::time
                BETWEEN (split_part(v."openingHours"->>${bucket}, '-', 1))::time
                AND (split_part(v."openingHours"->>${bucket}, '-', 2))::time )
          OR
          ( (split_part(v."openingHours"->>${bucket}, '-', 2))::time < (split_part(v."openingHours"->>${bucket}, '-', 1))::time
            AND ( (now() AT TIME ZONE 'Europe/Istanbul')::time >= (split_part(v."openingHours"->>${bucket}, '-', 1))::time
                  OR (now() AT TIME ZONE 'Europe/Istanbul')::time <= (split_part(v."openingHours"->>${bucket}, '-', 2))::time ) )
        )
      `;
      const bucketFormatOk = (bucket: "mon_fri" | "sat_sun") =>
        Prisma.sql`v."openingHours"->>${bucket} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$'`;
      conditions.push(Prisma.sql`
        CASE
          WHEN EXTRACT(ISODOW FROM now() AT TIME ZONE 'Europe/Istanbul') BETWEEN 1 AND 5
               AND ${bucketFormatOk("mon_fri")}
          THEN ${hoursCheck("mon_fri")}
          WHEN EXTRACT(ISODOW FROM now() AT TIME ZONE 'Europe/Istanbul') BETWEEN 6 AND 7
               AND ${bucketFormatOk("sat_sun")}
          THEN ${hoursCheck("sat_sun")}
          ELSE true
        END
      `);
    }

    const where = Prisma.join(conditions, " AND ");
    const limit = filters.limit ?? 20;

    const hasLocation = filters.lat !== undefined && filters.lng !== undefined;
    // `<->` (used raw, unrounded, in ORDER BY below) is what lets Postgres use `location`'s spatial
    // index for a KNN nearest-neighbor sort -- wrapping it in ROUND() there would defeat that and
    // force a sequential scan, regressing the <300ms search target (architecture.md §6). But the
    // *raw* value is empirically NOT bit-for-bit reproducible across separate query executions for
    // the same two points (verified against this local Postgres/PostGIS stack: re-querying the
    // exact same row/reference-point pair a moment later returns a value differing at the ~1e-10m
    // level) -- likely PostGIS's own internal spheroid-distance evaluation picking a marginally
    // different code path depending on whether the KNN index is used. That sub-millimeter jitter is
    // irrelevant to users, but it's fatal to a keyset cursor: comparing "> the exact float I got
    // back last time" can spuriously evaluate true again for the SAME row on the next page's query.
    // Rounded to millimeters (3 decimal places) for both the value returned to clients
    // (`distance_m`) and the cursor comparison -- far finer than any real venue-distance UI needs,
    // but coarse enough to fully absorb the jitter, so the same physical distance always encodes
    // and compares identically across requests.
    const distanceExprRaw = Prisma.sql`v.location <-> ST_SetSRID(ST_MakePoint(${filters.lng}, ${filters.lat}), 4326)::geography`;
    const distanceExpr = Prisma.sql`ROUND((${distanceExprRaw})::numeric, 3)::float8`;
    const distanceSelect = hasLocation ? Prisma.sql`, ${distanceExpr} AS distance_m` : Prisma.sql``;

    const radiusFilter = hasLocation && filters.radiusM
      ? Prisma.sql`AND ST_DWithin(v.location, ST_SetSRID(ST_MakePoint(${filters.lng}, ${filters.lat}), 4326)::geography, ${filters.radiusM})`
      : Prisma.sql``;

    const sortByDistance = filters.sort === "distance" && hasLocation;
    const orderBy = sortByDistance
      ? Prisma.sql`ORDER BY ${distanceExprRaw} ASC, v.id ASC`
      : Prisma.sql`ORDER BY v."createdAt" DESC, v.id DESC`;

    // Keyset pagination: the client's opaque `cursor` must actually narrow the next page to rows
    // strictly past the last one it already saw, or every "next page" request silently repeats
    // page 1. Correctness at ties (two venues created at the exact same instant, or sitting at the
    // exact same distance) falls back to `id` as a deterministic tiebreak, matching each sort's own
    // ORDER BY tiebreak above. Deliberately spelled out as `(a > c) OR (a = c AND b > d)` instead of
    // Postgres row-constructor comparison (`(a, b) > (c, d)`) -- empirically verified against this
    // schema that ROW comparison involving `v.id` against a bound parameter silently produces wrong
    // results here (Postgres resolves the anonymous record's per-field comparison in a way that
    // does not error, but does not correctly exclude the boundary row either); the explicit OR form
    // avoids the composite-type resolution entirely. `v.id` (`String @id @default(uuid())`, no
    // `@db.Uuid`) is a plain `text` column, not native Postgres `uuid` -- compared as text here, no
    // cast needed or possible on either side.
    const decoded = decodeCursor(filters.cursor);
    let cursorFilter = Prisma.sql``;
    if (decoded && typeof decoded.lastId === "string" && UUID_RE.test(decoded.lastId)) {
      if (sortByDistance && typeof decoded.lastDistanceM === "number") {
        cursorFilter = Prisma.sql`AND (${distanceExpr} > ${decoded.lastDistanceM} OR (${distanceExpr} = ${decoded.lastDistanceM} AND v.id > ${decoded.lastId}))`;
      } else if (!sortByDistance && typeof decoded.lastCreatedAt === "string") {
        const lastCreatedAt = new Date(decoded.lastCreatedAt);
        cursorFilter = Prisma.sql`AND (v."createdAt" < ${lastCreatedAt} OR (v."createdAt" = ${lastCreatedAt} AND v.id < ${decoded.lastId}))`;
      }
      // A cursor encoded under one sort mode (e.g. "distance") replayed against a request using
      // the other mode (e.g. "newest") matches neither branch above -- ignored (fail-open, same
      // posture as the rest of this method), so the mismatched cursor just yields page 1 again
      // instead of a 500 or a `split_part`-style crash on a shape mismatch.
    }

    const rows = await this.prisma.$queryRaw<VenueRowInternal[]>(Prisma.sql`
      SELECT v.id, v.name, v.slug, v.category, v."priceRange", v."isBoutique", v."editorialNote",
             v."googleRating", v."googleRatingCount", v.photos[1] AS "coverPhoto",
             v."createdAt" AS created_at${distanceSelect}
      FROM "Venue" v
      WHERE ${where} ${radiusFilter} ${cursorFilter}
      ${orderBy}
      LIMIT ${limit + 1}
    `);

    const hasMore = rows.length > limit;
    const trimmed = hasMore ? rows.slice(0, limit) : rows;
    const last = trimmed[trimmed.length - 1];
    const nextCursor = hasMore
      ? encodeCursor(
          sortByDistance
            ? { lastId: last.id, lastDistanceM: last.distance_m as number }
            : { lastId: last.id, lastCreatedAt: (last.created_at as Date).toISOString() },
        )
      : null;
    // `created_at` is an internal-only field used to build the cursor above -- strip it before
    // returning rows, so the public response shape (`VenueRow`) doesn't silently gain a field.
    const items: VenueRow[] = trimmed.map((row) => {
      const { created_at, ...rest } = row;
      void created_at;
      return rest;
    });

    return { items, nextCursor };
  }

  async findBySlug(slug: string): Promise<VenueDetailRow | undefined> {
    const rows = await this.prisma.$queryRaw<VenueDetailRow[]>(Prisma.sql`
      SELECT v.id, v.slug, v.name, v.category, v."cuisineType", v."priceRange", v."signatureItems",
        v."transportNote", v."openingHours", v."editorialNote", v."isBoutique", v."verifiedAt",
        v.source, v."googleRating", v."googleRatingCount", v."googlePlaceId", v.address, v.photos,
        ST_Y(v.location::geometry) AS lat, ST_X(v.location::geometry) AS lng,
        json_build_object('name', d.name, 'slug', d.slug) AS district
      FROM "Venue" v JOIN "District" d ON d.id = v."districtId"
      WHERE v.slug = ${slug} AND v.status = 'PUBLISHED'
      LIMIT 1
    `);
    return rows[0];
  }

  async findInBbox([minLng, minLat, maxLng, maxLat]: [number, number, number, number]) {
    // Sanity-check bound, NOT a rule-engine threshold (rule-engine.md's config-driven thresholds
    // are about deterministic product rules -- boutique branch limits, Gurme Puanı weights, etc.
    // "is this bbox absurdly large" is a different kind of check: a fixed ceiling on what a public,
    // unauthenticated endpoint will ever bother computing). This MVP's whole stated scope
    // (Kadıköy + Beşiktaş + Beyoğlu, product-overview.md) spans roughly 40.95-41.09 N x 28.94-29.10
    // E -- an area on the order of 0.02 square degrees. `MAX_BBOX_AREA_DEG2` is set ~50x that: big
    // enough that any legitimate zoomed-out map view over the three districts (or a bit beyond, for
    // UI padding) is never accidentally rejected, but small enough to reject a world-scale or
    // country-scale bbox that would otherwise force PostGIS to scan and return every published
    // venue in one request.
    const MAX_BBOX_AREA_DEG2 = 1;
    // Hard cap on rows returned regardless of bbox size -- matches VenueListQuerySchema's public
    // list-endpoint pagination ceiling (packages/shared's `limit.max(50)`) order of magnitude, but
    // a map view legitimately wants to show more markers at once than a paginated list page, so
    // this is set higher rather than reusing that exact constant.
    const MAX_BBOX_RESULTS = 500;

    const area = (maxLng - minLng) * (maxLat - minLat);
    if (area > MAX_BBOX_AREA_DEG2) {
      throw new BadRequestException({
        error: { code: "BBOX_TOO_LARGE", message: "Sorgulanan alan çok büyük, lütfen haritayı yakınlaştırın" },
      });
    }

    return this.prisma.$queryRaw<Array<{ id: string; name: string; category: string; lat: number; lng: number }>>(Prisma.sql`
      SELECT v.id, v.name, v.category,
             ST_Y(v.location::geometry) AS lat, ST_X(v.location::geometry) AS lng
      FROM "Venue" v
      WHERE v.status = 'PUBLISHED'
        AND ST_Intersects(v.location::geometry, ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326))
      LIMIT ${MAX_BBOX_RESULTS}
    `);
  }

  // ADR 002: `Venue.location` is an `Unsupported("geography(Point,4326)")` NOT NULL column, so the
  // generated Prisma client omits `create`/`upsert` (and can't touch `location` on `update`) for this
  // model. Writing it requires raw SQL, kept in this repository layer per the ADR.
  async createWithLocation(client: Pick<PrismaService, "$queryRaw">, input: CreateVenueWithLocationInput): Promise<AdminVenueRow> {
    const id = randomUUID();
    const rows = await client.$queryRaw<AdminVenueRow[]>(Prisma.sql`
      INSERT INTO "Venue" (
        id, name, slug, "districtId", category, "cuisineType", "priceRange", "signatureItems",
        "transportNote", "openingHours", "editorialNote", "isBoutique", "branchCount", "franchiseFlag",
        source, "verifiedAt", status, location, "googleRating", "googleRatingCount", "googlePlaceId",
        address, photos, "updatedAt"
      ) VALUES (
        ${id}, ${input.name}, ${input.slug}, ${input.districtId}, ${input.category},
        ${input.cuisineType ?? null}, ${input.priceRange}::"PriceRange", ${input.signatureItems},
        ${input.transportNote ?? null}, ${JSON.stringify(input.openingHours)}::jsonb,
        ${input.editorialNote ?? null}, ${input.isBoutique}, ${input.branchCount}, ${input.franchiseFlag},
        ${input.source}::"VenueSource", ${input.verifiedAt}, ${input.status}::"VenueStatus",
        ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
        ${input.googleRating ?? null}, ${input.googleRatingCount ?? null}, ${input.googlePlaceId ?? null},
        ${input.address ?? null}, ${input.photos ?? []},
        now()
      )
      ${ADMIN_VENUE_RETURNING}
    `);
    return rows[0];
  }

  // Every current caller (`AdminVenuesService.update`/`revert`, `AdminQueueService.approve`'s EDIT
  // branch) runs this inside a `$transaction`, then writes back based on what it read -- a classic
  // read-then-write race: two concurrent calls can both read the same snapshot before either
  // writes, and the second write silently clobbers the first's changes (including derived fields
  // like `isBoutique`, recomputed from a now-stale `existing` in `update()`). `FOR UPDATE` takes a
  // row lock as part of THIS read: a second transaction's `findRawForSnapshot` on the same `id`
  // blocks here until the first transaction commits (or rolls back), then reads the
  // already-updated row -- turning the race into a serialized queue instead of two callers
  // proceeding from the same stale snapshot. Locking here (the one place every writer's
  // read-before-write already goes through) fixes all three call sites at once rather than adding
  // a separate lock call to each.
  async findRawForSnapshot(client: Pick<PrismaService, "$queryRaw">, id: string): Promise<AdminVenueRow> {
    const rows = await client.$queryRaw<AdminVenueRow[]>(Prisma.sql`
      SELECT id, name, slug, "districtId", category, "cuisineType", "priceRange", "signatureItems",
        "transportNote", "openingHours", "editorialNote", "isBoutique", "branchCount", "franchiseFlag",
        source, "verifiedAt", status, "googleRating", "googleRatingCount", "googlePlaceId", featured,
        address, photos, "createdAt", "updatedAt",
        ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
      FROM "Venue" WHERE id = ${id}
      FOR UPDATE
    `);
    if (rows.length === 0) {
      const notFound = new NotFoundException({ error: { code: "VENUE_NOT_FOUND", message: "Mekan bulunamadı" } });
      notFound.message = "Mekan bulunamadı";
      throw notFound;
    }
    return rows[0];
  }

  async updateWithLocation(client: Pick<PrismaService, "$queryRaw">, id: string, input: UpdateVenueWithLocationInput): Promise<AdminVenueRow> {
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
    if (input.googleRating !== undefined) assignments.push(Prisma.sql`"googleRating" = ${input.googleRating}`);
    if (input.googleRatingCount !== undefined) assignments.push(Prisma.sql`"googleRatingCount" = ${input.googleRatingCount}`);
    if (input.googlePlaceId !== undefined) assignments.push(Prisma.sql`"googlePlaceId" = ${input.googlePlaceId}`);
    if (input.address !== undefined) assignments.push(Prisma.sql`address = ${input.address}`);
    if (input.photos !== undefined) assignments.push(Prisma.sql`photos = ${input.photos}`);
    // lat/lng always travel together (validated by the admin zod schema); only touch `location` if given,
    // otherwise leave the existing point untouched.
    if (input.lat !== undefined && input.lng !== undefined) {
      assignments.push(Prisma.sql`location = ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography`);
    }
    assignments.push(Prisma.sql`"updatedAt" = now()`);

    const rows = await client.$queryRaw<AdminVenueRow[]>(Prisma.sql`
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
