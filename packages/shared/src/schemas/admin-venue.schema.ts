import { z } from "zod";
import { PRICE_RANGE_VALUES } from "../enums/price-range";

// Admin-only creation/update input for `POST/PUT /admin/venues`. Distinct from `VenueSchema`
// (packages/shared/src/schemas/venue.schema.ts), which describes the public-facing read shape and
// has no `lat`/`lng`/`franchiseFlag` — those are inputs the admin supplies so the API can compute
// `location` (raw SQL, see ADR 002) and `isBoutique` (rule engine), not fields a client ever reads back
// verbatim in that form.
export const AdminVenueCreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(220),
  districtId: z.string().uuid(),
  category: z.string().min(1),
  cuisineType: z.string().optional(),
  priceRange: z.enum(PRICE_RANGE_VALUES),
  signatureItems: z.array(z.string().min(1)).max(10).default([]),
  transportNote: z.string().max(500).optional(),
  openingHours: z.record(z.string(), z.string()),
  editorialNote: z.string().max(1000).optional(),
  branchCount: z.number().int().min(1),
  franchiseFlag: z.boolean(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  googleRating: z.number().min(0).max(5).optional(),
  googleRatingCount: z.number().int().min(0).optional(),
  googlePlaceId: z.string().optional(),
});
export type AdminVenueCreateInput = z.infer<typeof AdminVenueCreateSchema>;

export const AdminVenueUpdateSchema = AdminVenueCreateSchema.partial();
export type AdminVenueUpdateInput = z.infer<typeof AdminVenueUpdateSchema>;
