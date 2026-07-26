import { z } from "zod";
import { PRICE_RANGE_VALUES } from "../enums/price-range";

export const VenueStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const VenueSourceSchema = z.enum(["MANUAL", "USER", "AUTO"]);

// z.coerce.boolean() is a footgun: Boolean("false") is true. A naive
// z.literal("true").optional().transform(v => v === "true") is ALSO wrong -- absent -> v is
// undefined -> undefined === "true" is false, collapsing "not requested" into "explicitly off".
// Not yet applied to VenueListQuerySchema here -- see this task's Step 8 note; that happens
// atomically with its consumer in Task 4.
export const OptionalTrueFlag = z.literal("true").optional().transform((v) => (v === undefined ? undefined : true));

export const VenueSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(220),
  districtId: z.string().uuid(),
  category: z.string().min(1),
  cuisineType: z.string().optional(),
  priceRange: z.enum(PRICE_RANGE_VALUES),
  signatureItems: z.array(z.string().min(1)).max(10),
  transportNote: z.string().max(500).optional(),
  openingHours: z.record(z.string(), z.string()),
  editorialNote: z.string().max(1000).optional(),
  isBoutique: z.boolean(),
  branchCount: z.number().int().min(1),
  verifiedAt: z.string().datetime(),
  status: VenueStatusSchema,
  googleRating: z.number().min(0).max(5).optional(),
  googleRatingCount: z.number().int().min(0).optional(),
  googlePlaceId: z.string().optional(),
});
export type Venue = z.infer<typeof VenueSchema>;

// lat/lng removed (ADR 004): location now arrives via the X-User-Location header, never a query
// param that could end up in access logs. See apps/api's user-location.decorator.ts and
// VenuesService.list for where the header-derived location and default sort are merged back in.
export const VenueListQuerySchema = z.object({
  districtId: z.string().uuid().optional(),
  category: z.string().optional(),
  cuisineType: z.string().optional(),
  priceRange: z.enum(PRICE_RANGE_VALUES).optional(),
  isBoutique: OptionalTrueFlag,
  radiusM: z.coerce.number().int().positive().max(20000).optional(),
  sort: z.enum(["distance", "newest"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
  openNow: OptionalTrueFlag,
});
export type VenueListQuery = z.infer<typeof VenueListQuerySchema>;

// `GET /venues/:slug` (apps/api's `VenuesRepository.findBySlug`) returns a DIFFERENT projection than
// `VenueSchema` above: `district` as a nested {name,slug} object (not `districtId`), and no
// `branchCount`/`status` (admin-only fields, not exposed on the public detail endpoint). Validating
// the detail response against `VenueSchema` fails on every real request — use this schema instead.
export const VenueDetailSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(220),
  name: z.string().min(1).max(200),
  category: z.string().min(1),
  cuisineType: z.string().nullable(),
  priceRange: z.enum(PRICE_RANGE_VALUES),
  signatureItems: z.array(z.string().min(1)),
  transportNote: z.string().nullable(),
  openingHours: z.record(z.string(), z.string()),
  editorialNote: z.string().nullable(),
  isBoutique: z.boolean(),
  verifiedAt: z.string().datetime(),
  source: VenueSourceSchema,
  googleRating: z.number().min(0).max(5).nullable(),
  googleRatingCount: z.number().int().min(0).nullable(),
  googlePlaceId: z.string().nullable(),
  district: z.object({ name: z.string(), slug: z.string() }),
  lat: z.number(),
  lng: z.number(),
  address: z.string().nullable(),
  photos: z.array(z.string()),
});
export type VenueDetail = z.infer<typeof VenueDetailSchema>;

// `GET /venues/map`'s bbox query param. Guards against empty string parts BEFORE calling
// Number() on them -- Number("") is 0, the same footgun already fixed once for
// parseUserLocationHeader (Task 4); a bbox like ",40.9,29.1,41" must not silently become
// [0, 40.9, 29.1, 41], which would otherwise reach PostGIS and either crash or silently
// mis-filter the map view.
// `X-User-Location` header ("lat,lng"), consumed by apps/api's `parseUserLocationHeader`
// (common/user-location.decorator.ts). Guards against empty string parts BEFORE calling Number()
// on them -- Number("") is 0, the same footgun already fixed for `BboxQuerySchema` above; a
// header like "40.99," must not silently become { lat: 40.99, lng: 0 }.
export const UserLocationHeaderSchema = z.string().transform((s, ctx) => {
  const rawParts = s.split(",");
  if (rawParts.length !== 2 || rawParts.some((p) => p.trim() === "")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "must be 'lat,lng' with two non-empty parts" });
    return z.NEVER;
  }
  const [lat, lng] = rawParts.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "lat/lng must be finite numbers" });
    return z.NEVER;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "lat/lng out of range" });
    return z.NEVER;
  }
  return { lat, lng };
});
export type UserLocationHeader = z.infer<typeof UserLocationHeaderSchema>;

export const BboxQuerySchema = z.object({
  bbox: z.string().transform((s, ctx) => {
    const rawParts = s.split(",");
    if (rawParts.length !== 4 || rawParts.some((p) => p.trim() === "")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "bbox must be 4 comma-separated finite numbers" });
      return z.NEVER;
    }
    const parts = rawParts.map(Number);
    if (parts.some((n) => !Number.isFinite(n))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "bbox must be 4 comma-separated finite numbers" });
      return z.NEVER;
    }
    const [minLng, minLat, maxLng, maxLat] = parts;
    if (minLng >= maxLng || minLat >= maxLat) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "bbox min must be less than max" });
      return z.NEVER;
    }
    return parts as [number, number, number, number];
  }),
});
export type BboxQuery = z.infer<typeof BboxQuerySchema>;
