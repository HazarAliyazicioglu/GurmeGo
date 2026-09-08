import {
  VenueDetailSchema,
  DistrictSchema,
  FavoriteListSchema,
  FavoriteSchema,
  VenueListResponseSchema,
  MapVenueListSchema,
  ReportResponseSchema,
  type VenueDetail,
  type District,
  type VenueListItem,
  type MapVenue,
} from "@gurmego/shared";
import { z } from "zod";
import { API_BASE_URL } from "./env";

export type { VenueListItem, MapVenue };

export class ApiValidationError extends Error {
  constructor(public path: string, public issues: unknown) {
    super(`API response for ${path} did not match expected schema`);
    this.name = "ApiValidationError";
  }
}

export interface Coords {
  lat: number;
  lng: number;
}

export function locationHeaders(coords?: Coords | null): Record<string, string> {
  return coords ? { "X-User-Location": `${coords.lat},${coords.lng}` } : {};
}

async function fetchValidated<T>(
  path: string,
  schema: z.ZodType<T>,
  token?: string,
  headers?: Record<string, string>,
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status} for ${path}`);
  const raw: unknown = await res.json();
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiValidationError(path, result.error.issues);
  return result.data;
}

export function getVenues(query: Record<string, string>, coords?: Coords | null) {
  const qs = new URLSearchParams(query).toString();
  return fetchValidated(`/venues?${qs}`, VenueListResponseSchema, undefined, locationHeaders(coords));
}

// Pages through every venue via cursor pagination (server caps a single page at 50 -- see
// VenueListQuerySchema in packages/shared) and flattens the result into one list. Used where a
// caller needs the FULL venue set for a client-side id-to-slug lookup (MapScreen) rather than one
// page of it -- a single unpaginated getVenues({}) call silently drops venues past the first page
// once there are more than the default limit.
export async function getAllVenues(): Promise<VenueListItem[]> {
  const all: VenueListItem[] = [];
  let cursor: string | undefined;
  for (;;) {
    const query: Record<string, string> = { limit: "50" };
    if (cursor) query.cursor = cursor;
    const res = await getVenues(query);
    all.push(...res.data);
    if (!res.meta.has_more || !res.meta.next_cursor) break;
    cursor = res.meta.next_cursor;
  }
  return all;
}

export function getVenueBySlug(slug: string): Promise<VenueDetail> {
  return fetchValidated(`/venues/${slug}`, VenueDetailSchema);
}

export function getDistricts(): Promise<District[]> {
  return fetchValidated(`/districts?city=istanbul`, z.array(DistrictSchema));
}

// `GET /venues/map` -- same bbox-scoped multi-venue endpoint apps/web's discovery map uses
// (getVenuesInBbox in apps/web/src/lib/api.ts). Returns a minimal projection (id/name/category/
// lat/lng, no slug) -- callers cross-reference by `id` against an already-fetched `VenueListItem[]`
// to recover the slug needed for navigation, same as apps/web's venue-map-leaflet.tsx does.
export function getVenuesInBbox(bbox: [number, number, number, number]): Promise<MapVenue[]> {
  return fetchValidated(`/venues/map?bbox=${bbox.join(",")}`, MapVenueListSchema);
}

export function getFavoriteLists(token: string) {
  return fetchValidated(`/me/lists`, z.array(FavoriteListSchema), token);
}

export async function createFavoriteList(token: string, name: string) {
  const res = await fetch(`${API_BASE_URL}/me/lists`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`API error ${res.status} for /me/lists`);
  const raw: unknown = await res.json();
  const result = FavoriteListSchema.safeParse(raw);
  if (!result.success) throw new ApiValidationError("/me/lists", result.error.issues);
  return result.data;
}

export async function addFavoriteVenue(token: string, listId: string, venueId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/me/lists/${listId}/venues`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ venueId }),
  });
  if (!res.ok) throw new Error(`API error ${res.status} for /me/lists/${listId}/venues`);
  const raw: unknown = await res.json();
  const result = FavoriteSchema.safeParse(raw);
  if (!result.success) throw new ApiValidationError(`/me/lists/${listId}/venues`, result.error.issues);
}

export async function removeFavoriteVenue(token: string, listId: string, venueId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/me/lists/${listId}/venues/${venueId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API error ${res.status} for DELETE /me/lists/${listId}/venues/${venueId}`);
}

export async function reportVenue(venueId: string, reason: string) {
  const res = await fetch(`${API_BASE_URL}/venues/${venueId}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(`Report failed: ${res.status}`);
  const raw: unknown = await res.json();
  const result = ReportResponseSchema.safeParse(raw);
  if (!result.success) throw new ApiValidationError(`/venues/${venueId}/report`, result.error.issues);
  return result.data;
}
