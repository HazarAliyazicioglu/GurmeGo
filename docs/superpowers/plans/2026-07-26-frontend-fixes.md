# GurmeGo — Plan 4c: Frontend/Admin Kritik Düzeltmeler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every frontend/admin finding from `docs/AUDIT-2026-07-26.md`, per
`docs/superpowers/specs/2026-07-26-frontend-fixes-design.md` (HAZIR after 5 idea-red-team rounds):
propagate the `X-User-Location` header (ADR 004, Plan 4b) through the actual API client chain;
fix error-handling gaps (auth session, discovery race conditions, favorite button, auth form);
fix map/location correctness (fixed district centers, one-time auto-sort); complete venue detail
(address/map/photos/share); sync admin curation copy with Plan 4b's A3 decision; add favorites
collections + open-now filter (+ fix the boutique toggle for Plan 4b's schema change); complete
the category quick-route deep link; accessibility; code-quality cleanup.

**Architecture:** No new backend calls beyond what Plan 4b already exposes. The only new runtime
mechanism is header propagation through the existing `packages/api-client` → `apps/web/src/lib/api.ts`
chain — everything else is component-level React state/effect fixes or copy changes.

**Tech Stack:** Next.js (App Router), React, Vitest + `@testing-library/react` (this codebase's
established test pattern — co-located `*.spec.tsx`, `vi.mock` for `@/lib/api`/`@/lib/auth-context`,
`data-testid` queries).

## Global Constraints

- Clients (`apps/web`, `apps/admin`) contain no business logic — display + request layer only.
- `X-User-Location` header format: `"<lat>,<lng>"` — identical to Plan 4b's `UserLocationHeaderSchema`.
- Without location permission/on denial, manual district selection must keep full functionality.
- This plan depends on Plan 4b being complete (it is — `VenueListQuerySchema` has no `lat`/`lng`,
  `VenueDetailSchema` has `lat`/`lng`/`address`/`photos`, `open_now` filter exists, boutique
  toggle's `isBoutique=false` now 400s per `OptionalTrueFlag`).
- Follow this codebase's existing test convention exactly: Vitest, `@testing-library/react`,
  co-located `ComponentName.spec.tsx`, `vi.mock("@/lib/api", ...)` / `vi.mock("@/lib/auth-context", ...)`.

---

## Task 1: API client header propagation (atomic — signature change + all direct callers)

Owns `packages/api-client`'s `get()` signature and its only two direct callers in `apps/web`
(`fetchValidated`, and through it, `getVenues`/`getNearestDistrict`). This is the foundational
piece Tasks 2+ depend on.

**Files:**
- Modify: `packages/api-client/src/index.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/components/venue-filters.tsx` (`serializeFilters` — stops emitting `lat`/`lng`)
- Test: `packages/api-client` doesn't currently have its own test file (confirmed no existing
  pattern there) — add `packages/api-client/src/index.spec.ts` (new); `apps/web/src/lib/api.spec.ts`
  (append); `apps/web/src/components/venue-filters.spec.tsx` (append)

**Interfaces:**
- Consumes: nothing new (Plan 4b already defines the header contract)
- Produces: `createApiClient(...).get<T>(path, options?: { headers?: Record<string,string> })`;
  `fetchValidated(path, schema, token?, headers?)`; `locationHeaders(coords?)`; `getVenues`/
  `getNearestDistrict` now accept a `coords` parameter and send the header instead of query params;
  `serializeFilters` no longer puts `lat`/`lng` into its returned query object.

- [ ] **Step 1: Write the failing test for `createApiClient().get()`'s new headers option**
```typescript
// packages/api-client/src/index.spec.ts (new file)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApiClient } from "./index";

describe("createApiClient().get — headers option", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  });

  it("merges custom headers with the Authorization header", async () => {
    const client = createApiClient("http://api.test", () => "tok123");
    await client.get("/venues", { headers: { "X-User-Location": "40.99,29.02" } });
    expect(global.fetch).toHaveBeenCalledWith(
      "http://api.test/venues",
      expect.objectContaining({
        headers: { Authorization: "Bearer tok123", "X-User-Location": "40.99,29.02" },
      }),
    );
  });

  it("works with no custom headers (existing behavior unchanged)", async () => {
    const client = createApiClient("http://api.test");
    await client.get("/venues");
    expect(global.fetch).toHaveBeenCalledWith("http://api.test/venues", expect.objectContaining({ headers: {} }));
  });
});
```
- [ ] **Step 2:** Run: `cd apps/web && npx vitest run ../../packages/api-client/src/index.spec.ts` — FAIL
      (`get()` doesn't accept a second argument yet, confirmed by reading the real current file).
- [ ] **Step 3: Update `packages/api-client/src/index.ts`'s `get()`**
```typescript
    async get<T>(path: string, options?: { headers?: Record<string, string> }): Promise<T> {
      const token = getToken?.();
      const res = await fetch(`${baseUrl}${path}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
      });
      if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
      return res.json();
    },
```
(Leave `post()` untouched — this plan doesn't need header support there.)
- [ ] **Step 4:** Run — PASS (2 tests).

- [ ] **Step 5: Write the failing test for `fetchValidated`'s new `headers` param and `locationHeaders`**
```typescript
// apps/web/src/lib/api.spec.ts (append)
describe("locationHeaders", () => {
  it("returns X-User-Location when coords provided", () => {
    expect(locationHeaders({ lat: 40.99, lng: 29.02 })).toEqual({ "X-User-Location": "40.99,29.02" });
  });
  it("returns an empty object when coords is null/undefined", () => {
    expect(locationHeaders(null)).toEqual({});
    expect(locationHeaders(undefined)).toEqual({});
  });
});

describe("getVenues — sends location header instead of query params", () => {
  it("does not put lat/lng in the query string, sends X-User-Location instead", async () => {
    const getSpy = vi.spyOn(client, "get").mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });
    await getVenues({ districtId: "d1" }, { lat: 40.99, lng: 29.02 });
    const [pathArg, optionsArg] = getSpy.mock.calls[0];
    expect(pathArg).not.toContain("lat=");
    expect(pathArg).not.toContain("lng=");
    expect(optionsArg).toEqual({ headers: { "X-User-Location": "40.99,29.02" } });
  });
});
```
(Adjust the exact mock target — `client.get` vs `authedClient.get` — to match `fetchValidated`'s
real internal structure once you've read the file; the point is proving the header reaches the
underlying `get()` call, not the query string.)
- [ ] **Step 6:** Run — FAIL (`locationHeaders` doesn't exist, `getVenues` doesn't take a `coords` param yet).
- [ ] **Step 7: Implement in `apps/web/src/lib/api.ts`**
```typescript
export function locationHeaders(coords?: { lat: number; lng: number } | null): Record<string, string> {
  return coords ? { "X-User-Location": `${coords.lat},${coords.lng}` } : {};
}

