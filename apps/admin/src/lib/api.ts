import { createApiClient, ApiHttpError } from "@gurmego/api-client";
import {
  AdminQueueListSchema,
  AdminQueueMutationResultSchema,
  CsvImportResultSchema,
  DataQualityReportSchema,
  AdminUserSearchResultSchema,
  type AdminQueueItem,
  type CsvImportResult,
  type DataQualityReport,
  type AdminUserSearchResult,
} from "@gurmego/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/v1";

export class ApiValidationError extends Error {
  constructor(public endpoint: string, public issues: unknown) {
    super(`Validation failed for ${endpoint}`);
    this.name = "ApiValidationError";
  }
}

// `type` is NOT a caller-supplied option — this app only ever displays REPORT items (see the
// AdminQueueItemSchema comment), so the filter is hardcoded here, structurally, rather than left to
// every call site to remember. A pending EDIT/re_verify item elsewhere in the real queue must never
// be able to break this app's one page.
//
// This deliberately narrows the plan's Task 3 "Produces" signature (`getQueue(token, {type?,
// status?})`, docs/superpowers/plans/2026-07-25-admin-panel.md) — `type` was dropped, not left
// optional, specifically so a caller can never override the REPORT-only lock above. Contract note,
// not a behavior gap: this signature is final for this app's narrowed 2-page scope.
export async function getQueue(token: string, filters: { status?: string } = {}): Promise<AdminQueueItem[]> {
  const client = createApiClient(API_BASE, () => token);
  const params = new URLSearchParams({ type: "REPORT", ...filters }).toString();
  const raw = await client.get<unknown>(`/admin/queue?${params}`);
  const result = AdminQueueListSchema.safeParse(raw);
  if (!result.success) throw new ApiValidationError("/admin/queue", result.error.issues);
  return result.data;
}

export async function approveQueueItem(token: string, id: string): Promise<void> {
  const client = createApiClient(API_BASE, () => token);
  const raw = await client.post<unknown>(`/admin/queue/${id}/approve`, {});
  const result = AdminQueueMutationResultSchema.safeParse(raw);
  if (!result.success) throw new ApiValidationError(`/admin/queue/${id}/approve`, result.error.issues);
}

export async function rejectQueueItem(token: string, id: string): Promise<void> {
  const client = createApiClient(API_BASE, () => token);
  const raw = await client.post<unknown>(`/admin/queue/${id}/reject`, {});
  const result = AdminQueueMutationResultSchema.safeParse(raw);
  if (!result.success) throw new ApiValidationError(`/admin/queue/${id}/reject`, result.error.issues);
}

export async function searchUsers(token: string, term: string): Promise<AdminUserSearchResult> {
  const client = createApiClient(API_BASE, () => token);
  const raw = await client.get<unknown>(`/admin/users?search=${encodeURIComponent(term)}`);
  const result = AdminUserSearchResultSchema.safeParse(raw);
  if (!result.success) throw new ApiValidationError("/admin/users", result.error.issues);
  return result.data;
}

// No response schema: the caller re-runs searchUsers() after a successful assign to pick up the
// new role, same as approveQueueItem()/rejectQueueItem() not returning the mutated row -- the
// success/failure of the PUT (thrown ApiHttpError on non-2xx) is all a caller needs here.
export async function assignRole(token: string, userId: string, role: string): Promise<void> {
  const client = createApiClient(API_BASE, () => token);
  await client.put(`/admin/users/${userId}/roles`, { role });
}

export async function getDataQualityReport(token: string): Promise<DataQualityReport> {
  const client = createApiClient(API_BASE, () => token);
  const raw = await client.get<unknown>("/admin/reports/data-quality");
  const result = DataQualityReportSchema.safeParse(raw);
  if (!result.success) throw new ApiValidationError("/admin/reports/data-quality", result.error.issues);
  return result.data;
}

export async function importCsv(token: string, file: File): Promise<CsvImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/admin/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  // Uses ApiHttpError (not a plain Error) for the same reason createApiClient's .get/.post do:
  // callers need the status code to distinguish a 401 (session expired) or 403 (insufficient role)
  // from a generic failure, so they can show an accurate, actionable message instead of a blanket
  // "something went wrong".
  if (!res.ok) throw new ApiHttpError(res.status, `Import failed: ${res.status}`);
  const raw: unknown = await res.json();
  const result = CsvImportResultSchema.safeParse(raw);
  if (!result.success) throw new ApiValidationError("/admin/import", result.error.issues);
  return result.data;
}
