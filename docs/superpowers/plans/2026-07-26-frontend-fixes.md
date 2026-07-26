# GurmeGo — Plan 4c: Frontend/Admin Kritik Düzeltmeler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every frontend/admin finding from `docs/AUDIT-2026-07-26.md`, per
`docs/superpowers/specs/2026-07-26-frontend-fixes-design.md` (HAZIR after 5 idea-red-team rounds).

## Round 1-2 plan-red-team (Codex, YENİDEN BÖL twice) — uygulandı

Round 1: Task 1/Task 2 both claimed ownership of the same caller files — merged into one atomic
task. Round 2: the identical bug reappeared at the Task 4/Task 9 boundary (`DiscoveryClient` passed
`CategoryQuickRoute` props only a later task defined) — merged the discovery state machine, map
centering, and category quick-route completion into one task. Both fixes are preserved below.

## Round 3 plan-red-team (Codex, YENİDEN BÖL a third time) — uygulandı, bu kez GERÇEK KOD OKUNARAK

Round 3 was the first pass where the reviewer actually read the real files in this worktree instead
of auditing the plan against the design doc alone — and found the plan itself was written against
**imagined interfaces that don't match the real code.** This is a more serious class of error than
task-splitting: no amount of task reordering fixes a plan describing a component that doesn't exist
in the form assumed. A full ground-truth pass (Explore agent, 13 real files read in full) was run
before this rewrite. What changed, with the real facts:

1. **The map is not one component taking a marker array.** `apps/web/src/components/venue-map.tsx`
   exports `VenueMap({ venues: VenueListItem[] })`, which `next/dynamic`-imports (`ssr: false`)
   `VenueMapCanvas` from `venue-map-leaflet.tsx`. `VenueMapCanvas` does **not** accept lat/lng —
   it fetches its own coordinates via `getVenuesInBbox(bbox)` internally, driven by a
   `BoundsVenueLoader` child listening to Leaflet `moveend` events, and merges those into the
   `venues` prop by `id`. The map's center is a **hardcoded constant**, `KADIKOY_CENTER = [40.9909, 29.0287]`
   — there is no `center` prop at all today. "Reuse the multi-marker path for a single venue"
   (round 1's fix for the design doc's underspecified `singlePoint`) is not actually reusable as
   described: the canvas always self-fetches nearby venues via bbox: it cannot show "exactly this
   one venue, nowhere else" without a new, explicit bypass.
2. **`createFavoriteList(token, name)` already exists** in `apps/web/src/lib/api.ts`, with `token`
   as the FIRST argument — not `createList(name, token)` as previously drafted.
3. **`favoriler/page.tsx` already renders every list as its own `<article>` card** in a grid,
   showing that list's own favorited venues inline. There is no tab/switcher UI today, and none is
   needed: the only real gap is that there's no way to CREATE a new list — once one exists, it
   already renders correctly alongside the others. The previously-planned "multi-list switching"
   feature does not need building; it already exists as "show every list."
4. **`VenueFilters`'s controlled prop is `value`, not `filters`**, and it already accepts a
   `coordsAvailable: boolean` prop (used for its radius-select gating) — a different, existing
   concern from the new `sortedByDistance` this plan introduces for `CategoryQuickRoute`.
5. **`AuthForm`'s `mode` prop is `"signin" | "signup"`**, not `"sign-in"`; its real field labels are
   "E-posta"/"Şifre"; its error is rendered via `role="alert"`.
6. **`VenueListItem.googleRating`/`googleRatingCount` are `.nullable()`, not `.optional()`** — the
   key is always present after Zod parsing, the value is `number | null`, **never `undefined`**.
   The previously-planned "handle `undefined`" test/case was testing a type-invalid, unreachable
   state; `venue-card.tsx` already correctly checks `!== null`.
7. **`getVenues`/`serializeFilters` never emitted `lat`/`lng` as query params in the first place** —
   there was nothing to "stop sending." The real gap C8 describes is that distance-based sorting
   was never wired to the backend at all (no query param, no header) — Task 1's job is to ADD a
   `coords` parameter and its header, not migrate one representation to another.
8. **`[district]/page.tsx` does not pass a `districtName` prop to `DiscoveryClient` today** — it
   passes only `districtId` and `initialVenues`. It does already resolve `current` (the matched
   district object, with `.name`) via `getDistricts()` + `.find()` + `notFound()`.
9. **`DiscoveryClient` has a `viewMode: "list" | "map"` state (default `"list"`)** and only renders
   `<VenueMap>` when `viewMode === "map"` — any test proving map-remount behavior must first switch
   to map view (`fireEvent.click(screen.getByTestId("view-mode-toggle"))`), or it exercises a
   component that was never mounted.
10. **`CategoryQuickRoute`'s real current props are `{ activeCategory?: string; onSelectCategory: (category: string) => void }`** —
    no `venues`/`districtName`/`coordsAvailable`(or `sortedByDistance`) exist yet; these are new
    additions in this plan, not a migration of an existing wider contract.
11. **`venue-detail.tsx` already has a local, non-exported `directionsUrl(venue)`** using
    `venue.name`/`venue.district.name` (no lat/lng — `findBySlug` doesn't expose it to this
    component's data source in a way this function used before Plan 4b; confirm current
    `VenueDetailType` shape when implementing, since Plan 4b did add `lat`/`lng` to the schema).
    This plan extracts and exports it as a shared 2-argument function, matching its real existing
    argument shape (venue name, district name) rather than inventing a new signature.

**Structural corrections made in this revision**, each traced to one of the facts above:

- **Task 1** no longer includes a "stop emitting lat/lng" step (fact 7) — it only ADDS the `coords`
  parameter and header to `getVenues`, and changes `getNearestDistrict`'s two-number-argument
  signature to a single `coords` object (for consistency with `locationHeaders`), updating its one
  real caller.
- **Task 4** now specifies the REAL map-centering mechanism: adding a `center: [number, number]`
  prop to both `VenueMap` and `VenueMapCanvas`, removing the `KADIKOY_CENTER` hardcode, sourced
  from a new `DISTRICT_CENTERS` map — not "pass `centerLat`/`centerLng` to an already-flexible
  component" (fact 1). The remount test switches to map view first (fact 9). `districtName` is
  explicitly wired from `[district]/page.tsx`'s already-resolved `current.name` (fact 8).
  `CategoryQuickRoute`'s widened contract is introduced from scratch, correctly, against its real
  current two-field prop shape (fact 10).
- **Task 5** (venue detail map) adds a new `focusVenue?: { id: string; name: string; lat: number; lng: number }`
  prop to `VenueMapCanvas`/`VenueMap` — when present, `BoundsVenueLoader`'s bbox fetch is skipped
  entirely and exactly one marker renders, centered on that venue (fact 1) — a concrete,
  data-carrying prop, not the previously-rejected underspecified `singlePoint` boolean, and not a
  reuse of a "multi-marker path" that doesn't actually support external marker injection.
- **Task 5**'s C10 fix drops the unreachable "`undefined` count" test case (fact 6) — only `null`
  is a real possible value, and `venue-card.tsx` already checks it correctly; the fix is purely
  additive (append "Google yorumu" text to the existing structure).
- **Task 7** drops the "multi-list switching" feature and its test entirely (fact 3) — the real
  gap is only list CREATION; the existing per-list-card grid already renders a newly created list
  correctly once it's appended to state. Uses the real `createFavoriteList(token, name)` signature
  (fact 2).
- **Task 3**'s C12 test uses the real `mode="signin"` value and real field labels (fact 5).
- Every task below that references `VenueFilters` uses its real `value` prop name (fact 4).

**Architecture:** No new backend calls beyond what Plan 4b already exposes, except the venue-detail
map's single-marker rendering (no new endpoint — it reuses `VenueMapCanvas`'s existing Leaflet
scaffolding with the bbox fetch bypassed). The only new cross-cutting runtime mechanism is header
propagation through the existing `packages/api-client` → `apps/web/src/lib/api.ts` chain, plus a
`LocationProvider` React context replacing two independent `useGeolocation()` calls.

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
- **A signature/prop-contract change is only complete in the same task as every one of its direct
  consumers.** Established after two red-team rounds caught this violated at two different task
  boundaries (Task 1/2, then Task 4/9).
- **Every task's "Files"/"Interfaces" section states the REAL current signature it is changing
  FROM, confirmed by reading the file, not an assumed prior shape** — established after round 3
  caught the plan drafting against imagined interfaces.

---

## Task 1: API client header propagation (atomic — signature change + every direct caller)

Owns `packages/api-client`'s `get()` signature and `apps/web/src/lib/api.ts`'s `fetchValidated`/
`getVenues`/`getNearestDistrict`, AND every one of their direct callers, in this same task/commit.

**Files:**
- Modify: `packages/api-client/src/index.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/components/venue-filters.tsx` (`serializeFilters` — ADDS `openNow`
  handling; it never emitted `lat`/`lng` and continues not to)
