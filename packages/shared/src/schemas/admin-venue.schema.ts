import { z } from "zod";
import { PRICE_RANGE_VALUES } from "../enums/price-range";

// Shared field-level constraints — also consumed by `CsvVenueImportRowSchema`
// (./csv-venue-import.schema.ts) so the two can't silently drift apart. Any admin-facing venue
// input (JSON body or CSV row) must obey the SAME name/slug/coordinate/category/branchCount/
// openingHours rules — extracted here rather than re-declared in each schema.
export const VENUE_NAME_MAX_LENGTH = 200;
export const VENUE_SLUG_MAX_LENGTH = 220;
export const VENUE_LAT_RANGE = [-90, 90] as const;
export const VENUE_LNG_RANGE = [-180, 180] as const;
export const VENUE_BRANCH_COUNT_MIN = 1;

export const VenueCategorySchema = z.string().min(1);
export const VenueBranchCountSchema = z.number().int().min(VENUE_BRANCH_COUNT_MIN);
export const VenueOpeningHoursSchema = z.record(z.string(), z.string());

// Admin-only creation/update input for `POST/PUT /admin/venues`. Distinct from `VenueSchema`
// (packages/shared/src/schemas/venue.schema.ts), which describes the public-facing read shape and
// has no `lat`/`lng`/`franchiseFlag` — those are inputs the admin supplies so the API can compute
// `location` (raw SQL, see ADR 002) and `isBoutique` (rule engine), not fields a client ever reads back
// verbatim in that form.
export const AdminVenueCreateSchema = z.object({
  name: z.string().min(1).max(VENUE_NAME_MAX_LENGTH),
  slug: z.string().min(1).max(VENUE_SLUG_MAX_LENGTH),
  districtId: z.string().uuid(),
  category: VenueCategorySchema,
  cuisineType: z.string().optional(),
  priceRange: z.enum(PRICE_RANGE_VALUES),
  signatureItems: z.array(z.string().min(1)).max(10).default([]),
  transportNote: z.string().max(500).optional(),
  openingHours: VenueOpeningHoursSchema,
  editorialNote: z.string().max(1000).optional(),
  branchCount: VenueBranchCountSchema,
  franchiseFlag: z.boolean(),
  lat: z.number().min(VENUE_LAT_RANGE[0]).max(VENUE_LAT_RANGE[1]),
  lng: z.number().min(VENUE_LNG_RANGE[0]).max(VENUE_LNG_RANGE[1]),
  googleRating: z.number().min(0).max(5).optional(),
  googleRatingCount: z.number().int().min(0).optional(),
  googlePlaceId: z.string().optional(),
});
export type AdminVenueCreateInput = z.infer<typeof AdminVenueCreateSchema>;

export const AdminVenueUpdateSchema = AdminVenueCreateSchema.partial();
export type AdminVenueUpdateInput = z.infer<typeof AdminVenueUpdateSchema>;
