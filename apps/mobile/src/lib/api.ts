import {
  VenueDetailSchema,
  DistrictSchema,
  FavoriteListSchema,
  FavoriteSchema,
  VenueListResponseSchema,
  ReportResponseSchema,
  type VenueDetail,
  type District,
  type VenueListItem,
} from "@gurmego/shared";
import { z } from "zod";
import { API_BASE_URL } from "./env";

export type { VenueListItem };

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

export function getVenueBySlug(slug: string): Promise<VenueDetail> {
  return fetchValidated(`/venues/${slug}`, VenueDetailSchema);
}

export function getDistricts(): Promise<District[]> {
  return fetchValidated(`/districts?city=istanbul`, z.array(DistrictSchema));
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
