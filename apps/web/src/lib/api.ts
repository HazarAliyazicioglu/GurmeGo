import { createApiClient } from "@gurmego/api-client";
import { VenueSchema, VenueDetailSchema, DistrictSchema, FavoriteListSchema, type VenueDetail, type District } from "@gurmego/shared";
import { z } from "zod";

export class ApiValidationError extends Error {
  constructor(public path: string, public issues: unknown) {
    super(`API response for ${path} did not match expected schema`);
    this.name = "ApiValidationError";
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/v1";
const client = createApiClient(API_BASE);

async function fetchValidated<T>(path: string, schema: z.ZodType<T>, token?: string): Promise<T> {
  const authedClient = token ? createApiClient(API_BASE, () => token) : client;
  const raw = await authedClient.get<unknown>(path);
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiValidationError(path, result.error.issues);
  return result.data;
}

// `GET /venues` (apps/api's `VenuesRepository.searchPublished`) SELECTs only
// `id, name, slug, category, priceRange, isBoutique, editorialNote, googleRating, googleRatingCount`
// (+ `distance_m` when lat/lng given, not surfaced to clients) — a narrower projection than
// `VenueSchema`, not merely "all fields optional". `id`/`name`/`slug`/`category`/`priceRange`/`isBoutique`
// are always present; `editorialNote`/`googleRating`/`googleRatingCount` are genuinely
// DB-nullable columns (raw SQL returns `null`, not `undefined`), so those stay `.nullable()` here,
// matching the pattern used by `VenueDetailSchema` above.
const VenueListItemSchema = z.object({
  id: VenueSchema.shape.id,
  name: VenueSchema.shape.name,
  slug: VenueSchema.shape.slug,
  category: VenueSchema.shape.category,
  priceRange: VenueSchema.shape.priceRange,
  isBoutique: VenueSchema.shape.isBoutique,
  editorialNote: z.string().max(1000).nullable(),
  googleRating: z.number().min(0).max(5).nullable(),
  googleRatingCount: z.number().int().min(0).nullable(),
});

// Real shape returned by `GET /venues` — narrower than `Venue` (see note above) and with
// `editorialNote`/`googleRating`/`googleRatingCount` as `T | null` rather than `T | undefined`
// (raw SQL nulls, not omitted keys). Components rendering venue list items should type against
// this, not `Partial<Venue>`, or `tsc` will (correctly) flag the null/undefined mismatch.
export type VenueListItem = z.infer<typeof VenueListItemSchema>;

const VenueListResponseSchema = z.object({
  data: z.array(VenueListItemSchema),
  meta: z.object({ next_cursor: z.string().nullable(), has_more: z.boolean() }),
});

export function getVenues(query: Record<string, string>) {
  const qs = new URLSearchParams(query).toString();
  return fetchValidated(`/venues?${qs}`, VenueListResponseSchema);
}

// `GET /venues/map` (apps/api's `VenuesController.mapView` -> `VenuesRepository.findInBbox`)
// returns a plain array (no `data`/`meta` envelope) of `{ id, name, category, lat, lng }` — a raw
// SQL projection distinct from both `VenueListItemSchema` (no lat/lng) and `VenueSchema` (no
// lat/lng at all), so it gets its own schema rather than reusing either.
const MapVenueSchema = z.object({
  id: VenueSchema.shape.id,
  name: VenueSchema.shape.name,
  category: VenueSchema.shape.category,
  lat: z.number(),
  lng: z.number(),
});

export type MapVenue = z.infer<typeof MapVenueSchema>;

const MapVenueListSchema = z.array(MapVenueSchema);

export function getVenuesInBbox(bbox: [number, number, number, number]) {
  return fetchValidated(`/venues/map?bbox=${bbox.join(",")}`, MapVenueListSchema);
}

export function getVenueBySlug(slug: string): Promise<VenueDetail> {
  return fetchValidated(`/venues/${slug}`, VenueDetailSchema);
}

export function getDistricts(): Promise<District[]> {
  return fetchValidated(`/districts?city=istanbul`, z.array(DistrictSchema));
}

export function getNearestDistrict(lat: number, lng: number): Promise<District> {
  return fetchValidated(`/districts/nearest?lat=${lat}&lng=${lng}`, DistrictSchema);
}

export function getFavoriteLists(token: string) {
  return fetchValidated(`/me/lists`, z.array(FavoriteListSchema), token);
}

const CreatedFavoriteListSchema = FavoriteListSchema; // POST /me/lists returns the created list, same shape

export async function createFavoriteList(token: string, name: string) {
  const authedClient = createApiClient(API_BASE, () => token);
  const raw = await authedClient.post<unknown>(`/me/lists`, { name });
  const result = CreatedFavoriteListSchema.safeParse(raw);
  if (!result.success) throw new ApiValidationError("/me/lists", result.error.issues);
  return result.data;
}

const ReportResponseSchema = z.object({ urgent: z.boolean() });

export async function reportVenue(venueId: string, reason: string) {
  const res = await fetch(`${API_BASE}/venues/${venueId}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(`Report failed: ${res.status}`);
  const raw = await res.json();
  const result = ReportResponseSchema.safeParse(raw);
  if (!result.success) throw new ApiValidationError(`/venues/${venueId}/report`, result.error.issues);
  return result.data;
}