async function fetchValidated<T>(
  path: string,
  schema: z.ZodType<T>,
  token?: string,
  headers?: Record<string, string>,
): Promise<T> {
  const authedClient = token ? createApiClient(API_BASE, () => token) : client;
  const raw = await authedClient.get<unknown>(path, { headers });
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiValidationError(result.error);
  return result.data;
}
```
Update `getVenues`'s signature to `getVenues(query: Record<string, string>, coords?: { lat: number; lng: number } | null, token?: string)`, passing `locationHeaders(coords)` as `fetchValidated`'s 4th argument. Update `getNearestDistrict`'s signature to `getNearestDistrict(coords: { lat: number; lng: number }, token?: string)` (coords is REQUIRED here, not optional — Plan 4b's `/districts/nearest` 400s without the header, and this function's only real caller, `district-picker.tsx`, already only calls it when coords exist), building the URL as `/districts/nearest` (no query params at all) and passing `locationHeaders(coords)` as the headers argument.
(Read the real current `fetchValidated`/`getVenues`/`getNearestDistrict` signatures first — this
replaces their bodies, keep every other existing behavior, e.g. `URLSearchParams` construction
for the remaining non-location query params, unchanged.)
- [ ] **Step 8:** Run — PASS.

- [ ] **Step 9: `serializeFilters` stops emitting `lat`/`lng`**
```typescript
// apps/web/src/components/venue-filters.tsx
export function serializeFilters(filters: FilterState, coords?: Coords | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.category) out.category = filters.category;
  if (filters.priceRange) out.priceRange = filters.priceRange;
  if (filters.isBoutique !== undefined) out.isBoutique = String(filters.isBoutique);
  if (filters.radiusM !== undefined && coords) out.radiusM = String(filters.radiusM);
  return out;
}
```
Write the failing test first (append to `venue-filters.spec.tsx`):
```typescript
describe("serializeFilters — no longer emits lat/lng", () => {
  it("omits lat/lng even when coords and radiusM are both present", () => {
    const out = serializeFilters({ radiusM: 2000 }, { lat: 40.99, lng: 29.02 });
    expect(out).toEqual({ radiusM: "2000" });
    expect(out.lat).toBeUndefined();
    expect(out.lng).toBeUndefined();
  });
});
```
Run — FAIL, then apply the change above, run — PASS.

- [ ] **Step 10:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit` (and `cd ../../packages/api-client && npx vitest run` if it has its own script — check `package.json`; otherwise the test above already ran from `apps/web`'s workspace resolution). Confirm every existing caller of `getVenues`/`getNearestDistrict` in the codebase (`discovery-client.tsx`, `district-picker.tsx`, `[district]/page.tsx`) still compiles — this is exactly why this task bundles the signature change with all its callers; if any caller needs updating to pass `coords`, that's this task's job too, not deferred.
- [ ] **Step 11: Commit**
```bash
git add packages/api-client/src apps/web/src/lib/api.ts apps/web/src/lib/api.spec.ts apps/web/src/components/venue-filters.tsx apps/web/src/components/venue-filters.spec.tsx
git commit -m "feat(web): propagate X-User-Location header through api-client and getVenues/getNearestDistrict, stop sending lat/lng as query params"
```

---

## Task 2: Wire the header through every caller (`discovery-client.tsx`, `district-picker.tsx`, `[district]/page.tsx`)

Task 1 changed `getVenues`/`getNearestDistrict`'s signatures; this task updates every call site to
actually pass `coords`, closing the loop so the header reaches real requests end to end.

**Files:**
- Modify: `apps/web/src/components/discovery-client.tsx`
- Modify: `apps/web/src/components/district-picker.tsx`
- Test: `apps/web/src/components/discovery-client.spec.tsx` (append), `apps/web/src/components/district-picker.spec.tsx` (append, or new if it doesn't exist yet — check)

**Interfaces:**
- Consumes: Task 1's `getVenues(query, coords, token?)`, `getNearestDistrict(coords, token?)`
- Produces: `DiscoveryClient`'s `applyFilters` now passes `coords` to `getVenues`; `district-picker.tsx`'s suggestion call passes `coords` to `getNearestDistrict`.

- [ ] **Step 1: Write the failing test**
```typescript
// discovery-client.spec.tsx (append)
describe("DiscoveryClient — passes coords to getVenues", () => {
  it("calls getVenues with the resolved coords as the second argument", async () => {
    vi.mocked(useGeolocationMock).mockReturnValue({ lat: 40.99, lng: 29.02 }); // adjust to this file's actual useGeolocation mock pattern once read
    render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    await waitFor(() => {
      expect(getVenuesMock).toHaveBeenCalledWith(expect.any(Object), { lat: 40.99, lng: 29.02 });
    });
  });
});
```
(Adjust to this file's real existing mock setup for `useGeolocation`/`getVenues` — read the current
spec file first to match its established mocking pattern exactly, don't invent a new one.)
- [ ] **Step 2:** Run — FAIL (current `applyFilters` calls `getVenues(query)` with one argument, per the real file).
- [ ] **Step 3:** Update `discovery-client.tsx`'s `applyFilters` to pass `coords` as the second argument to `getVenues`. Read the actual current function body first — this is a one-argument addition to an existing call, not a rewrite.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Same pattern for `district-picker.tsx`'s `useSuggestedDistrict` — find where it calls `getNearestDistrict` (currently with no arguments or with `lat`/`lng` split, per the old signature) and update to pass the single `coords` object Task 1's new signature expects. Write the failing test, confirm it fails, fix, confirm it passes.
- [ ] **Step 6:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 7: Commit**
```bash
git add apps/web/src/components/discovery-client.tsx apps/web/src/components/discovery-client.spec.tsx apps/web/src/components/district-picker.tsx apps/web/src/components/district-picker.spec.tsx
git commit -m "feat(web): wire coords through to getVenues/getNearestDistrict call sites"
```

---

## Task 3: Error handling fixes (C1, C2, C11, C12)

Four independent, small, single-file fixes — bundled into one task since none changes a shared
signature and each is trivially reviewable on its own merits.

**Files:**
- Modify: `apps/web/src/lib/auth-context.tsx` (C1)
- Modify: `apps/web/src/components/discovery-client.tsx` (C2)
- Modify: `apps/web/src/components/favorite-button.tsx` (C11)
- Modify: `apps/web/src/components/auth-form.tsx` (C12)
- Test: each file's existing `.spec.tsx` (append)

**Interfaces:**
- Consumes: nothing new
- Produces: `auth-context.tsx` no longer throws unhandled on `getSession()` rejection;
  `DiscoveryClient` has `loading`/`error` state and discards stale responses via a request-id ref;
  `FavoriteButton` checks real favorite state on mount and disables itself mid-request;
  `AuthForm` disables its submit button while a request is in flight.

- [ ] **Step 1 (C1): Write the failing test**
```typescript
// auth-context.spec.tsx (append)
describe("AuthProvider — getSession() failure", () => {
  it("does not throw and resolves loading to false when getSession() rejects", async () => {
    vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error("network down"));
    render(<AuthProvider><div data-testid="child" /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("child")).toBeInTheDocument());
    // no unhandled rejection — vitest fails the test suite on one if uncaught
  });
});
```
Run — FAIL (read the real current `useEffect` body first; if `.catch()` is genuinely absent, this
throws an unhandled promise rejection under test). Add `.catch(() => setLoading(false))` (or
whatever the real state-setter is called — check the file) to the `getSession()` promise chain.
Run — PASS.

- [ ] **Step 2 (C2): Write the failing test**
```typescript
// discovery-client.spec.tsx (append)
describe("DiscoveryClient — stale response discarding", () => {
  it("ignores a slow first response if a second request has already started", async () => {
    let resolveFirst: (v: unknown) => void;
    getVenuesMock
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ data: [{ id: "v2", name: "Second" }], meta: { next_cursor: null, has_more: false } });
    render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe")); // triggers request 1
    fireEvent.click(screen.getByTestId("quick-category-bakery")); // triggers request 2 before request 1 resolves
    await waitFor(() => expect(screen.getByText("Second")).toBeInTheDocument());
    resolveFirst!({ data: [{ id: "v1", name: "First" }], meta: { next_cursor: null, has_more: false } });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText("First")).not.toBeInTheDocument();
  });

  it("shows a loading indicator while a request is in flight and an error message on failure", async () => {
    getVenuesMock.mockRejectedValueOnce(new Error("500"));
    render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/hata|yükleniyor/i));
  });
});
```
(Adjust `data-testid`s to whatever this codebase's real `CategoryQuickRoute`/filter trigger elements
are named — check the current file/spec.) Run — FAIL. Add `loading`/`error` state and a
`const latestRequest = useRef(0)` incremented at the start of `applyFilters`, checked after the
`await getVenues(...)` call before calling `setVenues` (same pattern as `venue-map-leaflet.tsx`'s
existing `latestRequest` ref, confirmed already in this codebase — mirror it exactly):
```typescript
const latestRequest = useRef(0);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

async function applyFilters(next: FilterState) {
  const requestId = ++latestRequest.current;
  setFilters(next);
  setLoading(true);
  setError(null);
  try {
    const { data } = await getVenues({ districtId, ...serializeFilters(next, coords) }, coords);
    if (requestId !== latestRequest.current) return;
    setVenues(data);
  } catch {
    if (requestId !== latestRequest.current) return;
    setError("Mekanlar yüklenirken bir hata oluştu.");
  } finally {
    if (requestId === latestRequest.current) setLoading(false);
  }
}
```
Render `{loading && <p role="status">Yükleniyor…</p>}` / `{error && <p role="status">{error}</p>}`
somewhere in the JSX. Run — PASS.

- [ ] **Step 3 (C11): Write the failing test**
```typescript
// favorite-button.spec.tsx (append)
describe("FavoriteButton — real state check and disabled-while-pending", () => {
  it("reflects the venue's real favorite status from GET /me/lists on mount", async () => {
    getMyListsMock.mockResolvedValue([{ id: "l1", name: "Default", venueIds: ["v1"] }]);
    render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByTestId("favorite-button")).toHaveAttribute("aria-pressed", "true"));
  });

  it("disables itself while a toggle request is in flight", async () => {
    let resolveToggle: () => void;
    toggleFavoriteMock.mockReturnValue(new Promise<void>((resolve) => { resolveToggle = resolve; }));
    render(<FavoriteButton venueId="v1" />);
    fireEvent.click(screen.getByTestId("favorite-button"));
    expect(screen.getByTestId("favorite-button")).toBeDisabled();
    resolveToggle!();
    await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled());
  });
});
```
(Match mock names/shapes to what `favorite-button.spec.tsx` already establishes — read it first.)
Run — FAIL. Read the real current component (confirmed it currently doesn't check real state on
mount nor disable during a request), add a mount-time fetch of the user's lists (only if
`useAuth().user` is truthy) to determine initial pressed state, and a `pending` state set `true` on
click / `false` in a `finally` after the toggle call, with `disabled={pending}` on the button. Run — PASS.

- [ ] **Step 4 (C12): Write the failing test**
```typescript
// auth-form.spec.tsx (append)
describe("AuthForm — disabled while submitting", () => {
  it("disables the submit button until the request resolves", async () => {
    let resolveSignIn: () => void;
    signInMock.mockReturnValue(new Promise<void>((resolve) => { resolveSignIn = resolve; }));
    render(<AuthForm mode="sign-in" />);
    fireEvent.click(screen.getByRole("button", { name: /giriş/i }));
    expect(screen.getByRole("button", { name: /giriş/i })).toBeDisabled();
    resolveSignIn!();
    await waitFor(() => expect(screen.getByRole("button", { name: /giriş/i })).not.toBeDisabled());
  });
});
```
Run — FAIL. Add a `submitting` state, `true` on submit start, `false` in a `finally`, `disabled={submitting}` on the submit button. Run — PASS.

- [ ] **Step 5:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 6: Commit**
```bash
git add apps/web/src/lib/auth-context.tsx apps/web/src/lib/auth-context.spec.tsx apps/web/src/components/discovery-client.tsx apps/web/src/components/discovery-client.spec.tsx apps/web/src/components/favorite-button.tsx apps/web/src/components/favorite-button.spec.tsx apps/web/src/components/auth-form.tsx apps/web/src/components/auth-form.spec.tsx
git commit -m "fix(web): handle getSession() failure, discard stale discovery responses, real favorite-button state + disabled-while-pending, disable auth-form while submitting"
```

---

## Task 4: Map/location correctness (C3, C8)

**Files:**
- Create: `apps/web/src/lib/district-centers.ts`
- Modify: `apps/web/src/components/venue-map-leaflet.tsx`
- Modify: `apps/web/src/app/[district]/page.tsx`
- Modify: `apps/web/src/components/discovery-client.tsx`
- Test: `apps/web/src/lib/district-centers.spec.ts` (new), `apps/web/src/components/venue-map-leaflet.spec.tsx` (append), `apps/web/src/components/discovery-client.spec.tsx` (append)

**Interfaces:**
- Consumes: Task 2's `coords` already threaded into `DiscoveryClient`
- Produces: `DISTRICT_CENTERS` constant; `VenueMapLeaflet` takes `centerLat`/`centerLng` props and
  a `key={districtSlug}` at its call site; `DiscoveryClient` auto-sorts to distance exactly once
  when `coords` first resolves, guarded against overriding a real user interaction.

- [ ] **Step 1: Write the failing test for `DISTRICT_CENTERS`**
```typescript
// apps/web/src/lib/district-centers.spec.ts (new)
import { describe, it, expect } from "vitest";
import { DISTRICT_CENTERS, DEFAULT_CENTER } from "./district-centers";

describe("DISTRICT_CENTERS", () => {
  it("has entries for the three MVP districts", () => {
    expect(DISTRICT_CENTERS.kadikoy).toEqual({ lat: 40.9906, lng: 29.0274 });
    expect(DISTRICT_CENTERS.besiktas).toEqual({ lat: 41.0422, lng: 29.0061 });
    expect(DISTRICT_CENTERS.beyoglu).toEqual({ lat: 41.0370, lng: 28.9850 });
  });
  it("has a default fallback for an unknown slug", () => {
    expect(DEFAULT_CENTER).toEqual(expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) }));
  });
});
```
- [ ] **Step 2:** Run — FAIL, then create `apps/web/src/lib/district-centers.ts`:
```typescript
export const DISTRICT_CENTERS: Record<string, { lat: number; lng: number }> = {
  kadikoy: { lat: 40.9906, lng: 29.0274 },
  besiktas: { lat: 41.0422, lng: 29.0061 },
  beyoglu: { lat: 41.0370, lng: 28.9850 },
};

// Istanbul-wide fallback for an unrecognized district slug -- MVP only ships the three keys above.
export const DEFAULT_CENTER = { lat: 41.0082, lng: 28.9784 };
```
- [ ] **Step 3:** Run — PASS.

- [ ] **Step 4: Write the failing test for `VenueMapLeaflet`'s new center props + remount-on-district-change**
```typescript
// venue-map-leaflet.spec.tsx (append)
describe("VenueMapLeaflet — centerLat/centerLng and remount on district change", () => {
  it("passes centerLat/centerLng through to the map container's center", () => {
    render(<VenueMapLeaflet venues={[]} centerLat={40.9906} centerLng={29.0274} />);
    expect(screen.getByTestId("map-container")).toHaveAttribute("data-center", "40.9906,29.0274");
  });
});
```
(Adjust to however this test file already asserts on the mocked `react-leaflet` `MapContainer` —
check the real current spec file's mocking pattern for `MapContainer`/`useMap` before writing this,
since `react-leaflet` is almost certainly mocked given it depends on browser globals.) Run — FAIL,
then update the component to accept `centerLat`/`centerLng` props (read the current signature —
it likely takes `venues` only right now) and pass them into `<MapContainer center={[centerLat, centerLng]} ...>`. Run — PASS.

- [ ] **Step 5: Update `[district]/page.tsx` to resolve and pass the center, and `DiscoveryClient` to forward it with a remount key**

Read `[district]/page.tsx`'s real current content first (already confirmed: a Server Component
calling `getDistricts()`/`getVenues()`, rendering `DistrictPicker` + `DiscoveryClient`). Resolve the
center server-side:
```typescript
import { DISTRICT_CENTERS, DEFAULT_CENTER } from "@/lib/district-centers";
// ...
const center = DISTRICT_CENTERS[params.district] ?? DEFAULT_CENTER;
// pass center.lat / center.lng as props into <DiscoveryClient centerLat={center.lat} centerLng={center.lng} ... />
```
In `discovery-client.tsx`, accept `centerLat`/`centerLng` props and forward them to
`<VenueMapLeaflet key={districtId} centerLat={centerLat} centerLng={centerLng} ... />` — the
`key={districtId}` (or `districtSlug`, whichever prop this component already receives) forces a
remount on district navigation, since `react-leaflet`'s `MapContainer.center` prop is immutable
after first mount (documented React-Leaflet behavior; verified against the current single-page
architecture where `[district]/page.tsx` is a distinct route per district, so a full Next.js page
navigation likely already remounts the tree — the `key` makes this a guarantee, not an assumption).

- [ ] **Step 6: Write the failing test for the one-time auto-sort-to-distance effect**
```typescript
// discovery-client.spec.tsx (append)
describe("DiscoveryClient — one-time auto-sort to distance when coords resolve", () => {
  it("refetches with sort=distance exactly once when coords first become available, not on every render", async () => {
    const { rerender } = render(<DiscoveryClient districtId="d1" initialVenues={[]} coords={null} centerLat={40.99} centerLng={29.02} />);
    rerender(<DiscoveryClient districtId="d1" initialVenues={[]} coords={{ lat: 40.99, lng: 29.02 }} centerLat={40.99} centerLng={29.02} />);
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledTimes(1));
    rerender(<DiscoveryClient districtId="d1" initialVenues={[]} coords={{ lat: 40.99, lng: 29.02 }} centerLat={40.99} centerLng={29.02} />);
    expect(getVenuesMock).toHaveBeenCalledTimes(1); // no second call from the re-render alone
  });

  it("does not auto-refetch if the user already changed a filter before coords resolved", async () => {
    const { rerender } = render(<DiscoveryClient districtId="d1" initialVenues={[]} coords={null} centerLat={40.99} centerLng={29.02} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe")); // user interaction before coords resolve
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledTimes(1));
    rerender(<DiscoveryClient districtId="d1" initialVenues={[]} coords={{ lat: 40.99, lng: 29.02 }} centerLat={40.99} centerLng={29.02} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(getVenuesMock).toHaveBeenCalledTimes(1); // still just the user's own request, no auto override
  });
});
```
(If `coords` is currently resolved INSIDE `DiscoveryClient` via its own `useGeolocation()` call
rather than passed as a prop, adjust this test to mock `useGeolocation`'s return value changing
across renders instead of passing `coords` as a prop — check the real current component structure,
this plan's Task 2 already confirmed `coords = useGeolocation()` is the current pattern.) Run — FAIL.

- [ ] **Step 7:** Implement the guarded one-time effect:
```typescript
const autoSortedRef = useRef(false);
const userInteractedRef = useRef(false);

function handleQuickCategory(category: string) {
  userInteractedRef.current = true;
  void applyFilters({ ...filters, category });
}
// Pass a wrapped onChange to VenueFilters that also sets userInteractedRef.current = true before calling applyFilters.

useEffect(() => {
  if (coords && !autoSortedRef.current && !userInteractedRef.current) {
    autoSortedRef.current = true;
    void applyFilters(filters);
  }
}, [coords]);
```
Run — PASS.

- [ ] **Step 8:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 9: Commit**
```bash
git add apps/web/src/lib/district-centers.ts apps/web/src/lib/district-centers.spec.ts apps/web/src/components/venue-map-leaflet.tsx apps/web/src/components/venue-map-leaflet.spec.tsx apps/web/src/app/\[district\]/page.tsx apps/web/src/components/discovery-client.tsx apps/web/src/components/discovery-client.spec.tsx
git commit -m "fix(web): fixed district map centers with remount-on-navigation, one-time auto-sort-to-distance guarded against overriding user interaction"
```

---

## Task 5: Venue detail completeness (C4, C9, C10)

**Files:**
- Modify: `apps/web/src/components/venue-detail.tsx`
- Modify: `apps/web/src/components/venue-card.tsx`
- Test: `apps/web/src/components/venue-detail.spec.tsx` (append), `apps/web/src/components/venue-card.spec.tsx` (append)

**Interfaces:**
- Consumes: Plan 4b's `VenueDetailSchema` (`lat`/`lng`/`address`/`photos`, already present)
- Produces: `venue-detail.tsx` renders address, a real single-point map, and a photo grid (or empty
  state); a `navigator.share()` button; `venue-card.tsx`'s Google badge text includes "Google yorumu".

- [ ] **Step 1: Write the failing test for address/map/photos**
```typescript
// venue-detail.spec.tsx (append)
describe("VenueDetail — address, real map, photo grid", () => {
  const baseVenue = { /* ...existing test fixture, extended with: */ address: "Bahariye Cd. No:1", lat: 40.99, lng: 29.02, photos: ["https://x/1.jpg", "https://x/2.jpg"] };

  it("renders the venue's address when present", () => {
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.getByText("Bahariye Cd. No:1")).toBeInTheDocument();
  });

  it("does not render an address section when address is null", () => {
    render(<VenueDetail venue={{ ...baseVenue, address: null }} />);
    expect(screen.queryByTestId("venue-address")).not.toBeInTheDocument();
  });

  it("renders the map with the venue's real coordinates, not a placeholder", () => {
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.getByTestId("map-container")).toHaveAttribute("data-center", "40.99,29.02");
  });

  it("renders a photo grid when photos are present", () => {
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("renders an empty state when photos is empty", () => {
    render(<VenueDetail venue={{ ...baseVenue, photos: [] }} />);
    expect(screen.getByText(/henüz fotoğraf eklenmedi/i)).toBeInTheDocument();
  });
});
```
- [ ] **Step 2:** Run — FAIL (read the real current file first — confirmed no address rendering, no
      real map usage, no photo grid at all currently). Implement: conditionally render
      `venue.address` in a labeled block (`data-testid="venue-address"`); replace whatever
      decorative placeholder currently sits where the map should be with
      `<VenueMapLeaflet venues={[]} centerLat={venue.lat} centerLng={venue.lng} singlePoint />`
      (add a `singlePoint` prop to `VenueMapLeaflet` if it doesn't already support rendering just
      one marker at its center with no venue list — check Task 4's changes first to avoid
      duplicating logic); render a photo `<img>` grid when `venue.photos.length > 0`, else the
      empty-state text.
- [ ] **Step 3:** Run — PASS.

- [ ] **Step 4: Write the failing test for the native share button**
```typescript
describe("VenueDetail — native share button", () => {
  it("renders a share button when navigator.share exists", () => {
    Object.defineProperty(navigator, "share", { value: vi.fn(), configurable: true });
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.getByTestId("native-share-button")).toBeInTheDocument();
  });
  it("does not render a share button when navigator.share is unavailable", () => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.queryByTestId("native-share-button")).not.toBeInTheDocument();
  });
});
```
Run — FAIL, then add the button, feature-detected via `"share" in navigator`, matching
`whatsapp-share-button.tsx`'s existing visual pattern (rounded icon circle, label, same
`data-testid` naming convention). Run — PASS.

- [ ] **Step 5: Write the failing test for the Google badge text on `venue-card.tsx`**
```typescript
// venue-card.spec.tsx (append)
describe("VenueCard — Google rating badge text", () => {
  it("shows '4.3 ★ · 120 Google yorumu' format", () => {
    render(<VenueCard venue={{ ...baseVenue, googleRating: 4.3, googleRatingCount: 120 }} />);
    expect(screen.getByText(/4\.3 ★ · 120 Google yorumu/)).toBeInTheDocument();
  });
  it("omits the count segment when googleRatingCount is null", () => {
    render(<VenueCard venue={{ ...baseVenue, googleRating: 4.3, googleRatingCount: null }} />);
    expect(screen.getByText(/4\.3 ★/)).toBeInTheDocument();
    expect(screen.queryByText(/Google yorumu/)).not.toBeInTheDocument();
  });
});
```
Run — FAIL (current format is bare `4.5 (123)`, no star glyph, no "Google" word — confirmed by
reading the real file). Update the badge markup to the new format. Run — PASS.

- [ ] **Step 6:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 7: Commit**
```bash
git add apps/web/src/components/venue-detail.tsx apps/web/src/components/venue-detail.spec.tsx apps/web/src/components/venue-card.tsx apps/web/src/components/venue-card.spec.tsx
git commit -m "feat(web): venue detail shows address/real map/photo grid + native share button, venue-card Google badge attribution text"
```

---

## Task 6: Admin curation copy sync with Plan 4b's A3 decision

**Files:**
- Modify: `apps/admin/src/components/queue-item.tsx`
- Test: `apps/admin/src/components/queue-item.spec.tsx` (append, or wherever this component's existing test lives — check)

**Interfaces:** Consumes nothing new. Produces updated approve-button copy that no longer claims
`verifiedAt` is refreshed on REPORT approval (false since Plan 4b's A3 fix).

- [ ] **Step 1: Write the failing test**
```typescript
describe("QueueItem — approve button copy matches A3 behavior", () => {
  it("does not claim verified_at is refreshed on approve", () => {
    render(<QueueItem item={baseReportItem} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.queryByText(/verified_at.*yeniler/i)).not.toBeInTheDocument();
    expect(screen.getByText(/yalnızca bildirimi incelenmiş olarak işaretler/i)).toBeInTheDocument();
  });
});
```
- [ ] **Step 2:** Run — FAIL (current text confirmed: "Onayla (yalnızca incelendi olarak işaretler ve mekanın verified_at'ini yeniler)"). Update to: "Onayla (yalnızca bildirimi incelenmiş olarak işaretler — mekan bilgisini düzeltmek için ayrıca admin-venues API'sinden/Prisma Studio'dan güncelleme yapılmalı)".
- [ ] **Step 3:** Run — PASS.
- [ ] **Step 4:** Run: `cd apps/admin && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 5: Commit**
```bash
git add apps/admin/src/components/queue-item.tsx apps/admin/src/components/queue-item.spec.tsx
git commit -m "fix(admin): queue-item approve copy no longer claims verified_at refreshes (Plan 4b A3)"
```

---

## Task 7: Favorites collections (C5), open-now filter (C7), boutique toggle fix (Plan 4b schema)

**Files:**
- Modify: `apps/web/src/app/favoriler/page.tsx` (or wherever the favorites page lives — check)
- Modify: `apps/web/src/components/venue-filters.tsx`
- Test: corresponding `.spec.tsx` files (append)

**Interfaces:**
- Consumes: `POST /me/lists` (already exists per the design doc), Plan 4b's `OptionalTrueFlag`
  pattern (already rejects `isBoutique=false`/`openNow=false`)
- Produces: a "create new list" form on the favorites page; an `openNow` toggle in `VenueFilters`;
  `serializeFilters`'s boutique output only ever emits `"true"`, never `"false"`.

- [ ] **Step 1: Write the failing test for the boutique toggle fix** (this is the most urgent of
      the three — Plan 4b's schema change means the CURRENT toggle logic actively breaks in
      production the moment both plans are live, since `update({ isBoutique: !filters.isBoutique })`
      can produce `isBoutique: false`, which the backend now rejects with 400)
```typescript
// venue-filters.spec.tsx (append)
describe("VenueFilters — boutique toggle only ever sets true or undefined", () => {
  it("toggles between undefined and true, never sets false", () => {
    const onChange = vi.fn();
    const { rerender } = render(<VenueFilters filters={{}} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ isBoutique: true }));
    rerender(<VenueFilters filters={{ isBoutique: true }} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ isBoutique: undefined }));
  });
});
```
- [ ] **Step 2:** Run — FAIL (current logic: `update({ isBoutique: !filters.isBoutique })`, which
      from `true` produces `false`, not `undefined`). Change to:
```typescript
onClick={() => update({ isBoutique: filters.isBoutique ? undefined : true })}
```
`serializeFilters`'s existing `if (filters.isBoutique !== undefined) out.isBoutique = String(filters.isBoutique)` line stays unchanged — it will now only ever see `true` or `undefined`, so it only ever emits `"true"`, never `"false"`.
- [ ] **Step 3:** Run — PASS.

- [ ] **Step 4: Write the failing test for the `openNow` toggle**
```typescript
describe("VenueFilters — openNow toggle", () => {
  it("toggles between undefined and true", () => {
    const onChange = vi.fn();
    render(<VenueFilters filters={{}} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("filter-open-now"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ openNow: true }));
  });
});
```
Run — FAIL. Add an `openNow?: boolean` field to `FilterState`, a toggle button matching the
boutique toggle's exact same true/undefined pattern, and add `if (filters.openNow) out.openNow = "true";` to `serializeFilters`. Run — PASS.

- [ ] **Step 5: Write the failing test for the favorites "create list" form**
```typescript
// favoriler/page.spec.tsx (append, or new file if none exists — check first)
describe("Favorites page — create new list", () => {
  it("submits a new list name via POST /me/lists and shows it in the list", async () => {
    createListMock.mockResolvedValue({ id: "l2", name: "Kadıköy Kahveleri" });
    render(<FavoritesPage />);
    fireEvent.change(screen.getByLabelText(/liste adı/i), { target: { value: "Kadıköy Kahveleri" } });
    fireEvent.click(screen.getByRole("button", { name: /oluştur/i }));
    await waitFor(() => expect(createListMock).toHaveBeenCalledWith("Kadıköy Kahveleri"));
    expect(await screen.findByText("Kadıköy Kahveleri")).toBeInTheDocument();
  });
});
```
Run — FAIL. Add a small form (name input + submit) that calls the existing `createList`/`POST /me/lists`
API function (check `apps/web/src/lib/api.ts` for its exact existing name), appends the new list
to local state on success. If more than one list exists, add a simple tab/dropdown switcher between
them (read the current page structure first — if it currently assumes a single list, this task
needs to introduce the minimal state to support switching, per YAGNI don't build more than a
tab list). Run — PASS.

- [ ] **Step 6:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 7: Commit**
```bash
git add apps/web/src/app/favoriler apps/web/src/components/venue-filters.tsx apps/web/src/components/venue-filters.spec.tsx
git commit -m "feat(web): favorites collection creation UI, open-now filter, fix boutique toggle for Plan 4b's OptionalTrueFlag schema (false is now rejected)"
```

---

## Task 8: Category quick-route deep link completion (C6)

**Files:**
- Create: `apps/web/src/lib/directions.ts`
- Modify: `apps/web/src/components/venue-detail.tsx` (extract `directionsUrl` out)
- Modify: `apps/web/src/components/category-quick-route.tsx`
- Modify: `apps/web/src/components/discovery-client.tsx` (pass new props through)
- Modify: `apps/web/src/app/[district]/page.tsx` (pass district name down)
- Test: `apps/web/src/lib/directions.spec.ts` (new), `apps/web/src/components/category-quick-route.spec.tsx` (append)

**Interfaces:**
- Consumes: `venues`/`coordsAvailable`, both already present in `DiscoveryClient`'s state (Tasks 2/4)
- Produces: `directionsUrl(venueName, districtName)` (extracted, shared); `CategoryQuickRoute` takes
  `venues: VenueListItem[]`, `districtName: string`, `coordsAvailable: boolean` and renders a
  real directions link to the first (nearest-if-sorted) matching venue.

- [ ] **Step 1: Write the failing test for the extracted `directionsUrl`**
```typescript
// apps/web/src/lib/directions.spec.ts (new)
import { describe, it, expect } from "vitest";
import { directionsUrl } from "./directions";

