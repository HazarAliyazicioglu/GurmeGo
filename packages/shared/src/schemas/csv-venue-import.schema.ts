import { z } from "zod";
import { PRICE_RANGE_VALUES } from "../enums/price-range";
import {
  VENUE_LAT_RANGE,
  VENUE_LNG_RANGE,
  VENUE_NAME_MAX_LENGTH,
  VENUE_SLUG_MAX_LENGTH,
  VenueBranchCountSchema,
  VenueCategorySchema,
  VenueOpeningHoursSchema,
} from "./admin-venue.schema";

// CSV-row shape for `POST /admin/import` (apps/api/src/admin/venues/csv-import.service.ts). Lives in
// packages/shared (not apps/api) per the project's "all API input validated via Zod schemas from
// packages/shared" rule. Field-level limits (name/slug length, priceRange enum, lat/lng range,
// category, branchCount minimum, openingHours shape) are pulled from the SAME schemas/constants
// `AdminVenueCreateSchema` uses, so CSV import can never persist a row the manual create API would
// reject — the two schemas cannot drift apart on those limits. `branchCount`/`openingHours` still
// need CSV-specific wrapping here (coercion from a CSV string cell into the shared base schema)
// since a CSV row is all strings, unlike the JSON body `AdminVenueCreateSchema` validates.
// Narrower than VenueStatusSchema (no ARCHIVED) -- CSV import only creates new venues.
export const CsvVenueStatusSchema = z.enum(["DRAFT", "PUBLISHED"]);

export const CsvVenueImportRowSchema = z.object({
  name: z.string().min(1, "name zorunlu").max(VENUE_NAME_MAX_LENGTH, `name en fazla ${VENUE_NAME_MAX_LENGTH} karakter olabilir`),
  slug: z.string().min(1, "slug zorunlu").max(VENUE_SLUG_MAX_LENGTH, `slug en fazla ${VENUE_SLUG_MAX_LENGTH} karakter olabilir`),
  districtSlug: z.string().min(1),
  category: VenueCategorySchema,
  priceRange: z.enum(PRICE_RANGE_VALUES),
  branchCount: z.coerce.number().pipe(VenueBranchCountSchema),
  // `z.coerce.boolean()` is exactly `Boolean(input)` — since any non-empty string is truthy, the CSV
  // text "false" would coerce to `true`. Explicit enum + transform avoids that footgun.
  franchiseFlag: z
    .enum(["true", "false"], { errorMap: () => ({ message: "franchiseFlag 'true' veya 'false' olmalı" }) })
    .transform((v) => v === "true"),
  // `z.coerce.number()` on an empty string coerces to `0` (`Number("") === 0`), which is a
  // legitimately-in-range latitude/longitude — a blank cell would silently become real (bogus)
  // coordinates instead of failing validation. Require a non-blank string before coercing.
  lat: z.string().trim().min(1, "lat zorunlu").pipe(z.coerce.number().min(VENUE_LAT_RANGE[0]).max(VENUE_LAT_RANGE[1])),
  lng: z.string().trim().min(1, "lng zorunlu").pipe(z.coerce.number().min(VENUE_LNG_RANGE[0]).max(VENUE_LNG_RANGE[1])),
  openingHours: z.string().transform((s, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(s);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "openingHours geçerli JSON olmalı" });
      return z.NEVER;
    }
    const shape = VenueOpeningHoursSchema.safeParse(parsed);
    if (!shape.success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "openingHours düz bir { gün: saat } string haritası olmalı" });
      return z.NEVER;
    }
    return shape.data;
  }),
  status: z.preprocess((v) => (v === "" ? undefined : v), CsvVenueStatusSchema.optional()),
  address: z.preprocess((v) => (v === "" ? undefined : v), z.string().max(500).optional()),
});

export type CsvVenueImportRow = z.infer<typeof CsvVenueImportRowSchema>;