- Modify: `apps/web/src/components/discovery-client.tsx` (only the `getVenues` call site)
- Modify: `apps/web/src/components/district-picker.tsx` (only the `getNearestDistrict` call site —
  read the file first to find where `useSuggestedDistrict` or similar calls it with the current
  two-number-argument form)
- Test: `packages/api-client/src/index.spec.ts` (new), `apps/web/src/lib/api.spec.ts` (append),
  `apps/web/src/components/venue-filters.spec.tsx` (append), `apps/web/src/components/discovery-client.spec.tsx` (append — one call-site test only), `apps/web/src/components/district-picker.spec.tsx` (append)

**Interfaces:**
- Consumes: nothing new (Plan 4b already defines the header contract)
- Produces: `createApiClient(...).get<T>(path, options?: { headers?: Record<string,string> })`;
  `fetchValidated(path, schema, token?, headers?)`; `locationHeaders(coords?: Coords | null): Record<string,string>`;
  `getVenues(query: Record<string,string>, coords?: Coords | null)` (was `getVenues(query)` only —
  ADDING a second parameter, not migrating an existing one); `getNearestDistrict(coords: Coords)`
  (was `getNearestDistrict(lat: number, lng: number)` — changing from two numbers to one object,
  for symmetry with `locationHeaders`). `FilterState` gains `openNow?: boolean` (type-only addition
  here; Task 7 adds the UI toggle).

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
- [ ] **Step 2:** Run: `cd apps/web && npx vitest run ../../packages/api-client/src/index.spec.ts` — FAIL.
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
(Leave `post()` untouched.)
- [ ] **Step 4:** Run — PASS.

- [ ] **Step 5: Write the failing test for `fetchValidated`'s new `headers` param, `locationHeaders`, and `getVenues`/`getNearestDistrict`'s new signatures**
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

describe("getVenues — new optional coords parameter sends a location header", () => {
  it("sends the exact X-User-Location header derived from coords, with no lat/lng in the query string (unchanged from before)", async () => {
    const getSpy = vi.spyOn(client, "get").mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });
    await getVenues({ districtId: "d1" }, { lat: 40.99, lng: 29.02 });
    const [pathArg, optionsArg] = getSpy.mock.calls[0];
    expect(pathArg).not.toContain("lat=");
    expect(optionsArg).toEqual({ headers: { "X-User-Location": "40.99,29.02" } });
  });

  it("sends no location header when coords is omitted (existing call sites without a second argument keep working)", async () => {
    const getSpy = vi.spyOn(client, "get").mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });
    await getVenues({ districtId: "d1" });
    expect(getSpy.mock.calls[0][1]).toEqual({ headers: {} });
  });
});

describe("getNearestDistrict — now takes one coords object instead of two number arguments", () => {
  it("sends the exact X-User-Location header, no lat/lng query params", async () => {
    const getSpy = vi.spyOn(client, "get").mockResolvedValue({ id: "d1", name: "Kadıköy", slug: "kadikoy" });
    await getNearestDistrict({ lat: 40.99, lng: 29.02 });
    const [pathArg, optionsArg] = getSpy.mock.calls[0];
    expect(pathArg).toBe("/districts/nearest");
    expect(optionsArg).toEqual({ headers: { "X-User-Location": "40.99,29.02" } });
  });
});
```
(Read the real `fetchValidated` internals first to pick the right spy target — `client.get` or
`global.fetch`.)
- [ ] **Step 6:** Run — FAIL.
- [ ] **Step 7: Implement in `apps/web/src/lib/api.ts`**
```typescript
export function locationHeaders(coords?: Coords | null): Record<string, string> {
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

export function getVenues(query: Record<string, string>, coords?: Coords | null) {
  const qs = new URLSearchParams(query).toString();
  return fetchValidated(`/venues?${qs}`, VenueListResponseSchema, undefined, locationHeaders(coords));
}

export async function getNearestDistrict(coords: Coords): Promise<District> {
  return fetchValidated("/districts/nearest", DistrictSchema, undefined, locationHeaders(coords));
}
```
(Read the real current bodies first — preserve the existing `qs`/`URLSearchParams` construction
exactly; only add the `coords` parameter and the 4th `headers` argument to `fetchValidated`. Import
`Coords` from `./use-geolocation`.)
- [ ] **Step 8:** Run — PASS.

- [ ] **Step 9: `serializeFilters` — add `openNow` handling (no lat/lng removal — it never emitted them)**
```typescript
// apps/web/src/components/venue-filters.tsx
export function serializeFilters(filters: FilterState, coords?: Coords | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.category) out.category = filters.category;
  if (filters.priceRange) out.priceRange = filters.priceRange;
  if (filters.isBoutique !== undefined) out.isBoutique = String(filters.isBoutique);
  if (filters.openNow) out.openNow = "true";
  if (filters.radiusM !== undefined && coords) out.radiusM = String(filters.radiusM);
  return out;
}
```
(Read the real current function first — this only ADDS the `openNow` line; every other line stays
exactly as it already is today.) `FilterState` gains `openNow?: boolean;` in its interface.
Write the failing test first:
```typescript
// venue-filters.spec.tsx (append)
describe("serializeFilters — openNow", () => {
  it("emits openNow=true only when true, omits it when false or undefined", () => {
    expect(serializeFilters({ openNow: true })).toEqual({ openNow: "true" });
    expect(serializeFilters({ openNow: false })).toEqual({});
    expect(serializeFilters({})).toEqual({});
  });
});
```
Run — FAIL, apply the change, run — PASS.

- [ ] **Step 10: Update `discovery-client.tsx`'s ONE `getVenues` call site**, adding `coords` as the
      second argument (the file's own `coords = useGeolocation()` state already exists):
```typescript
const { data } = await getVenues({ districtId, ...serializeFilters(next, coords) }, coords);
```
Write the failing test asserting the exact coords value reaches the mock:
```typescript
// discovery-client.spec.tsx (append)
describe("DiscoveryClient — getVenues call includes coords", () => {
  it("passes the exact resolved coords as getVenues' second argument", async () => {
    vi.mocked(useGeolocationMock).mockReturnValue({ lat: 40.99, lng: 29.02 }); // match this file's real mock setup once read
    render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    fireEvent.change(screen.getByTestId("filter-price"), { target: { value: "BUDGET" } }); // or whatever real control triggers applyFilters -- read the file first
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledWith(expect.any(Object), { lat: 40.99, lng: 29.02 }));
  });
});
```
Confirm it fails first (current call passes one argument), then fix, then confirm it passes.

- [ ] **Step 11: Update `district-picker.tsx`'s ONE `getNearestDistrict` call site.** Read the file
      first to find the exact current call (likely two positional number arguments); change to the
      single `coords` object.  Write the failing test asserting the exact coords object, confirm
      fail, fix, confirm pass.

- [ ] **Step 12:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`. Confirm every caller
      of `getVenues`/`getNearestDistrict` in `apps/web` compiles —
      `grep -rn "getVenues\|getNearestDistrict" apps/web/src --include=*.tsx --include=*.ts` and
      check `[district]/page.tsx`'s server-side `getVenues({ districtId, sort: "newest" })` call
      too (it takes no `coords`, which is correct — a Server Component can't access geolocation;
      confirm it still compiles with the parameter now optional).
- [ ] **Step 13: Commit**
```bash
git add packages/api-client/src apps/web/src/lib/api.ts apps/web/src/lib/api.spec.ts apps/web/src/components/venue-filters.tsx apps/web/src/components/venue-filters.spec.tsx apps/web/src/components/discovery-client.tsx apps/web/src/components/discovery-client.spec.tsx apps/web/src/components/district-picker.tsx apps/web/src/components/district-picker.spec.tsx
git commit -m "feat(web): add coords parameter + X-User-Location header to getVenues/getNearestDistrict and all callers, openNow serialization"
```

---

## Task 2: `LocationProvider` — single shared coordinate source

**Files:**
- Create: `apps/web/src/lib/location-context.tsx`
- Modify: `apps/web/src/app/[district]/page.tsx` (wrap `DistrictPicker` + `DiscoveryClient` in the provider)
- Modify: `apps/web/src/components/district-picker.tsx` (consume `useLocationContext()` instead of its own `useGeolocation()`)
- Test: `apps/web/src/lib/location-context.spec.tsx` (new), `apps/web/src/components/district-picker.spec.tsx` (append)

**Interfaces:**
- Consumes: `apps/web/src/lib/use-geolocation.ts`'s real, confirmed `useGeolocation(): Coords | null`
  (returns `null` while unresolved, never `undefined` — confirmed by reading the file)
- Produces: `LocationProvider`, `useLocationContext(): Coords | null`. Consumed by Task 4
  (`DiscoveryClient`) and this task's own update to `district-picker.tsx`.