describe("directionsUrl", () => {
  it("builds a Google Maps text-search deep link from name + district", () => {
    const url = directionsUrl("Cafe Test", "Kadıköy");
    expect(url).toBe("https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent("Cafe Test Kadıköy"));
  });
});
```
- [ ] **Step 2:** Run — FAIL (file doesn't exist), then create `apps/web/src/lib/directions.ts`:
```typescript
export function directionsUrl(venueName: string, districtName: string): string {
  const query = encodeURIComponent(`${venueName} ${districtName}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}
```
Update `venue-detail.tsx`'s local `directionsUrl` to import and use this shared version instead
(`directionsUrl(venue.name, venue.district.name)`), deleting the local duplicate. Run existing
`venue-detail.spec.tsx` tests to confirm no regression.
- [ ] **Step 3:** Run — PASS.

- [ ] **Step 4: Write the failing test for `CategoryQuickRoute`'s new props**
```typescript
// category-quick-route.spec.tsx (append)
describe("CategoryQuickRoute — direct directions link", () => {
  const venues = [{ id: "v1", name: "First Cafe", category: "cafe" }, { id: "v2", name: "Second Cafe", category: "cafe" }];

  it("renders a directions link to the first matching venue when coordsAvailable is true, labeled 'En yakın'", () => {
    render(<CategoryQuickRoute venues={venues} districtName="Kadıköy" coordsAvailable onSelectCategory={vi.fn()} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    const link = screen.getByRole("link", { name: /en yakın cafe mekana git/i });
    expect(link).toHaveAttribute("href", expect.stringContaining(encodeURIComponent("First Cafe Kadıköy")));
  });

  it("uses neutral copy (not 'en yakın') when coordsAvailable is false", () => {
    render(<CategoryQuickRoute venues={venues} districtName="Kadıköy" coordsAvailable={false} onSelectCategory={vi.fn()} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    expect(screen.getByRole("link", { name: /cafe mekana git/i })).toBeInTheDocument();
    expect(screen.queryByText(/en yakın/i)).not.toBeInTheDocument();
  });

  it("renders no directions link when no venue matches the selected category", () => {
    render(<CategoryQuickRoute venues={[]} districtName="Kadıköy" coordsAvailable onSelectCategory={vi.fn()} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
```
- [ ] **Step 5:** Run — FAIL. Update `CategoryQuickRoute` to accept `venues: VenueListItem[]`,
      `districtName: string`, `coordsAvailable: boolean` props (in addition to its existing
      `onSelectCategory`). On category selection, filter `venues` by the selected category and, if
      non-empty, render a directions link using `directionsUrl(venues.find(v => v.category === selected)!.name, districtName)`, with label text `coordsAvailable ? \`En yakın ${label} mekana git\` : \`${label} mekana git\`` (matching the design doc's exact wording).
- [ ] **Step 6:** Run — PASS.

- [ ] **Step 7: Wire `venues`/`districtName`/`coordsAvailable` through from `DiscoveryClient`**
`districtName` comes from `[district]/page.tsx` (it already resolves the district — pass its
`name` down as a prop through `DiscoveryClient` to `CategoryQuickRoute`, same as `centerLat`/
`centerLng` in Task 4). `venues` and `coordsAvailable` (`Boolean(coords)`) are already in
`DiscoveryClient`'s own state — pass them straight through.

- [ ] **Step 8:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 9: Commit**
```bash
git add apps/web/src/lib/directions.ts apps/web/src/lib/directions.spec.ts apps/web/src/components/venue-detail.tsx apps/web/src/components/category-quick-route.tsx apps/web/src/components/category-quick-route.spec.tsx apps/web/src/components/discovery-client.tsx apps/web/src/app/\[district\]/page.tsx
git commit -m "feat(web): category quick-route gets a real directions deep link, shared directionsUrl helper"
```

---

## Task 9: Accessibility (C13, C14)

**Files:**
- Modify: `apps/web/src/components/discovery-client.tsx` (loading state — likely already has `role="status"` from Task 3, verify/adjust)
- Modify: `apps/web/src/components/venue-map-leaflet.tsx`
- Test: corresponding `.spec.tsx` (append)

**Interfaces:** Consumes nothing new. Produces `aria-live="polite"` on loading indicators;
`aria-label` on every map marker.

- [ ] **Step 1:** Confirm Task 3's loading `<p role="status">` already satisfies C13 (it should —
      re-check its exact markup); if it's missing `aria-live="polite"`, add it now:
      `<p role="status" aria-live="polite">Yükleniyor…</p>`. Write/adjust the test:
```typescript
it("loading indicator has aria-live=polite", () => {
  // ...trigger loading state...
  expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
});
```
Run — FAIL if missing, fix, PASS.

- [ ] **Step 2: Write the failing test for map marker `aria-label`**
```typescript
// venue-map-leaflet.spec.tsx (append)
describe("VenueMapLeaflet — marker accessibility", () => {
  it("gives each marker an aria-label with the venue's name", () => {
    render(<VenueMapLeaflet venues={[{ id: "v1", name: "Cafe Test", lat: 40.99, lng: 29.02 }]} />);
    expect(screen.getByLabelText("Cafe Test")).toBeInTheDocument();
  });
});
```
- [ ] **Step 3:** Run — FAIL, add `aria-label={venue.name}` to each `CircleMarker` (read the real
      current markup — this is a one-attribute addition per marker, not a rewrite). Run — PASS.
- [ ] **Step 4:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 5: Commit**
```bash
git add apps/web/src/components/discovery-client.tsx apps/web/src/components/discovery-client.spec.tsx apps/web/src/components/venue-map-leaflet.tsx apps/web/src/components/venue-map-leaflet.spec.tsx
git commit -m "fix(web): aria-live on loading states, aria-label on map markers"
```

---

## Task 10: Code-quality cleanup

**Files:**
- Create: `apps/web/src/lib/location-context.tsx`
- Modify: `apps/web/src/components/discovery-client.tsx`
- Modify: `apps/web/src/components/district-picker.tsx`
- Modify: `apps/web/src/app/[district]/page.tsx` (wrap in the new provider)
- Create: `apps/web/src/lib/category-labels.ts`
- Modify: `apps/web/src/components/venue-card.tsx`, `venue-detail.tsx`, `category-quick-route.tsx` (import from the new shared file instead of local/duplicate definitions)
- Modify: `apps/web/src/components/category-quick-route.tsx` (toggle-off fix)
- Test: corresponding `.spec.tsx` files

**Interfaces:**
- Consumes: nothing new
- Produces: `LocationProvider`/`useLocationContext()` (single shared `useGeolocation()` call, was
  called twice independently before); `apps/web/src/lib/category-labels.ts` exporting
  `CATEGORY_LABELS` (using the REAL backend taxonomy, dropping the stale extra keys
  `venue-detail.tsx`'s local copy had — `kahvalti`/`kahve`/`tatli` — confirmed not real category
  values); `CategoryQuickRoute` toggling the same category off on a second click.

- [ ] **Step 1: Write the failing test for `LocationProvider`**
```typescript
// apps/web/src/lib/location-context.spec.tsx (new)
describe("LocationProvider — single shared useGeolocation call", () => {
  it("provides the same coords value to two consumers without calling the browser API twice", () => {
    const getCurrentPositionSpy = vi.spyOn(navigator.geolocation, "getCurrentPosition");
    render(
      <LocationProvider>
        <ConsumerA />
        <ConsumerB />
      </LocationProvider>,
    );
    expect(getCurrentPositionSpy).toHaveBeenCalledTimes(1);
  });
});
```
- [ ] **Step 2:** Run — FAIL (file doesn't exist). Create `apps/web/src/lib/location-context.tsx`
      wrapping the existing `useGeolocation()` hook in a React context provider + a
      `useLocationContext()` consumer hook, following the exact same provider pattern
      `auth-context.tsx` already establishes in this codebase.
- [ ] **Step 3:** Run — PASS. Update `[district]/page.tsx` to wrap `DistrictPicker` + `DiscoveryClient`
      in `<LocationProvider>`, and update both components to call `useLocationContext()` instead of
      their own independent `useGeolocation()` call.

- [ ] **Step 4: Write the failing test for consolidated category labels**
```typescript
// apps/web/src/lib/category-labels.spec.ts (new)
import { describe, it, expect } from "vitest";
import { CATEGORY_LABELS } from "./category-labels";

describe("CATEGORY_LABELS", () => {
  it("only contains real backend taxonomy values (no stale kahvalti/kahve/tatli entries)", () => {
    expect(Object.keys(CATEGORY_LABELS)).not.toContain("kahvalti");
    expect(Object.keys(CATEGORY_LABELS)).not.toContain("kahve");
    expect(Object.keys(CATEGORY_LABELS)).not.toContain("tatli");
    expect(CATEGORY_LABELS.cafe).toBeDefined();
    expect(CATEGORY_LABELS.restaurant).toBeDefined();
    expect(CATEGORY_LABELS.bakery).toBeDefined();
  });
});
```
- [ ] **Step 5:** Run — FAIL. Create `apps/web/src/lib/category-labels.ts`, moving the correct
      (non-stale) label set currently in `venue-card.tsx` into this new file, exported as
      `CATEGORY_LABELS`. Update `venue-card.tsx`, `venue-detail.tsx` (deleting its separate stale
      local copy), and `category-quick-route.tsx` to import from this one shared file. Run — PASS.
      Run every affected component's existing tests to confirm no rendering regression from the
      import-path change.

- [ ] **Step 6: Write the failing test for the quick-route toggle-off fix**
```typescript
// category-quick-route.spec.tsx (append)
describe("CategoryQuickRoute — re-clicking the active category deselects it", () => {
  it("calls onSelectCategory(undefined) when the already-active category button is clicked again", () => {
    const onSelectCategory = vi.fn();
    render(<CategoryQuickRoute venues={[]} districtName="Kadıköy" coordsAvailable onSelectCategory={onSelectCategory} activeCategory="cafe" />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    expect(onSelectCategory).toHaveBeenCalledWith(undefined);
  });
});
```
- [ ] **Step 7:** Run — FAIL (confirmed: current behavior re-selects the same category, doesn't
      deselect). Update the click handler: `onSelectCategory(activeCategory === category ? undefined : category)`. Run — PASS.

- [ ] **Step 8:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 9: Commit**
```bash
git add apps/web/src/lib/location-context.tsx apps/web/src/lib/location-context.spec.tsx apps/web/src/lib/category-labels.ts apps/web/src/lib/category-labels.spec.ts apps/web/src/components/discovery-client.tsx apps/web/src/components/district-picker.tsx apps/web/src/app/\[district\]/page.tsx apps/web/src/components/venue-card.tsx apps/web/src/components/venue-detail.tsx apps/web/src/components/category-quick-route.tsx apps/web/src/components/category-quick-route.spec.tsx
git commit -m "refactor(web): single shared LocationProvider (was calling useGeolocation twice), consolidated category-labels.ts, fix quick-route re-click-to-deselect"
```

---

## Task 11: Final regression and manual smoke verification

**Files:** none.

- [ ] **Step 1:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`
- [ ] **Step 2:** Run: `cd apps/admin && npx vitest run && npx tsc --noEmit`
- [ ] **Step 3:** Run: `pnpm exec turbo run typecheck lint --filter=@gurmego/web... --filter=@gurmego/admin...`
- [ ] **Step 4: Manual verification (NOT an automated gate)** — start both the API (Plan 4b, this
      worktree) and the web app (`cd apps/web && pnpm run dev`), then in a real browser:
      1. Visit each of the three district pages, confirm the map opens centered correctly for each.
      2. Grant location permission, confirm the venue list auto-sorts to distance exactly once
         (not repeatedly) and the category quick-route buttons show "En yakın ... git" links.
      3. Deny location permission, confirm manual district browsing still works fully, quick-route
         buttons show neutral (non-"en yakın") copy.
      4. Open a venue detail page, confirm address/map/photos (or empty state) render.
      5. In the admin panel, open the curation queue, confirm the approve button's new copy.
- [ ] **Step 5:** Update `docs/STATE.md` and `docs/SESSION-LOG-2026-07-26.md`: Plan 4c complete,
      ready for the final whole-branch review (Superpowers reviewer + mandatory `cross-model-review`).

---

## Self-Review Notes

- **Spec coverage:** every lettered finding from the design doc (A2 frontend/C1/C2/C3/C4/C5/C6/C7/
  C8/C9/C10/C11/C12/C13/C14, plus Bölüm 6's admin sync and Bölüm 10's code-quality items) maps to
  a task above.
- **Placeholder scan:** no TBD/TODO; every step has real code grounded in the actual current file
  contents (gathered via direct exploration of the codebase before writing this plan) or an
  explicit "read the current file first, this is a small addition not a rewrite" instruction where
  the exact current line numbers may have shifted since exploration.
- **Type/interface consistency:** `getVenues(query, coords, token?)` (Task 1) is used identically
  by every caller (Task 2); `centerLat`/`centerLng` (Task 4) flow through `[district]/page.tsx` →
  `DiscoveryClient` → `VenueMapLeaflet` with consistent naming; `directionsUrl(venueName, districtName)`
  (Task 8) has the same signature at its one call site (`venue-detail.tsx`) and its new consumer
  (`category-quick-route.tsx`).
- **Sequencing:** Task 1 (api-client signature change) before Task 2 (its callers) — same pattern
  Plan 4b established for backend signature changes. Task 4 depends on Task 2's `coords` already
  being threaded through `DiscoveryClient`. Task 8 depends on Task 4's `districtName`-passing
  plumbing pattern already being established. Tasks 3, 5, 6, 7, 9 are independent of each other and
  could in principle run in parallel, but this plan executes them sequentially per
  `subagent-driven-development`'s "never dispatch implementers in parallel" rule.
