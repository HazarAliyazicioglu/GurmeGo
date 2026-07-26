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

export const VenueListQuerySchema = z
  .object({
    districtId: z.string().uuid().optional(),
    category: z.string().optional(),
    cuisineType: z.string().optional(),
    priceRange: z.enum(PRICE_RANGE_VALUES).optional(),
    isBoutique: z.coerce.boolean().optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusM: z.coerce.number().int().positive().max(20000).optional(),
    sort: z.enum(["distance", "newest"]).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().optional(),
  })
  .transform((v) => ({ ...v, sort: v.sort ?? (v.lat && v.lng ? "distance" : "newest") }));
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
});
export type VenueDetail = z.infer<typeof VenueDetailSchema>;
