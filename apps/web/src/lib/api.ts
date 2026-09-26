import { createApiClient } from "@gurmego/api-client";
import {
  VenueDetailSchema,
  DistrictSchema,
  FavoriteListSchema,
  FavoriteSchema,
  VenueListResponseSchema,
  MapVenueListSchema,
  ReportResponseSchema,
  SuggestVenueResponseSchema,
  type VenueDetail,
  type District,
  type SuggestVenue,
} from "@gurmego/shared";
export type { VenueListItem, MapVenue } from "@gurmego/shared";
import { z } from "zod";
import type { Coords } from "./use-geolocation";

export class ApiValidationError extends Error {
  constructor(public path: string, public issues: unknown) {
    super(`API response for ${path} did not match expected schema`);
    this.name = "ApiValidationError";
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/v1";
const client = createApiClient(API_BASE);

export function locationHeaders(coords?: Coords | null): Record<string, string> {
  return coords ? { "X-User-Location": `${coords.lat},${coords.lng}` } : {};
}

// Next 15+ no longer caches a bare fetch(). Server-rendered reads opt into a short TTL: without it every
// page view hits the API, and since all SSR traffic shares the web server's single IP, the API's
// per-IP read rate limit would throttle every user at once. Freshness cost: a newly approved venue can
// take up to the TTL to show on the list (the detail page has its own hourly ISR).
const DISTRICTS_REVALIDATE_S = 300;
const VENUE_LIST_REVALIDATE_S = 60;

async function fetchValidated<T>(
  path: string,
  schema: z.ZodType<T>,
  token?: string,
  headers?: Record<string, string>,
  revalidate?: number,
): Promise<T> {
  const authedClient = token ? createApiClient(API_BASE, () => token) : client;
  const raw = await authedClient.get<unknown>(path, {
    headers,
    ...(revalidate !== undefined ? { next: { revalidate } } : {}),
  });
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiValidationError(path, result.error.issues);
  return result.data;
}

export function getVenues(query: Record<string, string>, coords?: Coords | null) {
  const qs = new URLSearchParams(query).toString();
  return fetchValidated(`/venues?${qs}`, VenueListResponseSchema, undefined, locationHeaders(coords), VENUE_LIST_REVALIDATE_S);
}

export function getVenuesInBbox(bbox: [number, number, number, number]) {
  return fetchValidated(`/venues/map?bbox=${bbox.join(",")}`, MapVenueListSchema);
}

export function getVenueBySlug(slug: string): Promise<VenueDetail> {
  return fetchValidated(`/venues/${slug}`, VenueDetailSchema);
}

export function getDistricts(): Promise<District[]> {
  return fetchValidated(`/districts?city=istanbul`, z.array(DistrictSchema), undefined, undefined, DISTRICTS_REVALIDATE_S);
}

export async function getNearestDistrict(coords: Coords): Promise<District> {
  return fetchValidated("/districts/nearest", DistrictSchema, undefined, locationHeaders(coords));
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

// `POST /me/lists/:id/venues` (apps/api's `FavoritesController.addVenue` -> `FavoritesService.addVenue`)
// returns the upserted Prisma `Favorite` row — validated like every other response in this file.
export async function addFavoriteVenue(token: string, listId: string, venueId: string): Promise<void> {
  const authedClient = createApiClient(API_BASE, () => token);
  const raw = await authedClient.post<unknown>(`/me/lists/${listId}/venues`, { venueId });
  const result = FavoriteSchema.safeParse(raw);
  if (!result.success) throw new ApiValidationError(`/me/lists/${listId}/venues`, result.error.issues);
}

export async function removeFavoriteVenue(token: string, listId: string, venueId: string): Promise<void> {
  const authedClient = createApiClient(API_BASE, () => token);
  await authedClient.delete(`/me/lists/${listId}/venues/${venueId}`);
}

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

export async function suggestVenue(submission: SuggestVenue) {
  const res = await fetch(`${API_BASE}/venue-suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
  if (!res.ok) throw new Error(`Suggestion failed: ${res.status}`);
  const raw = await res.json();
  const result = SuggestVenueResponseSchema.safeParse(raw);
  if (!result.success) throw new ApiValidationError("/venue-suggestions", result.error.issues);
  return result.data;
}