- [ ] **Step 1: Write the failing test proving ONE total `useGeolocation` call across two consumers**
```typescript
// apps/web/src/lib/location-context.spec.tsx (new)
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocationProvider, useLocationContext } from "./location-context";

function Consumer({ testId }: { testId: string }) {
  const coords = useLocationContext();
  return <div data-testid={testId}>{coords ? `${coords.lat},${coords.lng}` : "none"}</div>;
}

describe("LocationProvider — single shared useGeolocation call", () => {
  it("calls the browser geolocation API exactly once total; both consumers read the same resolved value", () => {
    // navigator.geolocation is not guaranteed to exist in jsdom by default -- define it first.
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition: vi.fn() },
      configurable: true,
    });
    const getCurrentPositionSpy = vi.spyOn(navigator.geolocation, "getCurrentPosition").mockImplementation((success) => {
      success({ coords: { latitude: 40.99, longitude: 29.02 } } as GeolocationPosition);
    });
    render(
      <LocationProvider>
        <Consumer testId="a" />
        <Consumer testId="b" />
      </LocationProvider>,
    );
    // exactly one call for the whole subtree -- LocationProvider itself calls useGeolocation()
    // once; this does NOT mean useGeolocation is never called anywhere, only that it's called
    // once total, not once per consumer.
    expect(getCurrentPositionSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("a")).toHaveTextContent("40.99,29.02");
    expect(screen.getByTestId("b")).toHaveTextContent("40.99,29.02");
  });
});
```
- [ ] **Step 2:** Run — FAIL. Create `apps/web/src/lib/location-context.tsx`, following the exact
      provider pattern `apps/web/src/lib/auth-context.tsx` already establishes. Use `null` (the
      hook's own real unresolved value, confirmed above) as the context's default, so there is no
      separate "no provider" sentinel to confuse with a real unresolved state:
```typescript
"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useGeolocation, type Coords } from "./use-geolocation";

const LocationContext = createContext<Coords | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const coords = useGeolocation();
  return <LocationContext.Provider value={coords}>{children}</LocationContext.Provider>;
}

export function useLocationContext(): Coords | null {
  return useContext(LocationContext);
}
```
- [ ] **Step 3:** Run — PASS.

- [ ] **Step 4: Wire the provider into the district page and migrate `district-picker.tsx`**
Read `apps/web/src/app/[district]/page.tsx`'s real current content (confirmed: a Server Component
rendering `<DistrictPicker districts={districts} current={params.district} />` then
`<DiscoveryClient districtId={current.id} initialVenues={venues} />`). Wrap both in
`<LocationProvider>...</LocationProvider>`. Read `district-picker.tsx` to find where it currently
calls `useGeolocation()` directly, replace with `useLocationContext()`. Write the failing test:
```typescript
// district-picker.spec.tsx (append)
import * as geolocationModule from "@/lib/use-geolocation";

it("does not call useGeolocation directly -- reads coords from LocationProvider's context instead", () => {
  const spy = vi.spyOn(geolocationModule, "useGeolocation");
  render(
    <LocationProvider>
      <DistrictPicker districts={[]} current="kadikoy" />
    </LocationProvider>,
  );
  // useGeolocation is called once by LocationProvider itself; this test only proves
  // DistrictPicker doesn't ALSO call it independently.
  expect(spy).toHaveBeenCalledTimes(1);
});
```
Confirm it fails against the pre-migration code (2 calls — `LocationProvider`'s plus
`DistrictPicker`'s own), migrate, confirm it passes (1 call).

- [ ] **Step 5:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 6: Commit**
```bash
git add apps/web/src/lib/location-context.tsx apps/web/src/lib/location-context.spec.tsx apps/web/src/app/\[district\]/page.tsx apps/web/src/components/district-picker.tsx apps/web/src/components/district-picker.spec.tsx
git commit -m "feat(web): LocationProvider -- single shared geolocation source, migrate district-picker off its own useGeolocation call"
```

---

## Task 3: Error handling fixes (C1, C11, C12)

**Files:**
- Modify: `apps/web/src/lib/auth-context.tsx` (C1)
- Modify: `apps/web/src/components/favorite-button.tsx` (C11)
- Modify: `apps/web/src/components/auth-form.tsx` (C12)
- Test: each file's existing `.spec.tsx` (append)

**Interfaces:**
- Consumes: `auth-context.tsx`'s real, confirmed `useAuth()` return shape includes `loading: boolean`
  (starts `true`, flips to `false` on `getSession()`/`onAuthStateChange` resolution)
- Produces: `auth-context.tsx` no longer throws unhandled on `getSession()` rejection (`loading`
  correctly settles to `false`); `FavoriteButton` checks real favorite state on mount and disables
  itself mid-toggle-request; `AuthForm` disables its submit button while a request is in flight.

- [ ] **Step 1 (C1): Write the failing test using the real `loading` field**
```typescript
// auth-context.spec.tsx (append)
describe("AuthProvider — getSession() failure", () => {
  it("does not throw and settles loading to false when getSession() rejects", async () => {
    vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error("network down"));
    function Probe() {
      const { loading } = useAuth();
      return <div data-testid="loading-state">{String(loading)}</div>;
    }
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("loading-state")).toHaveTextContent("false"));
  });
});
```
Run — FAIL (read the real current `useEffect` body first; confirm `.catch()` is genuinely absent —
this test also fails today via an unhandled promise rejection under Vitest). Add
`.catch(() => setLoading(false))` (matching the real state-setter's name) to the `getSession()`
promise chain. Run — PASS.

- [ ] **Step 2 (C11): Write the failing test**
```typescript
// favorite-button.spec.tsx (append)
describe("FavoriteButton — real state check and disabled-while-pending", () => {
  it("reflects the venue's real favorite status from GET /me/lists on mount", async () => {
    getFavoriteListsMock.mockResolvedValue([{ id: "l1", name: "Default", favorites: [{ id: "f1", venueId: "v1", venue: { id: "v1", name: "X", slug: "x", category: "cafe", priceRange: "BUDGET", isBoutique: false } }] }]);
    render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByTestId("favorite-button")).toHaveAttribute("aria-pressed", "true"));
  });

  it("disables itself while a toggle request is in flight, after the initial mount-time check resolves", async () => {
    getFavoriteListsMock.mockResolvedValue([{ id: "l1", name: "Default", favorites: [] }]);
    let resolveToggle: () => void;
    toggleFavoriteMock.mockReturnValue(new Promise<void>((resolve) => { resolveToggle = resolve; }));
    render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("favorite-button"));
    expect(screen.getByTestId("favorite-button")).toBeDisabled();
    resolveToggle!();
    await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled());
  });
});
```
(Match mock names/shapes to what `favorite-button.spec.tsx` already establishes — read it and
`packages/shared/src/schemas/favorite-list.schema.ts` first; the real `favorites[].venue` shape
has no `venueIds` array, matching what's shown above.) Run — FAIL. Read the real current
component, add a mount-time fetch of the user's lists (only if `useAuth().user` is truthy) to
determine initial pressed state by checking whether any list's `favorites` contains this
`venueId` — disabled until this initial fetch resolves too — and a `pending` state set `true` on
click / `false` in a `finally`, with `disabled={pending || initialCheckPending}`. Run — PASS.

- [ ] **Step 3 (C12): Write the failing test with the REAL `mode` value and REAL field labels**
```typescript
// auth-form.spec.tsx (append)
describe("AuthForm — disabled while submitting", () => {
  it("disables the submit button until the request resolves", async () => {
    let resolveSignIn: () => void;
    signInMock.mockReturnValue(new Promise<void>((resolve) => { resolveSignIn = resolve; }));
    render(<AuthForm mode="signin" />);
    fireEvent.change(screen.getByLabelText("E-posta"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText("Şifre"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Giriş yap" }));
    expect(screen.getByRole("button", { name: "Giriş yap" })).toBeDisabled();
    resolveSignIn!();
    await waitFor(() => expect(screen.getByRole("button", { name: "Giriş yap" })).not.toBeDisabled());
  });
});
```
Run — FAIL. Add a `submitting` state, `true` on submit start, `false` in a `finally`,
`disabled={submitting}` on the submit button. Run — PASS.

- [ ] **Step 4:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 5: Commit**
```bash
git add apps/web/src/lib/auth-context.tsx apps/web/src/lib/auth-context.spec.tsx apps/web/src/components/favorite-button.tsx apps/web/src/components/favorite-button.spec.tsx apps/web/src/components/auth-form.tsx apps/web/src/components/auth-form.spec.tsx
git commit -m "fix(web): handle getSession() failure, real favorite-button state + disabled-while-pending, disable auth-form while submitting"
```

---

## Task 4: Discovery experience — state machine, real map centering, category quick-route (C2, C3, C6, C8, C13, C14) — atomic

Merges the discovery state machine, map centering, and category-quick-route completion into one
task — these define and consume the same prop surface in the same commit (Round 2's lesson).
Grounded in the REAL current files (Round 3's lesson): `VenueMap`/`VenueMapCanvas` have no
`center` prop today (hardcoded `KADIKOY_CENTER`); `DiscoveryClient`'s real props are
`{ districtId, initialVenues }`; `CategoryQuickRoute`'s real props are
`{ activeCategory?: string; onSelectCategory: (category: string) => void }`.

**Files:**
- Create: `apps/web/src/lib/district-centers.ts`
- Create: `apps/web/src/lib/directions.ts`
- Modify: `apps/web/src/components/discovery-client.tsx`
- Modify: `apps/web/src/components/venue-map.tsx`
- Modify: `apps/web/src/components/venue-map-leaflet.tsx` (the `VenueMapCanvas` export)
- Modify: `apps/web/src/components/category-quick-route.tsx`
- Modify: `apps/web/src/app/[district]/page.tsx` (pass `districtName={current.name}` and
  `center={DISTRICT_CENTERS[current.slug] ?? DEFAULT_CENTER}` down to `DiscoveryClient` — both new
  props; `current` and `current.name`/`current.slug` already exist today, confirmed)
- Test: `apps/web/src/lib/district-centers.spec.ts` (new), `apps/web/src/lib/directions.spec.ts`
  (new), `apps/web/src/components/discovery-client.spec.tsx` (append), `apps/web/src/components/venue-map-leaflet.spec.tsx` (append), `apps/web/src/components/category-quick-route.spec.tsx` (append)

**Interfaces:**
- Consumes: Task 1's `getVenues(query, coords)` (already wired at this file's one call site);
  Task 2's `useLocationContext()`; the real `current.name`/`current.slug` already resolved in
  `[district]/page.tsx`.
- Produces (all defined AND consumed in this one task): `DISTRICT_CENTERS`/`DEFAULT_CENTER`;
  `directionsUrl(venueName, districtName)`; `VenueMap`/`VenueMapCanvas` gain a
  `center: [number, number]` prop (replacing the `KADIKOY_CENTER` hardcode — this is an ADDITIVE
  change to a real, working component, not a from-scratch build); `DiscoveryClient` gains
  `districtName: string` and `center: [number, number]` props; `DiscoveryClient` tracks
  `sortedByDistance: boolean` (true only immediately after a successful coords-driven fetch, reset
  to `false` on failure or a user-driven filter change before coords resolved); `CategoryQuickRoute`
  gains `venues: VenueListItem[]`, `districtName: string`, `sortedByDistance: boolean` props, and
  its `onSelectCategory` widens from `(category: string) => void` to
  `(category: string | undefined) => void` — all introduced here, for the first time, together.

- [ ] **Step 1: `DISTRICT_CENTERS` — write the failing test**
```typescript
// apps/web/src/lib/district-centers.spec.ts (new)
import { describe, it, expect } from "vitest";
import { DISTRICT_CENTERS, DEFAULT_CENTER } from "./district-centers";

describe("DISTRICT_CENTERS", () => {
  it("has entries for the three MVP districts as [lat, lng] tuples", () => {
    expect(DISTRICT_CENTERS.kadikoy).toEqual([40.9906, 29.0274]);
    expect(DISTRICT_CENTERS.besiktas).toEqual([41.0422, 29.0061]);
    expect(DISTRICT_CENTERS.beyoglu).toEqual([41.0370, 28.9850]);
  });
  it("has a numeric default fallback tuple for an unknown slug", () => {
    expect(DEFAULT_CENTER).toHaveLength(2);
    expect(typeof DEFAULT_CENTER[0]).toBe("number");
  });
});
```
- [ ] **Step 2:** Run — FAIL, then create `apps/web/src/lib/district-centers.ts`:
```typescript
export const DISTRICT_CENTERS: Record<string, [number, number]> = {
  kadikoy: [40.9906, 29.0274],
  besiktas: [41.0422, 29.0061],
  beyoglu: [41.0370, 28.9850],
};

// Istanbul-wide fallback for an unrecognized district slug -- MVP only ships the three keys above.
export const DEFAULT_CENTER: [number, number] = [41.0082, 28.9784];
```
(Tuples, matching the real `KADIKOY_CENTER: [40.9909, 29.0287]` constant's own shape in
`venue-map-leaflet.tsx` — this task replaces that hardcoded constant with a prop of this same
shape, so keep the representation consistent rather than introducing a `{lat,lng}` object here.)
- [ ] **Step 3:** Run — PASS.

- [ ] **Step 4: `directionsUrl` — extract the REAL existing local function from `venue-detail.tsx`**
Read `venue-detail.tsx`'s current `directionsUrl(venue)` (confirmed: takes the whole venue object,
uses `venue.name`/`venue.district.name`). Write the failing test for the new shared, exported,
two-string-argument version:
```typescript
// apps/web/src/lib/directions.spec.ts (new)
import { describe, it, expect } from "vitest";
import { directionsUrl } from "./directions";

describe("directionsUrl", () => {
  it("builds a Google Maps text-search deep link from name + district (matches venue-detail.tsx's existing pattern)", () => {
    const url = directionsUrl("Cafe Test", "Kadıköy");
    expect(url).toBe("https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent("Cafe Test Kadıköy"));
  });
});
```
- [ ] **Step 5:** Run — FAIL, then create `apps/web/src/lib/directions.ts`:
```typescript
export function directionsUrl(venueName: string, districtName: string): string {
  const query = encodeURIComponent(`${venueName} ${districtName}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}
```
Update `venue-detail.tsx`'s local (currently non-exported) `directionsUrl(venue)` to call this
shared version internally: `directionsUrl(venue.name, venue.district.name)`, removing the
duplicated URL-building logic (keep the local wrapper if other code in that file calls
`directionsUrl(venue)` with the whole object — just delegate its body to the shared helper). Run
its existing tests to confirm no regression. Run the new test — PASS.

- [ ] **Step 6: `VenueMapCanvas`/`VenueMap` gain a REAL `center` prop, replacing the hardcoded constant**
Read `venue-map-leaflet.tsx`'s real current `KADIKOY_CENTER = [40.9909, 29.0287]` usage inside
`VenueMapCanvas`'s `<MapContainer center={KADIKOY_CENTER} ...>`. Write the failing test:
```typescript
// venue-map-leaflet.spec.tsx (append)
describe("VenueMapCanvas — center prop replaces the hardcoded KADIKOY_CENTER", () => {
  it("passes the given center prop through to the map container's center", () => {
    render(<VenueMapCanvas venues={[]} center={[40.9906, 29.0274]} />);
    expect(screen.getByTestId("map-container")).toHaveAttribute("data-center", "40.9906,29.0274");
  });

  it("gives each marker an aria-label with the venue's name (C14)", () => {
    // this asserts against whatever the existing bbox-driven marker rendering already does --
    // read the current test file's mocking of getVenuesInBbox first and extend it, don't replace it
    render(<VenueMapCanvas venues={[{ id: "v1", name: "Cafe Test", /* other real VenueListItem fields */ }]} center={[40.99, 29.02]} />);
    await waitFor(() => expect(screen.getByLabelText("Cafe Test")).toBeInTheDocument());
  });
});
```
(Read the real current spec file's mocking pattern for `react-leaflet` and `getVenuesInBbox`
before writing these — match the existing mock shape exactly, this is an additive test in an
existing, already-mocked test file, not a fresh setup.) Run — FAIL. Add a `center: [number, number]`
prop to `VenueMapCanvas`, replace `KADIKOY_CENTER` in `<MapContainer center={center} ...>` with the
new prop, delete the now-unused `KADIKOY_CENTER` constant. Add `aria-label={venue.name}` to each
`CircleMarker` if not already present (check first — Round 3's ground-truth pass didn't confirm
whether this already exists; only add if missing). Thread the same `center` prop through
`VenueMap` (the `next/dynamic` wrapper) down to `VenueMapCanvas`. Run — PASS.

- [ ] **Step 7: `CategoryQuickRoute`'s widened prop contract — write the failing test against its REAL current two-field shape**
`CategoryQuickRoute` is CONTROLLED (`activeCategory` is a prop from the parent, confirmed by
reading the real file). The test reflects that: the directions link appears only after the parent
re-renders with the updated `activeCategory`.
```typescript
// category-quick-route.spec.tsx (append)
describe("CategoryQuickRoute — widened prop contract: venues, districtName, sortedByDistance, deselect", () => {
  const venues = [{ id: "v1", name: "First Cafe", category: "cafe", slug: "first-cafe", priceRange: "BUDGET", isBoutique: true, editorialNote: null, googleRating: null, googleRatingCount: null }];

  it("calls onSelectCategory(category) on click, then renders a directions link once the parent re-renders with the new activeCategory, labeled 'En yakın' when sortedByDistance is true", () => {
    const onSelectCategory = vi.fn();
    const { rerender } = render(<CategoryQuickRoute venues={venues} districtName="Kadıköy" sortedByDistance onSelectCategory={onSelectCategory} activeCategory={undefined} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    expect(onSelectCategory).toHaveBeenCalledWith("cafe");
    rerender(<CategoryQuickRoute venues={venues} districtName="Kadıköy" sortedByDistance onSelectCategory={onSelectCategory} activeCategory="cafe" />);
    const link = screen.getByRole("link", { name: /en yakın cafe mekana git/i });
    expect(link).toHaveAttribute("href", expect.stringContaining(encodeURIComponent("First Cafe Kadıköy")));
  });

  it("uses neutral copy (not 'en yakın') when sortedByDistance is false", () => {
    const onSelectCategory = vi.fn();
    const { rerender } = render(<CategoryQuickRoute venues={venues} districtName="Kadıköy" sortedByDistance={false} onSelectCategory={onSelectCategory} activeCategory={undefined} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    rerender(<CategoryQuickRoute venues={venues} districtName="Kadıköy" sortedByDistance={false} onSelectCategory={onSelectCategory} activeCategory="cafe" />);
    expect(screen.getByRole("link", { name: /cafe mekana git/i })).toBeInTheDocument();
    expect(screen.queryByText(/en yakın/i)).not.toBeInTheDocument();
  });

  it("renders no directions link when no venue matches the active category", () => {
    render(<CategoryQuickRoute venues={[]} districtName="Kadıköy" sortedByDistance onSelectCategory={vi.fn()} activeCategory="cafe" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("calls onSelectCategory(undefined) when the already-active category is clicked again (deselect)", () => {
    const onSelectCategory = vi.fn();
    render(<CategoryQuickRoute venues={venues} districtName="Kadıköy" sortedByDistance onSelectCategory={onSelectCategory} activeCategory="cafe" />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    expect(onSelectCategory).toHaveBeenCalledWith(undefined);
  });
});
```
- [ ] **Step 8:** Run — FAIL. Update `CategoryQuickRoute`'s props (real current shape
      `{ activeCategory?: string; onSelectCategory: (category: string) => void }`) to
      `{ activeCategory?: string; venues: VenueListItem[]; districtName: string; sortedByDistance: boolean; onSelectCategory: (category: string | undefined) => void; "data-testid"?: string }`.
      Click handler becomes `onSelectCategory(activeCategory === category ? undefined : category)`
      (the component owns the toggle-to-deselect comparison itself, since it already receives
      `activeCategory`). When `activeCategory` matches a real category and at least one venue in
      `venues` has that category, render a directions link using
      `directionsUrl(matchingVenue.name, districtName)`, label text
      `` sortedByDistance ? `En yakın ${label} mekana git` : `${label} mekana git` ``. Add a
      `data-sorted-by-distance={String(sortedByDistance)}` attribute on the component's root
      element (used by Task 4's `DiscoveryClient` tests, Step 9 below). Run — PASS.

- [ ] **Step 9: `DiscoveryClient`'s complete state machine — write the failing tests against its REAL current `{ districtId, initialVenues }` props, then implement**

Read the real current file (confirmed: `useGeolocation()` called directly, `viewMode: "list"|"map"`
state defaulting to `"list"`, `applyFilters(next)` calling `getVenues({ districtId, ...serializeFilters(next, coords) })`,
`<CategoryQuickRoute activeCategory={filters.category} onSelectCategory={handleQuickCategory} />`,
conditionally `<VenueList venues={venues} />` or `<VenueMap venues={venues} />`). Replace
`useGeolocation()` with `useLocationContext()` (Task 2), updating this file's test mocks.

```typescript
// discovery-client.spec.tsx (append)
describe("DiscoveryClient — loading, error, and stale-response discarding (C2)", () => {
  it("shows a loading indicator while a request is in flight and an error message on failure", async () => {
    getVenuesMock.mockRejectedValueOnce(new Error("500"));
    render(<DiscoveryClient districtId="d1" districtName="Kadıköy" center={[40.99, 29.02]} initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/hata/i));
  });

  it("ignores a slow first response if a second request has already started", async () => {
    let resolveFirst: (v: unknown) => void;
    getVenuesMock
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ data: [{ id: "v2", name: "Second" }], meta: { next_cursor: null, has_more: false } });
    render(<DiscoveryClient districtId="d1" districtName="Kadıköy" center={[40.99, 29.02]} initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    fireEvent.click(screen.getByTestId("quick-category-bakery"));
    await waitFor(() => expect(screen.getByText("Second")).toBeInTheDocument());
    resolveFirst!({ data: [{ id: "v1", name: "First" }], meta: { next_cursor: null, has_more: false } });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText("First")).not.toBeInTheDocument();
  });
});

describe("DiscoveryClient — sortedByDistance reflects the actually-displayed list, not just coords presence", () => {
  it("is false before coords resolve, true immediately after the resulting auto-fetch succeeds", async () => {
    vi.mocked(useLocationContextMock).mockReturnValue(null);
    const { rerender } = render(<DiscoveryClient districtId="d1" districtName="Kadıköy" center={[40.99, 29.02]} initialVenues={[]} />);
    expect(screen.getByTestId("quick-category-cafe").closest("[data-sorted-by-distance]")).toHaveAttribute("data-sorted-by-distance", "false");
    vi.mocked(useLocationContextMock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    getVenuesMock.mockResolvedValueOnce({ data: [{ id: "v1", name: "X" }], meta: { next_cursor: null, has_more: false } });
    rerender(<DiscoveryClient districtId="d1" districtName="Kadıköy" center={[40.99, 29.02]} initialVenues={[]} />);
    await waitFor(() => expect(screen.getByTestId("quick-category-cafe").closest("[data-sorted-by-distance]")).toHaveAttribute("data-sorted-by-distance", "true"));
  });

  it("stays false if the user changes a filter before coords resolve", async () => {
    vi.mocked(useLocationContextMock).mockReturnValue(null);
    render(<DiscoveryClient districtId="d1" districtName="Kadıköy" center={[40.99, 29.02]} initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("quick-category-cafe").closest("[data-sorted-by-distance]")).toHaveAttribute("data-sorted-by-distance", "false");
  });

  it("resets to false if a coords-driven fetch fails", async () => {
    vi.mocked(useLocationContextMock).mockReturnValue(null);
    const { rerender } = render(<DiscoveryClient districtId="d1" districtName="Kadıköy" center={[40.99, 29.02]} initialVenues={[{ id: "v0", name: "Initial" }]} />);
    vi.mocked(useLocationContextMock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    getVenuesMock.mockRejectedValueOnce(new Error("500"));
    rerender(<DiscoveryClient districtId="d1" districtName="Kadıköy" center={[40.99, 29.02]} initialVenues={[{ id: "v0", name: "Initial" }]} />);
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("quick-category-cafe").closest("[data-sorted-by-distance]")).toHaveAttribute("data-sorted-by-distance", "false");
  });
});

describe("DiscoveryClient — one-time auto-sort effect fires exactly once and respects prior user interaction", () => {
  it("auto-refetches with resolved coords exactly once via rerender", async () => {
    vi.mocked(useLocationContextMock).mockReturnValue(null);
    const { rerender } = render(<DiscoveryClient districtId="d1" districtName="Kadıköy" center={[40.99, 29.02]} initialVenues={[]} />);
    vi.mocked(useLocationContextMock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    rerender(<DiscoveryClient districtId="d1" districtName="Kadıköy" center={[40.99, 29.02]} initialVenues={[]} />);
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledWith(expect.any(Object), { lat: 40.99, lng: 29.02 }));
    expect(getVenuesMock).toHaveBeenCalledTimes(1);
    rerender(<DiscoveryClient districtId="d1" districtName="Kadıköy" center={[40.99, 29.02]} initialVenues={[]} />);
    expect(getVenuesMock).toHaveBeenCalledTimes(1);
  });

  it("does not auto-refetch if the user already changed a filter before coords resolved (rerender preserves refs)", async () => {
    vi.mocked(useLocationContextMock).mockReturnValue(null);
    const { rerender } = render(<DiscoveryClient districtId="d1" districtName="Kadıköy" center={[40.99, 29.02]} initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledTimes(1));
    vi.mocked(useLocationContextMock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    rerender(<DiscoveryClient districtId="d1" districtName="Kadıköy" center={[40.99, 29.02]} initialVenues={[]} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(getVenuesMock).toHaveBeenCalledTimes(1);
  });
});

describe("DiscoveryClient — map view remounts VenueMap when districtId changes", () => {
  it("re-fires a mount-only effect on the mocked VenueMap when districtId changes, after switching to map view", () => {
    const mountLog: string[] = [];
    vi.mock("./venue-map", () => ({
      VenueMap: (props: { center: [number, number] }) => {
        useEffect(() => { mountLog.push(String(props.center)); }, []);
        return <div data-testid="venue-map" />;
      },
    }));
    const { rerender } = render(<DiscoveryClient districtId="kadikoy" districtName="Kadıköy" center={[40.9906, 29.0274]} initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("view-mode-toggle")); // DiscoveryClient defaults to viewMode="list" -- must switch to "map" before VenueMap ever mounts
    expect(mountLog).toEqual(["40.9906,29.0274"]);
    rerender(<DiscoveryClient districtId="besiktas" districtName="Beşiktaş" center={[41.0422, 29.0061]} initialVenues={[]} />);
    // if VenueMap were rendered without key={districtId}, this mount-only effect would NOT re-run
    // on a mere prop update -- a second log entry proves a real unmount+remount happened.
    expect(mountLog).toEqual(["40.9906,29.0274", "41.0422,29.0061"]);
  });
});
```
(`vi.mock` calls are hoisted by Vitest automatically regardless of where they appear in the file,
but place this one near the top of the describe block or the top of the file if hoisting causes
issues in practice — verify by running.) Run all of the above — FAIL.

- [ ] **Step 10: Implement `DiscoveryClient`'s complete state machine**
```typescript
const latestRequest = useRef(0);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [sortedByDistance, setSortedByDistance] = useState(false);
const autoSortedRef = useRef(false);
const userInteractedRef = useRef(false);
const coords = useLocationContext();

async function applyFilters(next: FilterState, requestCoords: Coords | null) {
  const requestId = ++latestRequest.current;
  setFilters(next);
  setLoading(true);
  setError(null);
  try {
    const { data } = await getVenues({ districtId, ...serializeFilters(next, requestCoords) }, requestCoords);
    if (requestId !== latestRequest.current) return;
    setVenues(data);
    setSortedByDistance(Boolean(requestCoords));
  } catch {
    if (requestId !== latestRequest.current) return;
    setError("Mekanlar yüklenirken bir hata oluştu.");
    setSortedByDistance(false);
  } finally {
    if (requestId === latestRequest.current) setLoading(false);
  }
}

function handleQuickCategory(category: string | undefined) {
  userInteractedRef.current = true;
  void applyFilters({ ...filters, category }, coords);
}
// VenueFilters' onChange (real prop name `value`/`onChange`, not `filters`) also sets
// userInteractedRef.current = true before calling applyFilters(next, coords).

useEffect(() => {
  if (coords && !autoSortedRef.current && !userInteractedRef.current) {
    autoSortedRef.current = true;
    void applyFilters(filters, coords);
  }
}, [coords]);
```
Render:
```tsx
{loading && <p role="status" aria-live="polite">Yükleniyor…</p>}
{error && <p role="status" aria-live="polite">{error}</p>}
{/* existing viewMode-conditional VenueList/VenueMap rendering stays, VenueMap gains key + center: */}
{viewMode === "map" && <VenueMap key={districtId} venues={venues} center={center} />}
<CategoryQuickRoute
  venues={venues}
  districtName={districtName}
  sortedByDistance={sortedByDistance}
  onSelectCategory={handleQuickCategory}
  activeCategory={filters.category}
/>
```
(`DiscoveryClient`'s props gain `districtName: string` and `center: [number, number]`, both
required, both new — added to its existing `{ districtId, initialVenues }` shape.)
- [ ] **Step 11:** Run — PASS.

- [ ] **Step 12: Wire `[district]/page.tsx` to pass the two new props**
Read the real current file (confirmed: `const current = districts.find(...); if (!current) notFound();`
already exists, giving access to `current.name` and `current.slug`/`params.district`).
```typescript
import { DISTRICT_CENTERS, DEFAULT_CENTER } from "@/lib/district-centers";
// ...
const center = DISTRICT_CENTERS[params.district] ?? DEFAULT_CENTER;
// <DiscoveryClient districtId={current.id} districtName={current.name} center={center} initialVenues={venues} />
```
- [ ] **Step 13:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`. This whole task's test
      suite is the single, coherent acceptance gate for the entire discovery experience.
- [ ] **Step 14: Commit**
```bash
git add apps/web/src/lib/district-centers.ts apps/web/src/lib/district-centers.spec.ts apps/web/src/lib/directions.ts apps/web/src/lib/directions.spec.ts apps/web/src/components/discovery-client.tsx apps/web/src/components/discovery-client.spec.tsx apps/web/src/components/venue-map.tsx apps/web/src/components/venue-map-leaflet.tsx apps/web/src/components/venue-map-leaflet.spec.tsx apps/web/src/components/category-quick-route.tsx apps/web/src/components/category-quick-route.spec.tsx apps/web/src/app/\[district\]/page.tsx apps/web/src/components/venue-detail.tsx
git commit -m "feat(web): discovery experience -- state machine (loading/error/race handling), real map centering replacing hardcoded KADIKOY_CENTER, sortedByDistance tracking, category quick-route deep link, aria-live loading state"
```

---

## Task 5: Venue detail completeness (C4, C9, C10)

**Files:**
- Modify: `apps/web/src/components/venue-map.tsx`, `apps/web/src/components/venue-map-leaflet.tsx`
  (add `focusVenue` bypass mode — new capability, additive to Task 4's changes)
- Modify: `apps/web/src/components/venue-detail.tsx`
- Modify: `apps/web/src/components/venue-card.tsx`
- Create: `apps/web/src/components/native-share-button.tsx`
- Test: `apps/web/src/components/venue-map-leaflet.spec.tsx` (append), `apps/web/src/components/venue-detail.spec.tsx` (append), `apps/web/src/components/venue-card.spec.tsx` (append), `apps/web/src/components/native-share-button.spec.tsx` (new)

**Interfaces:**
- Consumes: Plan 4b's `VenueDetailSchema` (`lat`/`lng`/`address`/`photos`); Task 4's `directionsUrl`
  and `DISTRICT_CENTERS` pattern (not directly reused here, just the same file).
- Produces: `VenueMapCanvas`/`VenueMap` gain an optional `focusVenue?: { id: string; name: string; lat: number; lng: number }`
  prop — when present, the bbox-fetch/`BoundsVenueLoader` path is skipped entirely and exactly one
  marker renders, centered on `[focusVenue.lat, focusVenue.lng]` (a concrete, data-carrying prop —
  not the round-1-rejected underspecified `singlePoint` boolean, and not a reuse of the
  bbox-driven multi-marker path, which cannot show "only this one venue"); address/photo-grid
  rendering in `venue-detail.tsx`; a new `NativeShareButton` component; `venue-card.tsx`'s Google
  badge text includes "Google yorumu" attribution (its existing `!== null` check is correct and
  unchanged — `googleRatingCount` is `.nullable()`, never `undefined`, so there is no separate
  "undefined" case to handle).

- [ ] **Step 1: `VenueMapCanvas`/`VenueMap` gain `focusVenue` — write the failing test**
```typescript
// venue-map-leaflet.spec.tsx (append)
describe("VenueMapCanvas — focusVenue bypasses the bbox fetch and shows exactly one marker", () => {
  it("renders only the given focusVenue marker, does not call getVenuesInBbox", () => {
    render(<VenueMapCanvas venues={[]} center={[40.99, 29.02]} focusVenue={{ id: "v1", name: "Cafe Test", lat: 40.99, lng: 29.02 }} />);
    expect(getVenuesInBboxMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Cafe Test")).toBeInTheDocument();
  });
});
```
(Read the current mock setup for `getVenuesInBbox` first — this test needs that mock to assert
`not.toHaveBeenCalled()`.) Run — FAIL. Implement: add `focusVenue` as an optional prop; when
present, skip mounting `BoundsVenueLoader` and skip the `getVenuesInBbox` effect entirely, render a
single `CircleMarker` at `[focusVenue.lat, focusVenue.lng]` with `aria-label={focusVenue.name}`
instead of the merged bbox-derived marker list. Thread `focusVenue` through `VenueMap` down to
`VenueMapCanvas`. Run — PASS.

- [ ] **Step 2: Write the failing test for address/map/photos in `venue-detail.tsx`**
```typescript
// venue-detail.spec.tsx (append)
describe("VenueDetail — address, real single-marker map, photo grid", () => {
  const baseVenue = { /* existing test fixture, extended with: */ address: "Bahariye Cd. No:1", lat: 40.99, lng: 29.02, photos: ["https://x/1.jpg", "https://x/2.jpg"] };

  it("renders the venue's address when present", () => {
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.getByText("Bahariye Cd. No:1")).toBeInTheDocument();
  });

  it("does not render an address section when address is null", () => {
    render(<VenueDetail venue={{ ...baseVenue, address: null }} />);
    expect(screen.queryByTestId("venue-address")).not.toBeInTheDocument();
  });

  it("renders the map focused on the venue's real coordinates with exactly one marker", () => {
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.getByLabelText(baseVenue.name)).toBeInTheDocument();
  });

  it("renders a photo grid when photos are present, using real <img> elements", () => {
    render(<VenueDetail venue={baseVenue} />);
    const images = screen.getAllByRole("img", { name: new RegExp(baseVenue.name) });
    expect(images).toHaveLength(2);
  });

  it("renders an empty state when photos is empty", () => {
    render(<VenueDetail venue={{ ...baseVenue, photos: [] }} />);
    expect(screen.getByText(/henüz fotoğraf eklenmedi/i)).toBeInTheDocument();
  });
});
```
- [ ] **Step 3:** Run — FAIL. Implement: conditionally render `venue.address`
      (`data-testid="venue-address"`); replace the current decorative map placeholder with:
```tsx
<VenueMap
  venues={[]}
  center={[venue.lat, venue.lng]}
  focusVenue={{ id: venue.id, name: venue.name, lat: venue.lat, lng: venue.lng }}
/>
```
Render a photo grid (`<img key={i} src={url} alt={`${venue.name} fotoğrafı ${i + 1}`} />` per photo)
when `venue.photos.length > 0`, else the empty-state text. Run — PASS.

- [ ] **Step 4: SSR-safe native share button — write the failing test**
```typescript
// native-share-button.spec.tsx (new)
describe("NativeShareButton", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });

  it("renders once mounted, when navigator.share is a real function, and calls it with the right title/url on click", async () => {
    const shareMock = vi.fn();
    Object.defineProperty(navigator, "share", { value: shareMock, configurable: true });
    Object.defineProperty(window, "location", { value: { href: "https://gurmego.test/mekan/cafe-test" }, writable: true });
    render(<NativeShareButton venue={{ name: "Cafe Test" }} />);
    await waitFor(() => expect(screen.getByTestId("native-share-button")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("native-share-button"));
    expect(shareMock).toHaveBeenCalledWith({ title: "Cafe Test", url: "https://gurmego.test/mekan/cafe-test" });
  });

  it("never renders when navigator.share is undefined (checks typeof, not `in`, since `in` is true for an own property set to undefined)", async () => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    render(<NativeShareButton venue={{ name: "Cafe Test" }} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId("native-share-button")).not.toBeInTheDocument();
  });
});
```
Run — FAIL. Create `apps/web/src/components/native-share-button.tsx`, mirroring
`whatsapp-share-button.tsx`'s existing structural pattern (icon + label, `data-testid`), but as a
`<button>` (an action, not a navigation link):
```tsx
"use client";
import { useEffect, useState } from "react";

export function NativeShareButton({ venue }: { venue: { name: string } }) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);
  if (!canShare) return null;
  return (
    <button data-testid="native-share-button" onClick={() => navigator.share({ title: venue.name, url: window.location.href })}>
      Paylaş
    </button>
  );
}
```
Render `<NativeShareButton venue={venue} />` next to `<WhatsappShareButton venue={venue} />` in
`venue-detail.tsx`. Run — PASS.

- [ ] **Step 5: Google badge attribution text (C10) — additive to the existing, already-correct `!== null` check**
```typescript
// venue-card.spec.tsx (append)
describe("VenueCard — Google rating badge attribution text", () => {
  it("includes '120 Google yorumu' attribution when a count is present", () => {
    render(<VenueCard venue={{ ...baseVenue, googleRating: 4.3, googleRatingCount: 120 }} />);
    expect(screen.getByText(/120 Google yorumu/)).toBeInTheDocument();
  });
  it("includes unlabeled 'Google yorumu' (no count) when googleRatingCount is null — the only real 'no count' state (the schema is .nullable(), never .optional())", () => {
    render(<VenueCard venue={{ ...baseVenue, googleRating: 4.3, googleRatingCount: null }} />);
    expect(screen.getByText(/Google yorumu/)).toBeInTheDocument();
    expect(screen.queryByText(/\(\d+\) Google yorumu/)).not.toBeInTheDocument();
  });
});
```
Run — FAIL (current badge shows just `(120)`, no "Google yorumu" text at all). Read the real
current badge JSX (confirmed: `googleRating !== null` wraps the whole badge, then
`googleRatingCount !== null && <span>({googleRatingCount})</span>` as an inner conditional) and add
"Google yorumu" text after the existing structure without changing its correct `!== null` checks:
```tsx
{venue.googleRating !== null ? (
  <span className="...">
    <svg .../>
    <span>{venue.googleRating.toFixed(1)}</span>
    {venue.googleRatingCount !== null && <span className="...">({venue.googleRatingCount})</span>}
    <span>Google yorumu</span>
  </span>
) : (
  <span />
)}
```
Run — PASS.

- [ ] **Step 6:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 7: Commit**
```bash
git add apps/web/src/components/venue-map.tsx apps/web/src/components/venue-map-leaflet.tsx apps/web/src/components/venue-map-leaflet.spec.tsx apps/web/src/components/venue-detail.tsx apps/web/src/components/venue-detail.spec.tsx apps/web/src/components/venue-card.tsx apps/web/src/components/venue-card.spec.tsx apps/web/src/components/native-share-button.tsx apps/web/src/components/native-share-button.spec.tsx
git commit -m "feat(web): venue detail shows address/real single-marker map (focusVenue bypass)/photo grid + SSR-safe native share button, venue-card Google badge attribution text"
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
- [ ] **Step 2:** Run — FAIL (current text: "Onayla (yalnızca incelendi olarak işaretler ve mekanın verified_at'ini yeniler)"). Update to: "Onayla (yalnızca bildirimi incelenmiş olarak işaretler — mekan bilgisini düzeltmek için ayrıca admin-venues API'sinden/Prisma Studio'dan güncelleme yapılmalı)".
- [ ] **Step 3:** Run — PASS.
- [ ] **Step 4:** Run: `cd apps/admin && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 5: Commit**
```bash
git add apps/admin/src/components/queue-item.tsx apps/admin/src/components/queue-item.spec.tsx
git commit -m "fix(admin): queue-item approve copy no longer claims verified_at refreshes (Plan 4b A3)"
```

---

## Task 7: Favorites collection creation (C5), open-now filter UI (C7), boutique toggle fix (Plan 4b schema)

**Files:**
- Modify: `apps/web/src/app/favoriler/page.tsx` (already a Client Component, confirmed — no
  Server/Client split needed; already renders every list as its own card in a grid, confirmed —
  only a create-list form needs adding, NOT a tab/switcher, since a newly created list already
  renders correctly once appended to the existing `lists` state array)
- Modify: `apps/web/src/components/venue-filters.tsx` (boutique toggle bug fix; new `openNow` toggle UI — `serializeFilters`/`FilterState` already updated in Task 1)
- Test: `apps/web/src/app/favoriler/page.spec.tsx` (new, or wherever this page's test lives — check), `apps/web/src/components/venue-filters.spec.tsx` (append)

**Interfaces:**
- Consumes: the REAL, already-existing `createFavoriteList(token: string, name: string): Promise<FavoriteList>`
  (confirmed in `apps/web/src/lib/api.ts` — `token` FIRST, not `createList(name, token)`); Task 1's
  `serializeFilters`'s already-added `openNow` handling; `VenueFilters`'s REAL controlled prop name
  `value` (not `filters`).
- Produces: a "create new list" form on the favorites page, appending the created list to the
  existing `lists` state (the page's existing per-list-card rendering handles display — no new
  switcher/tab component); an `openNow` toggle button in `VenueFilters`; `serializeFilters`'s
  boutique output only ever emits `"true"`, never `"false"`.

- [ ] **Step 1: Write the failing test for the boutique toggle fix** (most urgent — Plan 4b's
      schema rejects `isBoutique=false` with 400)
```typescript
// venue-filters.spec.tsx (append)
describe("VenueFilters — boutique toggle only ever sets true or undefined", () => {
  it("toggles between undefined and true, never sets false", () => {
    const onChange = vi.fn();
    const { rerender } = render(<VenueFilters value={{}} onChange={onChange} coordsAvailable={false} />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ isBoutique: true }));
    rerender(<VenueFilters value={{ isBoutique: true }} onChange={onChange} coordsAvailable={false} />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ isBoutique: undefined }));
  });
});
```
- [ ] **Step 2:** Run — FAIL (current logic: `update({ isBoutique: !filters.isBoutique })`, where
      `filters` is a local alias for the `value` prop). Change to:
      `onClick={() => update({ isBoutique: filters.isBoutique ? undefined : true })}`.
- [ ] **Step 3:** Run — PASS.

- [ ] **Step 4: Write the failing test for the `openNow` toggle UI**
```typescript
describe("VenueFilters — openNow toggle", () => {
  it("toggles between undefined and true", () => {
    const onChange = vi.fn();
    render(<VenueFilters value={{}} onChange={onChange} coordsAvailable={false} />);
    fireEvent.click(screen.getByTestId("filter-open-now"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ openNow: true }));
  });
});
```
Run — FAIL. Add a toggle button matching the boutique toggle's exact true/undefined pattern, with
label "Şimdi açık" and `data-testid="filter-open-now"`. Run — PASS.

- [ ] **Step 5: Write the failing test for creating a list, using the REAL `createFavoriteList(token, name)` signature**
```typescript
// favoriler/page.spec.tsx (append, or new file — check the real existing test location first)
describe("Favoriler page — create a new list", () => {
  it("submits a new list name via createFavoriteList(token, name) and shows it as a new card once appended", async () => {
    createFavoriteListMock.mockResolvedValue({ id: "l2", name: "Kadıköy Kahveleri", favorites: [] });
    render(<FavorilerPage />); // or however this page is actually rendered in tests -- check
    fireEvent.change(screen.getByLabelText(/liste adı/i), { target: { value: "Kadıköy Kahveleri" } });
    fireEvent.click(screen.getByRole("button", { name: /oluştur/i }));
    await waitFor(() => expect(createFavoriteListMock).toHaveBeenCalledWith(expect.any(String), "Kadıköy Kahveleri"));
    expect(await screen.findByText("Kadıköy Kahveleri")).toBeInTheDocument();
  });
});
```
Run — FAIL. Read the real current `page.tsx`'s `lists` state (`FavoriteList[] | null`) and add: a
name input + submit button calling `createFavoriteList(session.access_token, name)`, appending the
result to `lists` on success (`setLists((prev) => [...(prev ?? []), created])`) — the existing
per-list `<article>` grid rendering already handles displaying it correctly, since it already
iterates `lists` and renders each one's `favorites` (empty for a brand-new list, matching the
existing empty-list-card handling if any, or simply an empty `<ul>`). Run — PASS.

- [ ] **Step 6:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 7: Commit**
```bash
git add apps/web/src/app/favoriler apps/web/src/components/venue-filters.tsx apps/web/src/components/venue-filters.spec.tsx
git commit -m "feat(web): favorites list creation using the real createFavoriteList(token, name) helper, open-now filter toggle, fix boutique toggle for Plan 4b's OptionalTrueFlag schema"
```

---

## Task 8: Code-quality cleanup — category labels consolidation

**Files:**
- Create: `apps/web/src/lib/category-labels.ts`
- Modify: `apps/web/src/components/venue-card.tsx` (source of the canonical 4-entry map — confirmed real, correct), `venue-detail.tsx` (deletes its own stale 7-entry local map, which includes non-taxonomy keys `kahvalti`/`kahve`/`tatli`), `category-quick-route.tsx` (already imports from `venue-card.tsx` — switches its import source to the new shared file instead)
- Test: `apps/web/src/lib/category-labels.spec.ts` (new)

**Interfaces:** Consumes nothing new. Produces `CATEGORY_LABELS = { cafe: "Kahve", restaurant: "Restoran", bakery: "Fırın", "street-food": "Sokak lezzeti" }`
(the real, confirmed canonical set already in `venue-card.tsx`), consumed by all three components
instead of two separate/duplicated local definitions. (`venue-filters.tsx`'s own inline `<select>`
option labels are a distinct, pre-existing UI text choice — out of scope here, not touched, to
avoid unrelated UI-copy changes.)

- [ ] **Step 1: Write the failing test**
```typescript
// apps/web/src/lib/category-labels.spec.ts (new)
import { describe, it, expect } from "vitest";
import { CATEGORY_LABELS } from "./category-labels";

describe("CATEGORY_LABELS", () => {
  it("only contains the real backend taxonomy (no stale kahvalti/kahve/tatli entries)", () => {
    expect(Object.keys(CATEGORY_LABELS)).not.toContain("kahvalti");
    expect(Object.keys(CATEGORY_LABELS)).not.toContain("kahve");
    expect(Object.keys(CATEGORY_LABELS)).not.toContain("tatli");
    expect(CATEGORY_LABELS).toEqual({ cafe: "Kahve", restaurant: "Restoran", bakery: "Fırın", "street-food": "Sokak lezzeti" });
  });
});
```
- [ ] **Step 2:** Run — FAIL. Create `apps/web/src/lib/category-labels.ts`, moving the exact
      4-entry map currently in `venue-card.tsx` into this new file, exported as `CATEGORY_LABELS`.
      Update `venue-card.tsx` to import it from here instead of defining it locally. Delete
      `venue-detail.tsx`'s separate stale 7-entry local map entirely, importing `CATEGORY_LABELS`
      from the new shared file wherever it was used. Update `category-quick-route.tsx`'s import
      from `@/components/venue-card` to `@/lib/category-labels`.
- [ ] **Step 3:** Run — PASS. Run every affected component's existing tests to confirm no
      rendering regression from the import-path change.
- [ ] **Step 4:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 5: Commit**
```bash
git add apps/web/src/lib/category-labels.ts apps/web/src/lib/category-labels.spec.ts apps/web/src/components/venue-card.tsx apps/web/src/components/venue-detail.tsx apps/web/src/components/category-quick-route.tsx
git commit -m "refactor(web): consolidate category labels into one shared lib/category-labels.ts, drop stale non-taxonomy keys"
```

---

## Task 9: Final regression and manual smoke verification

**Files:**
- Modify: `docs/STATE.md`
- Modify: `docs/SESSION-LOG-2026-07-26.md`

- [ ] **Step 1:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`
- [ ] **Step 2:** Run: `cd apps/admin && npx vitest run && npx tsc --noEmit`
- [ ] **Step 3:** Run: `pnpm exec turbo run typecheck lint --filter=@gurmego/web... --filter=@gurmego/admin...`
- [ ] **Step 4: Manual verification (NOT an automated gate)** — start both the API (Plan 4b, this
      worktree) and the web app (`cd apps/web && pnpm run dev`), then in a real browser:
      1. Visit each of the three district pages, switch to map view, confirm the map opens
         centered correctly for each, and navigating between districts actually re-centers the map.
      2. Grant location permission, confirm the venue list auto-sorts to distance exactly once and
         the category quick-route buttons show "En yakın ... git" links only once a coords-driven
         fetch has actually succeeded.
      3. Deny location permission, confirm manual district browsing still works fully, quick-route
         buttons show neutral (non-"en yakın") copy.
      4. Open a venue detail page, confirm address/single-marker map (focused on that one venue,
         not a bbox-driven list of nearby venues)/photos (or empty state) render, and the native
         share button appears only on a browser/device that actually supports it.
      5. In the favorites page, create a new list and confirm it appears as an additional card
         alongside the existing ones.
      6. In the admin panel, open the curation queue, confirm the approve button's new copy.
- [ ] **Step 5:** Update `docs/STATE.md` and `docs/SESSION-LOG-2026-07-26.md`: Plan 4c complete,
      ready for the final whole-branch review (Superpowers reviewer + mandatory `cross-model-review`).
- [ ] **Step 6: Commit**
```bash
git add docs/STATE.md docs/SESSION-LOG-2026-07-26.md
git commit -m "docs: Plan 4c complete, ready for final whole-branch review"
```

---

## Self-Review Notes (round 4, after round 3's ground-truth-grounded YENİDEN BÖL)

- **The plan is now written against files actually read in full this round** (via a dedicated
  Explore agent pass over 13 real files), not assumed/imagined shapes — closing the specific class
  of error round 3 caught, which is more serious than a task-splitting mistake: no reordering of
  tasks fixes a plan describing components that don't exist in the assumed form.
- **The map's real architecture (`VenueMap` → dynamic-imported `VenueMapCanvas`, self-fetching via
  `getVenuesInBbox`, hardcoded `KADIKOY_CENTER`) is now respected** — Task 4 ADDS a `center` prop
  to real, working components rather than assuming one already existed; Task 5 adds a genuinely new
  `focusVenue` bypass for the single-marker case, rather than trying to force-reuse a bbox-fetching
  component that structurally cannot show "only this one venue."
- **`createFavoriteList(token, name)`'s real, already-correct signature and argument order is used
  as-is** — no phantom "create the helper" step, no signature mismatch with its own test.
- **Task 7 no longer builds a multi-list switcher that isn't needed** — the real favorites page
  already renders every list as its own card; only list creation was missing.
- **`VenueFilters`'s real `value` prop name is used throughout**, not an imagined `filters` prop.
- **C10 no longer tests an unreachable `undefined` state** — `googleRatingCount` is `.nullable()`,
  so the key is always present and the value is `number | null`, never `undefined`; the fix is
  purely additive text on top of the existing, already-correct `!== null` check.
- **`AuthForm`'s test uses its real `mode="signin"` value and real field labels**, not invented ones.
- All fixes from rounds 1 and 2 (atomic task boundaries, `sortedByDistance` replacing
  `coordsAvailable`, the mount-tracking remount test switching to map view first, `districtName`
  wiring, `LocationProvider`'s non-contradictory test/sentinel) are preserved.
