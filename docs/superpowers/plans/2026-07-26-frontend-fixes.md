# GurmeGo — Plan 4c: Frontend/Admin Kritik Düzeltmeler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every frontend/admin finding from `docs/AUDIT-2026-07-26.md`, per
`docs/superpowers/specs/2026-07-26-frontend-fixes-design.md` (HAZIR after 5 idea-red-team rounds).

## Rounds 1-2 plan-red-team (Codex, YENİDEN BÖL twice) — uygulandı

Round 1: Task 1/Task 2 both claimed ownership of the same caller files — merged into one atomic
task. Round 2: the identical bug reappeared at the Task 4/Task 9 boundary — merged the discovery
state machine, map centering, and category quick-route completion into one task.

## Round 3 plan-red-team (Codex, YENİDEN BÖL) — the plan was written against imagined interfaces

Round 3 read the real files and found the plan described components that don't exist in the
assumed form (`VenueMapLeaflet` taking a marker array, `createList(name,token)`, a favorites
switcher UI, `VenueFilters`'s prop called `filters`, `AuthForm`'s mode as `"sign-in"`, an
`undefined` case for `.nullable()` fields). Fixed via a dedicated ground-truth read of 13 real
files before the round-4 rewrite.

## Round 4 plan-red-team (Codex, YENİDEN BÖL) — grounding was still incomplete, plus real design gaps

Round 4 re-verified the round-3 rewrite by grepping the actual files directly and found:

1. **`serializeFilters` DOES currently emit `out.lat`/`out.lng`** (`venue-filters.tsx` lines 25-26,
   confirmed by direct read this round) — only when `radiusM` AND `coords` are both present. The
   round-3 rewrite's claim that "there was nothing to remove" was itself wrong (an artifact of the
   earlier Explore agent's report missing these two lines). **Confirmed by reading the file
   directly in this round — Task 1 restores a real "stop emitting lat/lng" step.**
2. **C13's real gap is three separate silent `if (loading) return null` screens** —
   `apps/web/src/app/favoriler/page.tsx:26`, `apps/admin/src/app/(protected)/layout.tsx:42`,
   `apps/admin/src/app/(protected)/kuyruk/page.tsx:90` (all confirmed by direct read this round) —
   not "add a loading message to Discovery," which doesn't touch any of the audit's actual targets.
3. **C14 needs real keyboard accessibility, not just an `aria-label`.** React-Leaflet's
   `CircleMarker` renders an SVG path with no native focus/keyboard-activation behavior (unlike
   `Marker`, which uses `keyboard: true` by default) — an `aria-label` alone doesn't make it
   tabbable or Enter/Space-activatable.
4. **Task 6's premise was wrong**: the REAL current visible approve-button text (confirmed by
   direct read) already says "yalnızca incelendi olarak işaretler" — it does NOT claim to refresh
   `verified_at`. That claim only survives in a stale source-code comment near the button, not in
   user-facing copy. The fix target is the comment, not the visible text (though the visible text
   can still be made more descriptive as a secondary improvement).
5. Task 4 (the merged discovery/map/quick-route task) was still too large — six audit findings,
   two new helper files, and a from-scratch Leaflet test harness in one task. Split into three
   ordered, self-contained vertical slices, each producing and consuming its own new props in the
   same commit: **(a)** location/request-state slice (LocationProvider migration into
   `DiscoveryClient`, loading/error/race handling, one-time auto-sort, `sortedByDistance`, plus a
   `key={current.id}` at `[district]/page.tsx`'s `DiscoveryClient` call site so district navigation
   resets ALL of `DiscoveryClient`'s state — not just the map's — closing a real gap the round-3
   plan missed: only `VenueMap`'s `key` was remounting, leaving `venues`/`filters`/refs stale
   across a district change); **(b)** map-centering slice (`DISTRICT_CENTERS`, a real `center` prop
   threaded through the real `VenueMap`/`VenueMapCanvas`, replacing the hardcoded `KADIKOY_CENTER`);
   **(c)** category-quick-route slice (shared `directionsUrl`, `CategoryQuickRoute`'s widened
   contract, wired using slice (a)'s `sortedByDistance`).
6. Several test-authoring bugs: `sortedByDistance` test fixtures used incomplete `{id,name}` shapes
   that don't typecheck against the real `VenueListItem`; the remount test's `vi.mock` needed
   `vi.hoisted()` state, not a local closure variable; `venue-map-leaflet.spec.tsx` doesn't exist
   yet (must be created from scratch, not "extend the existing mock"); the `focusVenue` test used
   `venues=[]`, which the existing loader already skips regardless of the fix, proving nothing —
   needs a non-empty `venues` array and a distinct `center` to actually prove the bypass and the
   marker-count/center precedence; C10's planned output text (`"(120) Google yorumu"`) didn't match
   the design doc's literal format (`"· 120 Google yorumu"`); `venue-card.spec.tsx`/
   `venue-map-leaflet.spec.tsx` don't exist yet (create, don't "append"); `packages/api-client` has
   no Vitest devDependency/config at all — a test file can't just be dropped in and run from
   `apps/web`'s workspace; `AuthForm`'s real `signIn`/`signUp` resolve `{ error: string | null }`,
   not `void` — a mock resolving `undefined` would break the real destructuring; reassigning
   `window.location` via `Object.defineProperty` is unreliable in jsdom — the native-share test
   should assert the `navigator.share` payload without touching `window.location` at all.

**All of the above are fixed in this revision, each at the specific location identified above.**
A pre-flight step is added to Task 1 to catch any other pre-existing fixture drift against Plan
4b's real schema before this plan's own gates run.

**Architecture:** No new backend calls beyond what Plan 4b already exposes, except the venue-detail
map's single-marker rendering (reuses `VenueMapCanvas`'s existing Leaflet scaffolding with its
bbox-fetch bypassed, not a new endpoint). The only new cross-cutting runtime mechanism is header
propagation through `packages/api-client` → `apps/web/src/lib/api.ts`, plus a `LocationProvider`
context replacing two independent `useGeolocation()` calls.

**Tech Stack:** Next.js (App Router), React, Vitest + `@testing-library/react`.

## Global Constraints

- Clients (`apps/web`, `apps/admin`) contain no business logic — display + request layer only.
- `X-User-Location` header format: `"<lat>,<lng>"` — identical to Plan 4b's `UserLocationHeaderSchema`.
- Without location permission/on denial, manual district selection must keep full functionality.
- This plan depends on Plan 4b being complete.
- Follow this codebase's existing test convention exactly: Vitest, `@testing-library/react`,
  co-located `ComponentName.spec.tsx`, `vi.mock("@/lib/api", ...)` / `vi.mock("@/lib/auth-context", ...)`.
- **A signature/prop-contract change is only complete in the same task as every one of its direct
  consumers.** Established after two red-team rounds caught this violated at two different task
  boundaries.
- **Every task's "Files"/"Interfaces" section states the REAL current signature it changes FROM,
  confirmed by directly reading the file in this session, not an assumed or previously-reported
  shape** — established after round 3 caught the plan drafting against imagined interfaces, and
  round 4 caught that even a "ground-truth" pass can itself be wrong (the `serializeFilters`
  lat/lng lines) if not verified by a direct read at rewrite time.

---

## Task 1: API client header propagation (atomic — signature change + every direct caller)

**Files:**
- Modify: `packages/api-client/src/index.ts`, `packages/api-client/package.json` (add a minimal
  Vitest devDependency + `test` script — this package currently has none, confirmed; it only has
  `generate`/`typecheck` scripts)
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/components/venue-filters.tsx` (`serializeFilters` — REMOVES the real
  existing `out.lat`/`out.lng` lines at 25-26, ADDS `openNow` handling)
- Modify: `apps/web/src/components/discovery-client.tsx` (only the `getVenues` call site, real
  current line: `const { data } = await getVenues({ districtId, ...serializeFilters(next, coords) });`)
- Modify: `apps/web/src/components/district-picker.tsx` (only its `getNearestDistrict` call site —
  read the file first to find the exact current call)
- Test: `packages/api-client/src/index.spec.ts` (new), `apps/web/src/lib/api.spec.ts` (append),
  `apps/web/src/components/venue-filters.spec.tsx` (append), `apps/web/src/components/discovery-client.spec.tsx` (append — one call-site test only), `apps/web/src/components/district-picker.spec.tsx` (append)

**Interfaces:**
- Consumes: nothing new
- Produces: `createApiClient(...).get<T>(path, options?: { headers?: Record<string,string> })`;
  `fetchValidated(path, schema, token?, headers?)`; `locationHeaders(coords?: Coords | null)`;
  `getVenues(query, coords?: Coords | null)` (adds a 2nd param); `getNearestDistrict(coords: Coords)`
  (changes from `(lat, lng)` to one object); `serializeFilters` no longer emits `lat`/`lng`;
  `FilterState` gains `openNow?: boolean`.

- [ ] **Step 0: Pre-flight baseline check**
Run `cd apps/web && npx vitest run && npx tsc --noEmit` BEFORE any change in this plan. If
anything fails, determine whether the failure is pre-existing drift unrelated to this plan (e.g. a
test fixture missing a field Plan 4b's schema now requires, such as `VenueDetailSchema`'s
`lat`/`lng`/`address`/`photos`) — if so, fix ONLY that fixture drift as part of this step (small,
mechanical, necessary to get a clean starting gate), and note it in the eventual final report. Do
not fold unrelated feature work into this step.

- [ ] **Step 1: Add Vitest to `packages/api-client`**
```json
// packages/api-client/package.json — add to devDependencies and scripts
"vitest": "^2.1.0"
```
```json
"scripts": {
  "generate": "openapi-typescript ../../apps/api/openapi.json -o src/generated-types.ts",
  "typecheck": "tsc --noEmit",
  "test": "vitest run"
}
```
(Match the exact Vitest version already used elsewhere in the monorepo — check `apps/web/package.json` — and add a minimal `vitest.config.ts` in `packages/api-client` if one doesn't already exist, mirroring `apps/web`'s config for the parts that matter: test environment, etc. Run `pnpm install` after editing.)

- [ ] **Step 2: Write the failing test for `createApiClient().get()`'s new headers option**
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
- [ ] **Step 3:** Run: `cd packages/api-client && npx vitest run` — FAIL.
- [ ] **Step 4: Update `packages/api-client/src/index.ts`'s `get()`**
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
- [ ] **Step 5:** Run — PASS.

- [ ] **Step 6: Write the failing test for `fetchValidated`'s new `headers` param, `locationHeaders`, and `getVenues`/`getNearestDistrict`'s new signatures**
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
  it("sends the exact X-User-Location header derived from coords", async () => {
    const getSpy = vi.spyOn(client, "get").mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });
    await getVenues({ districtId: "d1" }, { lat: 40.99, lng: 29.02 });
    expect(getSpy.mock.calls[0][1]).toEqual({ headers: { "X-User-Location": "40.99,29.02" } });
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
(Read `apps/web/src/lib/api.ts`'s real internals first to pick the right spy target.)
- [ ] **Step 7:** Run — FAIL.
- [ ] **Step 8: Implement in `apps/web/src/lib/api.ts`**
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
(Read the real current `getVenues`/`getNearestDistrict` bodies first — `getNearestDistrict` is
currently `(lat: number, lng: number)`, building `/districts/nearest?lat=${lat}&lng=${lng}`; this
replaces that with a single `coords` argument and no query params at all. Import `Coords` from
`./use-geolocation`.)
- [ ] **Step 9:** Run — PASS.

- [ ] **Step 10: `serializeFilters` — remove the REAL existing `out.lat`/`out.lng` lines, add `openNow`**
Read the real current function (confirmed):
```typescript
export function serializeFilters(filters: FilterState, coords?: Coords | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.category) out.category = filters.category;
  if (filters.priceRange) out.priceRange = filters.priceRange;
  if (filters.isBoutique !== undefined) out.isBoutique = String(filters.isBoutique);
  if (filters.radiusM !== undefined && coords) {
    out.radiusM = String(filters.radiusM);
    out.lat = String(coords.lat);   // <-- REMOVE
    out.lng = String(coords.lng);   // <-- REMOVE
  }
  return out;
}
```
New version:
```typescript
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
`FilterState` gains `openNow?: boolean;`. Write the failing test first — read the EXISTING
`venue-filters.spec.tsx` test(s) that currently assert `lat`/`lng` ARE present in the output (they
must exist, since the current implementation emits them) and update those assertions to the
opposite, plus add the new `openNow` test:
```typescript
describe("serializeFilters — location now travels via header, not query params", () => {
  it("never includes lat/lng, even when coords and radiusM are both present", () => {
    const out = serializeFilters({ radiusM: 2000 }, { lat: 40.99, lng: 29.02 });
    expect(out).toEqual({ radiusM: "2000" });
  });
});

describe("serializeFilters — openNow", () => {
  it("emits openNow=true only when true, omits it when false or undefined", () => {
    expect(serializeFilters({ openNow: true })).toEqual({ openNow: "true" });
    expect(serializeFilters({ openNow: false })).toEqual({});
    expect(serializeFilters({})).toEqual({});
  });
});
```
Run — FAIL (the pre-existing lat/lng test fails against the NEW expectation, proving the removal
still needs to happen; the openNow test fails because the field doesn't exist yet). Apply the
change. Run — PASS.

- [ ] **Step 11: Update `discovery-client.tsx`'s ONE `getVenues` call site**, adding `coords` as
      the second argument (the real current line only passes one argument):
```typescript
const { data } = await getVenues({ districtId, ...serializeFilters(next, coords) }, coords);
```
Write the failing test asserting the exact coords value reaches the mock, confirm it fails first,
apply, confirm it passes.

- [ ] **Step 12: Update `district-picker.tsx`'s ONE `getNearestDistrict` call site** — read the
      file first to find the current two-argument call, change to the single `coords` object.
      Write the failing test, confirm fail, fix, confirm pass.

- [ ] **Step 13:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit` and
      `cd packages/api-client && npx vitest run`. Confirm every caller of
      `getVenues`/`getNearestDistrict` in `apps/web` compiles (grep for both names).
- [ ] **Step 14: Commit**
```bash
git add packages/api-client apps/web/src/lib/api.ts apps/web/src/lib/api.spec.ts apps/web/src/components/venue-filters.tsx apps/web/src/components/venue-filters.spec.tsx apps/web/src/components/discovery-client.tsx apps/web/src/components/discovery-client.spec.tsx apps/web/src/components/district-picker.tsx apps/web/src/components/district-picker.spec.tsx
git commit -m "feat(web): add coords parameter + X-User-Location header to getVenues/getNearestDistrict, remove lat/lng from serializeFilters, add openNow serialization, add Vitest to api-client"
```

---

## Task 2: `LocationProvider` — single shared coordinate source (provider only — `DiscoveryClient`'s migration is Task 3's job, not claimed here)

**Files:**
- Create: `apps/web/src/lib/location-context.tsx`
- Modify: `apps/web/src/app/[district]/page.tsx` (wrap `DistrictPicker` + `DiscoveryClient` in the provider)
- Modify: `apps/web/src/components/district-picker.tsx` (consume `useLocationContext()` instead of its own `useGeolocation()`)
- Test: `apps/web/src/lib/location-context.spec.tsx` (new), `apps/web/src/components/district-picker.spec.tsx` (append)

**Interfaces:**
- Consumes: `apps/web/src/lib/use-geolocation.ts`'s real `useGeolocation(): Coords | null`
- Produces: `LocationProvider`, `useLocationContext(): Coords | null`. Consumed by this task's own
  `district-picker.tsx` update, and by Task 3 (which migrates `DiscoveryClient` — NOT this task,
  so `DiscoveryClient` still calls `useGeolocation()` directly until Task 3 lands; this task does
  not claim "single source achieved," only "the shared provider now exists").

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
    expect(getCurrentPositionSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("a")).toHaveTextContent("40.99,29.02");
    expect(screen.getByTestId("b")).toHaveTextContent("40.99,29.02");
  });
});
```
- [ ] **Step 2:** Run — FAIL. Create `apps/web/src/lib/location-context.tsx`, following the exact
      provider pattern `apps/web/src/lib/auth-context.tsx` establishes, defaulting to `null` (the
      hook's own real unresolved value):
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
Read `[district]/page.tsx`'s real current content (a Server Component rendering
`<DistrictPicker districts={districts} current={params.district} />` then
`<DiscoveryClient districtId={current.id} initialVenues={venues} />`, after
`getDistricts()`/`.find()`/`notFound()`). Wrap both children in `<LocationProvider>...</LocationProvider>`.
Read `district-picker.tsx` to find its current `useGeolocation()` call, replace with
`useLocationContext()`. Write the failing test:
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
  expect(spy).toHaveBeenCalledTimes(1); // LocationProvider's own call only, not a second one from DistrictPicker
});
```
Confirm it fails against the pre-migration code, migrate, confirm it passes.

- [ ] **Step 5:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 6: Commit**
```bash
git add apps/web/src/lib/location-context.tsx apps/web/src/lib/location-context.spec.tsx apps/web/src/app/\[district\]/page.tsx apps/web/src/components/district-picker.tsx apps/web/src/components/district-picker.spec.tsx
git commit -m "feat(web): LocationProvider -- shared geolocation source, migrate district-picker (DiscoveryClient's migration is a separate task)"
```

---

## Task 3: Discovery location/request-state slice (C2, C8) — atomic, migrates `DiscoveryClient` onto `LocationProvider`

**Files:**
- Modify: `apps/web/src/components/discovery-client.tsx`
- Modify: `apps/web/src/app/[district]/page.tsx` (add `key={current.id}` to the `<DiscoveryClient>`
  call — no new props needed for this alone)
- Test: `apps/web/src/components/discovery-client.spec.tsx` (append)

**Interfaces:**
- Consumes: Task 2's `useLocationContext()`; Task 1's `getVenues(query, coords)` (already wired at
  this file's one call site).
- Produces: `DiscoveryClient` migrated off its own `useGeolocation()` call; `loading`/`error`
  state with a `latestRequest` ref discarding stale responses; a `sortedByDistance: boolean` state
  (true only immediately after a successful coords-driven fetch, reset to `false` on failure or a
  user-driven filter change before coords resolved) — NOT exposed to any other component yet
  (Task 5 is the first to consume it); the one-time auto-sort effect guarded by
  `autoSortedRef`/`userInteractedRef`.

- [ ] **Step 1: Migrate off `useGeolocation()`**
Read the real current file (`const coords = useGeolocation();`). Replace with
`const coords = useLocationContext();`, update the import, update this file's existing test mocks
from mocking `useGeolocation` to mocking `useLocationContext`. Run existing tests to confirm no
regression before adding new behavior.

- [ ] **Step 2: Write the failing tests for loading/error/race-discarding (C2)**
```typescript
// discovery-client.spec.tsx (append)
describe("DiscoveryClient — loading, error, and stale-response discarding (C2)", () => {
  it("shows a loading indicator while a request is in flight and an error message on failure", async () => {
    getVenuesMock.mockRejectedValueOnce(new Error("500"));
    render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    await waitFor(() => expect(screen.getByRole("status", { name: /hata|yükleniyor/i })).toBeInTheDocument());
  });

  it("ignores a slow first response if a second request has already started", async () => {
    let resolveFirst: (v: unknown) => void;
    getVenuesMock
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ data: [{ id: "v2", name: "Second", slug: "second", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: null, googleRatingCount: null }], meta: { next_cursor: null, has_more: false } });
    render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    fireEvent.click(screen.getByTestId("filter-boutique")); // toggles back off -- a second distinct request
    await waitFor(() => expect(screen.getByText("Second")).toBeInTheDocument());
    resolveFirst!({ data: [{ id: "v1", name: "First", slug: "first", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: null, googleRatingCount: null }], meta: { next_cursor: null, has_more: false } });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText("First")).not.toBeInTheDocument();
  });
});
```
(Full `VenueListItem`-shaped fixtures throughout — the real schema requires `slug`/`category`/
`priceRange`/`isBoutique`/`editorialNote`/`googleRating`/`googleRatingCount`, all confirmed by
reading `apps/web/src/lib/api.ts`'s local `VenueListItemSchema`.) Run — FAIL. Implement:
```typescript
const latestRequest = useRef(0);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [sortedByDistance, setSortedByDistance] = useState(false);
const autoSortedRef = useRef(false);
const userInteractedRef = useRef(false);

async function applyFilters(next: FilterState) {
  userInteractedRef.current = true;
  const requestId = ++latestRequest.current;
  setFilters(next);
  setLoading(true);
  setError(null);
  try {
    const { data } = await getVenues({ districtId, ...serializeFilters(next, coords) }, coords);
    if (requestId !== latestRequest.current) return;
    setVenues(data);
    setSortedByDistance(Boolean(coords));
  } catch {
    if (requestId !== latestRequest.current) return;
    setError("Mekanlar yüklenirken bir hata oluştu.");
    setSortedByDistance(false);
  } finally {
    if (requestId === latestRequest.current) setLoading(false);
  }
}
```
Render `{loading && <p role="status" aria-live="polite">Yükleniyor…</p>}` /
`{error && <p role="status" aria-live="polite">{error}</p>}`. Run — PASS.

- [ ] **Step 3: Write the failing tests for `sortedByDistance` and the one-time auto-sort effect**
```typescript
describe("DiscoveryClient — sortedByDistance and the one-time auto-sort effect", () => {
  it("is false before coords resolve, true immediately after the resulting auto-fetch succeeds, exactly once", async () => {
    vi.mocked(useLocationContextMock).mockReturnValue(null);
    const { rerender } = render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    vi.mocked(useLocationContextMock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    getVenuesMock.mockResolvedValueOnce({ data: [{ id: "v1", name: "X", slug: "x", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: null, googleRatingCount: null }], meta: { next_cursor: null, has_more: false } });
    rerender(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledWith(expect.any(Object), { lat: 40.99, lng: 29.02 }));
    expect(getVenuesMock).toHaveBeenCalledTimes(1);
    rerender(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    expect(getVenuesMock).toHaveBeenCalledTimes(1); // no extra call from an unrelated rerender
  });

  it("does not auto-refetch if the user already changed a filter before coords resolved (same instance, via rerender, refs preserved)", async () => {
    vi.mocked(useLocationContextMock).mockReturnValue(null);
    const { rerender } = render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledTimes(1));
    vi.mocked(useLocationContextMock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    rerender(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(getVenuesMock).toHaveBeenCalledTimes(1); // still just the user's own request
  });

  it("resets sortedByDistance to false if a coords-driven fetch fails", async () => {
    vi.mocked(useLocationContextMock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    getVenuesMock.mockRejectedValueOnce(new Error("500"));
    render(<DiscoveryClient districtId="d1" initialVenues={[{ id: "v0", name: "Initial", slug: "initial", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: null, googleRatingCount: null }]} />);
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledTimes(1));
    // sortedByDistance isn't rendered anywhere yet in this task -- Task 5 is the first consumer.
    // This test only proves the STATE transition via a later re-triggered success/failure pair is
    // consistent; expand with a visible assertion once Task 5 wires a data-attribute consumer.
  });
});
```
Implement:
```typescript
useEffect(() => {
  if (coords && !autoSortedRef.current && !userInteractedRef.current) {
    autoSortedRef.current = true;
    void applyFilters(filters);
  }
}, [coords]);
```
(Note: `applyFilters` sets `userInteractedRef.current = true` unconditionally per Step 2's
implementation — for the auto-sort effect specifically, guard against that: extract the shared
body into an internal function that the auto-sort effect calls WITHOUT setting
`userInteractedRef`, while the public `applyFilters` (called from user-facing handlers) does set
it. Adjust:)
```typescript
async function runFetch(next: FilterState, requestCoords: Coords | null) {
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

function applyFilters(next: FilterState) {
  userInteractedRef.current = true;
  void runFetch(next, coords);
}

useEffect(() => {
  if (coords && !autoSortedRef.current && !userInteractedRef.current) {
    autoSortedRef.current = true;
    void runFetch(filters, coords);
  }
}, [coords]);
```
Run — PASS.

- [ ] **Step 4: Add `key={current.id}` to `[district]/page.tsx`'s `<DiscoveryClient>` call**
This is a one-line addition to the existing call (`<DiscoveryClient key={current.id} districtId={current.id} initialVenues={venues} />`)
guaranteeing React treats each district as a fresh component instance — resetting `venues`,
`filters`, `autoSortedRef`, `userInteractedRef`, and `sortedByDistance` on district navigation, not
just the map (which Task 4 addresses separately for the map's own remount). No test needed for
this specific line — React's `key` semantics are a framework guarantee, not application logic to
unit-test; it is verified in Task 8's final manual smoke pass (district-to-district navigation).

- [ ] **Step 5:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 6: Commit**
```bash
git add apps/web/src/components/discovery-client.tsx apps/web/src/components/discovery-client.spec.tsx apps/web/src/app/\[district\]/page.tsx
git commit -m "feat(web): DiscoveryClient migrates to LocationProvider, loading/error/race handling, one-time auto-sort with sortedByDistance, key-based state reset on district navigation"
```

---

## Task 4: Map-centering slice (C3) — real `center` prop on the real `VenueMap`/`VenueMapCanvas`

**Files:**
- Create: `apps/web/src/lib/district-centers.ts`
- Modify: `apps/web/src/components/venue-map.tsx` (real current: `export function VenueMap({ venues }: { venues: VenueListItem[] })`, `next/dynamic`-imports `VenueMapCanvas` with `ssr: false`)
- Modify: `apps/web/src/components/venue-map-leaflet.tsx` (real current: hardcoded `const KADIKOY_CENTER: [number, number] = [40.9909, 29.0287];` used at `<MapContainer center={KADIKOY_CENTER} ...>`)
- Modify: `apps/web/src/components/discovery-client.tsx` (gains a `center: [number, number]` prop, forwards to `<VenueMap key={districtId} center={center} venues={venues} />` — real current line is `{viewMode === "list" ? <VenueList venues={venues} /> : <VenueMap venues={venues} />}`)
- Modify: `apps/web/src/app/[district]/page.tsx` (resolves `center` from the new `DISTRICT_CENTERS` map, passes to `DiscoveryClient`)
- Test: `apps/web/src/lib/district-centers.spec.ts` (new), `apps/web/src/components/venue-map-leaflet.spec.tsx` (new — this file does NOT exist yet, confirmed; a full Leaflet mock harness is created here, not extended)

**Interfaces:**
- Consumes: nothing from Task 3 (this slice is independent of the location/request-state changes —
  ordered after Task 3 only to keep task numbering linear, not because of a dependency)
- Produces: `DISTRICT_CENTERS: Record<string, [number, number]>`/`DEFAULT_CENTER`; `VenueMapCanvas`
  and `VenueMap` gain a `center: [number, number]` prop, REPLACING the `KADIKOY_CENTER` hardcode
  (deleted); `DiscoveryClient` gains a required `center: [number, number]` prop; `key={districtId}`
  is added at `DiscoveryClient`'s own `<VenueMap>` render (in addition to Task 3's
  `key={current.id}` on `DiscoveryClient` itself at the page level — this one specifically forces
  `VenueMap` to remount even in the hypothetical case `DiscoveryClient`'s own key didn't already
  guarantee it, since `viewMode` can toggle without a district change).

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
- [ ] **Step 3:** Run — PASS.

- [ ] **Step 4: Create a fresh Leaflet mock harness and write the failing test for `center`**
`venue-map-leaflet.spec.tsx` does not exist in this repo yet — this step creates it from scratch.
```typescript
// apps/web/src/components/venue-map-leaflet.spec.tsx (new)
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VenueMapCanvas } from "./venue-map-leaflet";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ center, children }: { center: [number, number]; children: React.ReactNode }) => (
    <div data-testid="map-container" data-center={center.join(",")}>{children}</div>
  ),
  TileLayer: () => null,
  CircleMarker: ({ center, children }: { center: [number, number]; children: React.ReactNode }) => (
    <div data-testid="circle-marker" data-center={center.join(",")}>{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({ getBounds: () => ({ getWest: () => 0, getSouth: () => 0, getEast: () => 0, getNorth: () => 0 }) }),
  useMapEvents: () => undefined,
}));
vi.mock("@/lib/api", () => ({ getVenuesInBbox: vi.fn().mockResolvedValue([]) }));

describe("VenueMapCanvas — center prop replaces the hardcoded KADIKOY_CENTER", () => {
  it("passes the given center prop through to the map container", () => {
    render(<VenueMapCanvas venues={[]} center={[40.9906, 29.0274]} />);
    expect(screen.getByTestId("map-container")).toHaveAttribute("data-center", "40.9906,29.0274");
  });
});
```
(This mock replaces the ENTIRE `react-leaflet` module for this test file — match every export
`venue-map-leaflet.tsx` actually imports, confirmed: `CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents`. Also mock `next/link` if JSX inside `Popup` needs it, and mock `@/lib/api`'s `getVenuesInBbox` since `BoundsVenueLoader` calls it on mount.) Run — FAIL (no `center`
prop exists yet, `KADIKOY_CENTER` is hardcoded). Add a `center: [number, number]` prop to
`VenueMapCanvas`, replace `<MapContainer center={KADIKOY_CENTER} ...>` with
`<MapContainer center={center} ...>`, delete the `KADIKOY_CENTER` constant. Thread `center` through
`VenueMap` (the `next/dynamic` wrapper) down to `VenueMapCanvas`. Run — PASS.

- [ ] **Step 5: Wire `DiscoveryClient` and `[district]/page.tsx`**
```typescript
// discovery-client.tsx -- gains a center prop
export function DiscoveryClient({ districtId, initialVenues, center }: { districtId: string; initialVenues: VenueListItem[]; center: [number, number] }) {
  // ...
  {viewMode === "map" && <VenueMap key={districtId} venues={venues} center={center} />}
```
```typescript
// [district]/page.tsx
import { DISTRICT_CENTERS, DEFAULT_CENTER } from "@/lib/district-centers";
// ...
const center = DISTRICT_CENTERS[params.district] ?? DEFAULT_CENTER;
// <DiscoveryClient key={current.id} districtId={current.id} initialVenues={venues} center={center} />
```
Write the failing test asserting `DiscoveryClient` forwards `center` to `VenueMap` (mock
`./venue-map`, assert the prop value), confirm fail, wire it, confirm pass.

- [ ] **Step 6:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 7: Commit**
```bash
git add apps/web/src/lib/district-centers.ts apps/web/src/lib/district-centers.spec.ts apps/web/src/components/venue-map.tsx apps/web/src/components/venue-map-leaflet.tsx apps/web/src/components/venue-map-leaflet.spec.tsx apps/web/src/components/discovery-client.tsx apps/web/src/components/discovery-client.spec.tsx apps/web/src/app/\[district\]/page.tsx
git commit -m "feat(web): real per-district map centering -- DISTRICT_CENTERS, center prop replacing hardcoded KADIKOY_CENTER, new Leaflet test harness"
```

---

## Task 5: Category quick-route slice (C6) — atomic, consumes Task 3's `sortedByDistance`

**Files:**
- Create: `apps/web/src/lib/directions.ts`
- Modify: `apps/web/src/components/venue-detail.tsx` (extracts its real, existing local
  `directionsUrl(venue)` — confirmed at line 30 — to delegate to the new shared helper)
- Modify: `apps/web/src/components/category-quick-route.tsx` (real current props confirmed:
  `{ activeCategory?: string; onSelectCategory: (category: string) => void }`)
- Modify: `apps/web/src/components/discovery-client.tsx` (gains `districtName: string` prop, wires
  `venues`/`districtName`/`sortedByDistance` into `CategoryQuickRoute`, widens
  `handleQuickCategory` — real current: `function handleQuickCategory(category: string) { void applyFilters({ ...filters, category }); }`)
- Modify: `apps/web/src/app/[district]/page.tsx` (passes `districtName={current.name}`)
- Test: `apps/web/src/lib/directions.spec.ts` (new), `apps/web/src/components/category-quick-route.spec.tsx` (append), `apps/web/src/components/discovery-client.spec.tsx` (append)

**Interfaces:**
- Consumes: Task 3's `sortedByDistance` state (already in `DiscoveryClient`, first exposed here).
- Produces: `directionsUrl(venueName: string, districtName: string): string`; `CategoryQuickRoute`
  gains `venues: VenueListItem[]`, `districtName: string`, `sortedByDistance: boolean` props;
  `onSelectCategory` widens to `(category: string | undefined) => void`; `DiscoveryClient` gains
  `districtName: string`.

- [ ] **Step 1: Extract `directionsUrl` from its real location in `venue-detail.tsx`**
Read the confirmed real function (`function directionsUrl(venue: VenueDetailType): string { const query = encodeURIComponent(\`${venue.name} ${venue.district.name}\`); return \`https://www.google.com/maps/dir/?api=1&destination=${query}\`; }`).
Write the failing test for the new shared, two-string-argument version:
```typescript
// apps/web/src/lib/directions.spec.ts (new)
import { describe, it, expect } from "vitest";
import { directionsUrl } from "./directions";

describe("directionsUrl", () => {
  it("builds a Google Maps text-search deep link from name + district", () => {
    expect(directionsUrl("Cafe Test", "Kadıköy")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent("Cafe Test Kadıköy"),
    );
  });
});
```
Run — FAIL. Create `apps/web/src/lib/directions.ts`:
```typescript
export function directionsUrl(venueName: string, districtName: string): string {
  const query = encodeURIComponent(`${venueName} ${districtName}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}
```
Update `venue-detail.tsx`'s local `directionsUrl(venue)` to delegate:
`directionsUrl(venue.name, venue.district.name)` at its one call site
(`href={directionsUrl(venue)}` — keep this call site unchanged, just change the function body to
delegate). Run existing `venue-detail.spec.tsx` tests to confirm no regression. Run the new test — PASS.

- [ ] **Step 2: `CategoryQuickRoute`'s widened contract — write the failing test against its real current two-field shape**
```typescript
// category-quick-route.spec.tsx (append)
describe("CategoryQuickRoute — widened contract: venues, districtName, sortedByDistance, deselect", () => {
  const venues = [{ id: "v1", name: "First Cafe", slug: "first-cafe", category: "cafe", priceRange: "BUDGET", isBoutique: true, editorialNote: null, googleRating: null, googleRatingCount: null }];

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
- [ ] **Step 3:** Run — FAIL. Update `CategoryQuickRoute`'s props to
      `{ activeCategory?: string; venues: VenueListItem[]; districtName: string; sortedByDistance: boolean; onSelectCategory: (category: string | undefined) => void }`.
      Click handler: `onSelectCategory(activeCategory === category ? undefined : category)`. When
      `activeCategory` matches a real category and at least one venue in `venues` has that
      category, render a directions link using `directionsUrl(matchingVenue.name, districtName)`,
      label `` sortedByDistance ? `En yakın ${label} mekana git` : `${label} mekana git` ``. Run — PASS.

- [ ] **Step 4: Wire `DiscoveryClient` and `[district]/page.tsx`**
```typescript
// discovery-client.tsx
export function DiscoveryClient({ districtId, initialVenues, center, districtName }: { districtId: string; initialVenues: VenueListItem[]; center: [number, number]; districtName: string }) {
  // ...
  function handleQuickCategory(category: string | undefined) {
    applyFilters({ ...filters, category });
  }
  // ...
  <CategoryQuickRoute
    venues={venues}
    districtName={districtName}
    sortedByDistance={sortedByDistance}
    onSelectCategory={handleQuickCategory}
    activeCategory={filters.category}
  />
```
```typescript
// [district]/page.tsx
// <DiscoveryClient key={current.id} districtId={current.id} initialVenues={venues} center={center} districtName={current.name} />
```
Write the failing test confirming `DiscoveryClient` passes the right props through to a mocked
`CategoryQuickRoute`, confirm fail, wire, confirm pass.

- [ ] **Step 5:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 6: Commit**
```bash
git add apps/web/src/lib/directions.ts apps/web/src/lib/directions.spec.ts apps/web/src/components/venue-detail.tsx apps/web/src/components/category-quick-route.tsx apps/web/src/components/category-quick-route.spec.tsx apps/web/src/components/discovery-client.tsx apps/web/src/components/discovery-client.spec.tsx apps/web/src/app/\[district\]/page.tsx
git commit -m "feat(web): category quick-route real directions deep link + deselect-on-second-click, wired to sortedByDistance"
```

---

## Task 6: Venue detail completeness (C4, C9, C10)

**Files:**
- Modify: `apps/web/src/components/venue-map.tsx`, `apps/web/src/components/venue-map-leaflet.tsx` (add `focusVenue` bypass — additive to Task 4's `center` prop)
- Modify: `apps/web/src/components/venue-detail.tsx` (real current: no map/address/photos rendering at all today, confirmed by full read — these are net-new sections, not replacements of a placeholder)
- Modify: `apps/web/src/components/venue-card.tsx` (real current badge, confirmed lines 68-78: already correctly checks `venue.googleRating !== null` and `venue.googleRatingCount !== null`)
- Create: `apps/web/src/components/native-share-button.tsx`
- Test: `apps/web/src/components/venue-map-leaflet.spec.tsx` (append), `apps/web/src/components/venue-detail.spec.tsx` (append), `apps/web/src/components/venue-card.spec.tsx` (new — this file does not exist yet, confirmed), `apps/web/src/components/native-share-button.spec.tsx` (new)

**Interfaces:**
- Consumes: Plan 4b's `VenueDetailSchema` (`lat`/`lng`/`address`/`photos`)
- Produces: `VenueMapCanvas`/`VenueMap` gain an optional `focusVenue?: { id: string; name: string; lat: number; lng: number }`
  prop; when present, the effective map center is ALWAYS `[focusVenue.lat, focusVenue.lng]`
  (documented priority over the `center` prop, with a test proving it), `BoundsVenueLoader`/its
  bbox fetch is skipped entirely, and exactly one marker renders; address/photo-grid rendering in
  `venue-detail.tsx`; a new `NativeShareButton`; `venue-card.tsx`'s badge gains "Google yorumu"
  attribution text matching the design doc's literal `"· 120 Google yorumu"` format.

- [ ] **Step 1: `focusVenue` bypass + center priority — write the failing test**
```typescript
// venue-map-leaflet.spec.tsx (append)
describe("VenueMapCanvas — focusVenue bypasses the bbox fetch, wins over center, shows exactly one marker", () => {
  it("centers on focusVenue's coordinates even when a different center prop is also given, renders only that one marker, and never calls getVenuesInBbox", async () => {
    render(<VenueMapCanvas venues={[{ id: "v2", name: "Other", slug: "other", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: null, googleRatingCount: null }]} center={[41.0, 29.0]} focusVenue={{ id: "v1", name: "Cafe Test", lat: 40.99, lng: 29.02 }} />);
    expect(screen.getByTestId("map-container")).toHaveAttribute("data-center", "40.99,29.02");
    expect(screen.getAllByTestId("circle-marker")).toHaveLength(1);
    expect(getVenuesInBboxMock).not.toHaveBeenCalled();
  });
});
```
(Import and reference the mocked `getVenuesInBbox` from this file's `vi.mock("@/lib/api", ...)`
block set up in Task 4, Step 4 — extend that mock to export a named `getVenuesInBboxMock` you can
assert on.) Run — FAIL. Implement: add `focusVenue` as an optional prop; the effective center
becomes `focusVenue ? [focusVenue.lat, focusVenue.lng] : center`; when `focusVenue` is present,
skip mounting `BoundsVenueLoader` entirely and render a single `CircleMarker` at
`[focusVenue.lat, focusVenue.lng]` instead of the bbox-derived `locations` array. Thread
`focusVenue` through `VenueMap` down to `VenueMapCanvas`. Run — PASS.

- [ ] **Step 2: Write the failing test for address/map/photos in `venue-detail.tsx`**
```typescript
// venue-detail.spec.tsx (append)
describe("VenueDetail — address, single-marker map, photo grid (all net-new sections)", () => {
  const baseVenue = { /* existing fixture, extended with: */ address: "Bahariye Cd. No:1", lat: 40.99, lng: 29.02, photos: ["https://x/1.jpg", "https://x/2.jpg"] };

  it("renders the venue's address when present", () => {
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.getByText("Bahariye Cd. No:1")).toBeInTheDocument();
  });

  it("does not render an address section when address is null", () => {
    render(<VenueDetail venue={{ ...baseVenue, address: null }} />);
    expect(screen.queryByTestId("venue-address")).not.toBeInTheDocument();
  });

  it("renders the map focused on the venue's real coordinates", () => {
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.getByTestId("map-container")).toHaveAttribute("data-center", "40.99,29.02");
  });

  it("renders a photo grid when photos are present, using real <img> elements", () => {
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.getAllByRole("img", { name: new RegExp(baseVenue.name) })).toHaveLength(2);
  });

  it("renders an empty state when photos is empty", () => {
    render(<VenueDetail venue={{ ...baseVenue, photos: [] }} />);
    expect(screen.getByText(/henüz fotoğraf eklenmedi/i)).toBeInTheDocument();
  });
});
```
(This file's existing `vi.mock` setup for `react-leaflet`/`@/lib/api` from `venue-map-leaflet.spec.tsx`
must be replicated here too, or `VenueMap`/`VenueMapCanvas` mocked directly at the component level
— read how this spec file currently mocks its other child components, e.g. `FavoriteButton`,
`ReportForm`, and follow the same pattern for `VenueMap`.) Run — FAIL. Implement: conditionally
render `venue.address` (`data-testid="venue-address"`); add a new map section using
`<VenueMap venues={[]} center={[venue.lat, venue.lng]} focusVenue={{ id: venue.id, name: venue.name, lat: venue.lat, lng: venue.lng }} />`;
render a photo grid (`<img key={i} src={url} alt={`${venue.name} fotoğrafı ${i + 1}`} />` per
photo) when `venue.photos.length > 0`, else the empty-state text. Run — PASS.

- [ ] **Step 3: SSR-safe native share button — write the failing test (no `window.location` reassignment)**
```typescript
// native-share-button.spec.tsx (new)
describe("NativeShareButton", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });

  it("renders once mounted when navigator.share is a real function, and calls it with the venue name and the current URL on click", async () => {
    const shareMock = vi.fn();
    Object.defineProperty(navigator, "share", { value: shareMock, configurable: true });
    render(<NativeShareButton venue={{ name: "Cafe Test" }} />);
    await waitFor(() => expect(screen.getByTestId("native-share-button")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("native-share-button"));
    expect(shareMock).toHaveBeenCalledWith({ title: "Cafe Test", url: expect.any(String) });
  });

  it("never renders when navigator.share is undefined (checks typeof, not `in`)", async () => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    render(<NativeShareButton venue={{ name: "Cafe Test" }} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId("native-share-button")).not.toBeInTheDocument();
  });
});
```
Run — FAIL. Create `apps/web/src/components/native-share-button.tsx`, mirroring
`whatsapp-share-button.tsx`'s real structural pattern:
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
`venue-detail.tsx` (real location: inside the "Birlikte karar ver" section, line 134). Run — PASS.

- [ ] **Step 4: Google badge attribution text (C10) — matching the design doc's real literal format `"· 120 Google yorumu"`**
```typescript
// venue-card.spec.tsx (new -- this file does not exist yet)
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VenueCard } from "./venue-card";

const baseVenue = { id: "v1", name: "Cafe Test", slug: "cafe-test", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: 4.3, googleRatingCount: null };

describe("VenueCard — Google rating badge attribution text", () => {
  it("shows '4.3 · 120 Google yorumu' when a count is present", () => {
    render(<VenueCard venue={{ ...baseVenue, googleRatingCount: 120 }} />);
    expect(screen.getByText(/4\.3.*·\s*120 Google yorumu/)).toBeInTheDocument();
  });
  it("shows unlabeled 'Google yorumu' (no count) when googleRatingCount is null -- the only real 'no count' state, since the schema is .nullable() not .optional()", () => {
    render(<VenueCard venue={{ ...baseVenue, googleRatingCount: null }} />);
    expect(screen.getByText(/Google yorumu/)).toBeInTheDocument();
    expect(screen.queryByText(/\d+ Google yorumu/)).not.toBeInTheDocument();
  });
});
```
(Read `venue-card.tsx`'s other real props/rendering requirements first — this new spec file needs
whatever wrapper/context this component actually requires, e.g. a router mock if it renders a
`Link`; check the component's imports before assuming a bare `render()` works.) Run — FAIL. Update
the real existing badge markup (confirmed lines 68-78) to match the design doc's exact separator
format:
```tsx
{venue.googleRating !== null ? (
  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#201d18]/55">
    <svg viewBox="0 0 16 16" className="size-3.5 text-[#d75d3b]" aria-hidden="true">
      <path d="m8 1.4 1.7 4.1 4.4.4-3.4 2.9 1 4.3L8 10.8l-3.7 2.3 1-4.3-3.4-2.9 4.4-.4L8 1.4Z" fill="currentColor" />
    </svg>
    <span>{venue.googleRating.toFixed(1)}</span>
    <span className="font-medium text-[#201d18]/35">
      {venue.googleRatingCount !== null ? `· ${venue.googleRatingCount} ` : "· "}Google yorumu
    </span>
  </span>
) : (
  <span />
)}
```
Run — PASS.

- [ ] **Step 5:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 6: Commit**
```bash
git add apps/web/src/components/venue-map.tsx apps/web/src/components/venue-map-leaflet.tsx apps/web/src/components/venue-map-leaflet.spec.tsx apps/web/src/components/venue-detail.tsx apps/web/src/components/venue-detail.spec.tsx apps/web/src/components/venue-card.tsx apps/web/src/components/venue-card.spec.tsx apps/web/src/components/native-share-button.tsx apps/web/src/components/native-share-button.spec.tsx
git commit -m "feat(web): venue detail address/single-marker map (focusVenue bypass, wins over center)/photo grid + SSR-safe native share, venue-card Google badge attribution text matching design format"
```

---

## Task 7: Admin curation copy — fix the real stale artifact (a source comment, not the visible text)

**Files:**
- Modify: `apps/admin/src/components/queue-item.tsx` — read the file first; the real, confirmed
  current VISIBLE button text already says "yalnızca incelendi olarak işaretler" (does NOT claim
  to refresh `verified_at`); the stale `verified_at` claim survives only in a nearby source
  comment. Fix the comment; also make the visible text a bit more descriptive of the real Plan 4b
  A3 behavior (REPORT approval only marks the queue item reviewed, no `Venue`/`verified_at` write)
  as a secondary, non-urgent improvement.
- Test: this component's existing test file (locate it first — check both
  `apps/admin/src/components/queue-item.spec.tsx` and any co-located alternative)

**Interfaces:** Consumes nothing new. Produces an accurate source comment and (optionally)
slightly more descriptive visible copy — no behavior change.

- [ ] **Step 1:** Read the real current file and its nearby comment in full. Confirm the exact
      wording of both the comment and the visible button text before writing anything.
- [ ] **Step 2: Write the failing test** (only if the visible text is actually being changed —
      if the visible text is left as-is per the finding above, skip to Step 4, since there's no
      test-observable change; the comment fix alone has no test surface)
```typescript
describe("QueueItem — approve button copy accurately describes Plan 4b's A3 behavior", () => {
  it("does not claim verified_at is refreshed, and describes what approval actually does", () => {
    render(<QueueItem item={baseReportItem} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.queryByText(/verified_at.*yeniler/i)).not.toBeInTheDocument();
  });
});
```
- [ ] **Step 3:** Run — should already PASS against the real current visible text (confirmed
      correct per Step 1) — if it fails, the finding was wrong and needs re-verification before
      proceeding; do not "fix" a text that's already correct.
- [ ] **Step 4:** Fix the stale source comment near the button to match Plan 4b's real A3 behavior
      (REPORT approval only flips the queue item's own status; it does not write to `Venue` or
      touch `verifiedAt` — that requires a separate admin-venues API call or Prisma Studio edit).
- [ ] **Step 5:** Run: `cd apps/admin && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 6: Commit**
```bash
git add apps/admin/src/components/queue-item.tsx
git commit -m "docs(admin): fix stale verified_at claim in queue-item's source comment (Plan 4b A3) -- visible copy was already correct"
```

---

## Task 8: Accessibility — real loading-state visibility (C13) and real keyboard-accessible map markers (C14)

**Files:**
- Modify: `apps/web/src/app/favoriler/page.tsx` (real gap, confirmed line 26: `if (loading || !user) return null;`)
- Modify: `apps/admin/src/app/(protected)/layout.tsx` (real gap, confirmed line 42: `if (loading) return null;`)
- Modify: `apps/admin/src/app/(protected)/kuyruk/page.tsx` (real gap, confirmed line 90: `if (loading) return null;`)
- Modify: `apps/web/src/components/venue-map-leaflet.tsx` (real keyboard accessibility for `CircleMarker`, which — unlike Leaflet's `Marker` — has no native focus/keyboard-activation behavior)
- Test: each page's existing test file (or new, if none exists — check first), `apps/web/src/components/venue-map-leaflet.spec.tsx` (append)

**Interfaces:** Consumes nothing new. Produces: three `if (loading) return null` screens replaced
with a visible, accessible loading indicator (`role="status"`, visible text); each map marker's
underlying DOM element gains `tabindex="0"`, `role="button"`, `aria-label`, and a keydown handler
opening its popup on Enter/Space — real keyboard focus and activation, not just an `aria-label`.

- [ ] **Step 1: Write the failing test for `favoriler/page.tsx`'s loading state**
```typescript
describe("FavorilerPage — visible loading state instead of a silent blank screen", () => {
  it("renders a visible, accessible loading indicator while auth is loading, not null", () => {
    vi.mocked(useAuthMock).mockReturnValue({ user: null, session: null, loading: true });
    render(<FavorilerPage />);
    expect(screen.getByRole("status")).toHaveTextContent(/yükleniyor/i);
  });
});
```
Run — FAIL (current: `if (loading || !user) return null;` renders nothing while `loading`). Change
to only return `null` once `!loading && !user` (the imminent-redirect case), rendering a visible
`<p role="status" aria-live="polite">Yükleniyor…</p>` (or a richer loading skeleton, matching this
page's own existing skeleton pattern for its `lists === null` state) while `loading` is `true`.
Run — PASS.

- [ ] **Step 2: Write the failing test for `apps/admin/src/app/(protected)/layout.tsx`'s loading state**
```typescript
describe("ProtectedLayout — visible loading state instead of a silent blank screen", () => {
  it("renders a visible, accessible loading indicator while auth is loading", () => {
    vi.mocked(useAuthMock).mockReturnValue({ user: null, role: null, loading: true, error: null, signOut: vi.fn() });
    render(<ProtectedLayout><div /></ProtectedLayout>);
    expect(screen.getByRole("status")).toHaveTextContent(/yükleniyor/i);
  });
});
```
Run — FAIL (current: `if (loading) return null;` at line 42). Replace with a visible
`<p role="status" aria-live="polite">Yükleniyor…</p>`. Run — PASS. (Leave the subsequent
`if (!user || !role) return null;` at line 59 as-is — that's an imminent-redirect frame, not the
silent-loading problem C13 targets.)

- [ ] **Step 3: Write the failing test for `apps/admin/src/app/(protected)/kuyruk/page.tsx`'s loading state**
Same pattern as Step 2, targeting the real `if (loading) return null;` at line 90. Run — FAIL, fix,
run — PASS.

- [ ] **Step 4: Write the failing test for real keyboard-accessible map markers (C14)**
```typescript
// venue-map-leaflet.spec.tsx (append)
describe("VenueMapCanvas — real keyboard accessibility for markers (C14)", () => {
  it("gives each marker's underlying element a tabindex, role, aria-label, and opens its popup on Enter/Space", async () => {
    const openPopupMock = vi.fn();
    // extend this file's react-leaflet mock's CircleMarker to simulate Leaflet's `eventHandlers.add`
    // callback firing with a mock layer exposing getElement()/openPopup(), and to render the
    // resulting DOM attributes for assertion -- read Step 4 of Task 4 for this file's existing mock
    // shape and extend it consistently rather than replacing it.
    render(<VenueMapCanvas venues={[{ id: "v1", name: "Cafe Test", slug: "cafe-test", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: null, googleRatingCount: null }]} center={[40.99, 29.02]} />);
    await waitFor(() => {
      const marker = screen.getByRole("button", { name: "Cafe Test" });
      expect(marker).toHaveAttribute("tabindex", "0");
      fireEvent.keyDown(marker, { key: "Enter" });
    });
    expect(openPopupMock).toHaveBeenCalled();
  });
});
```
Run — FAIL. Implement via `CircleMarker`'s `eventHandlers`, which real Leaflet calls with the
underlying layer instance on `add`:
```tsx
<CircleMarker
  key={venue.id}
  center={[venue.lat, venue.lng]}
  radius={9}
  pathOptions={{ /* unchanged */ }}
  eventHandlers={{
    add: (e) => {
      const layer = e.target;
      const el = layer.getElement?.();
      if (!el) return;
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", venue.name);
      el.addEventListener("keydown", (evt: KeyboardEvent) => {
        if (evt.key === "Enter" || evt.key === " ") {
          evt.preventDefault();
          layer.openPopup();
        }
      });
    },
  }}
>
```
Run — PASS.

- [ ] **Step 5:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit` and
      `cd apps/admin && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 6: Commit**
```bash
git add apps/web/src/app/favoriler/page.tsx apps/admin/src/app/\(protected\)/layout.tsx apps/admin/src/app/\(protected\)/kuyruk/page.tsx apps/web/src/components/venue-map-leaflet.tsx apps/web/src/components/venue-map-leaflet.spec.tsx
git commit -m "fix(web,admin): replace three silent loading=>null screens with visible accessible indicators (C13), real keyboard focus/activation for map markers (C14)"
```

---

## Task 9: Favorites collection creation (C5), open-now filter UI (C7), boutique toggle fix (Plan 4b schema)

**Files:**
- Modify: `apps/web/src/app/favoriler/page.tsx` (already a Client Component; already renders every
  list as its own card — only a create-list form is missing)
- Modify: `apps/web/src/components/venue-filters.tsx` (real boutique bug, confirmed line 145:
  `onClick={() => update({ isBoutique: !filters.isBoutique })}`; new `openNow` toggle UI —
  `serializeFilters`/`FilterState` already updated in Task 1)
- Test: `apps/web/src/app/favoriler/page.spec.tsx` (new, or wherever this page's test lives — check
  first), `apps/web/src/components/venue-filters.spec.tsx` (append)

**Interfaces:**
- Consumes: the real `createFavoriteList(token: string, name: string): Promise<FavoriteList>`
  (confirmed — `token` first); Task 1's `serializeFilters`'s `openNow` handling.
- Produces: a "create new list" form appending to the existing `lists` state; an `openNow` toggle;
  `serializeFilters`'s boutique output only ever emits `"true"`, never `"false"`.

- [ ] **Step 1: Write the failing test for the boutique toggle fix**
```typescript
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
Run — FAIL (current: `!filters.isBoutique`). Change to `filters.isBoutique ? undefined : true`.
Run — PASS.

- [ ] **Step 2: Write the failing test for the `openNow` toggle UI**
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
Run — FAIL. Add a toggle button matching the boutique toggle's pattern, label "Şimdi açık",
`data-testid="filter-open-now"`. Run — PASS.

- [ ] **Step 3: Write the failing test for creating a list, using the real `createFavoriteList(token, name)` signature**
```typescript
describe("Favoriler page — create a new list", () => {
  it("submits a new list name via createFavoriteList(token, name) and shows it as a new card once appended", async () => {
    createFavoriteListMock.mockResolvedValue({ id: "l2", name: "Kadıköy Kahveleri", favorites: [] });
    render(<FavorilerPage />);
    await waitFor(() => screen.getByTestId("favoriler-page"));
    fireEvent.change(screen.getByLabelText(/liste adı/i), { target: { value: "Kadıköy Kahveleri" } });
    fireEvent.click(screen.getByRole("button", { name: /oluştur/i }));
    await waitFor(() => expect(createFavoriteListMock).toHaveBeenCalledWith(expect.any(String), "Kadıköy Kahveleri"));
    expect(await screen.findByText("Kadıköy Kahveleri")).toBeInTheDocument();
  });
});
```
Run — FAIL. Add a name input + submit button calling
`createFavoriteList(session.access_token, name)`, appending the result to `lists` on success
(`setLists((prev) => [...(prev ?? []), created])`) — the existing per-list `<article>` grid
rendering already handles displaying it. Run — PASS.

- [ ] **Step 4:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 5: Commit**
```bash
git add apps/web/src/app/favoriler apps/web/src/components/venue-filters.tsx apps/web/src/components/venue-filters.spec.tsx
git commit -m "feat(web): favorites list creation via real createFavoriteList(token, name), open-now filter toggle, fix boutique toggle for Plan 4b's OptionalTrueFlag schema"
```

---

## Task 10: Code-quality cleanup — category labels consolidation

**Files:**
- Create: `apps/web/src/lib/category-labels.ts`
- Modify: `apps/web/src/components/venue-card.tsx` (source of the canonical 4-entry map, confirmed
  real: `{ cafe: "Kahve", restaurant: "Restoran", bakery: "Fırın", "street-food": "Sokak lezzeti" }`),
  `venue-detail.tsx` (deletes its real, confirmed stale 7-entry local map including non-taxonomy
  keys `kahvalti`/`kahve`/`tatli`), `category-quick-route.tsx` (already imports from `venue-card.tsx`
  — switches import source to the new shared file)
- Test: `apps/web/src/lib/category-labels.spec.ts` (new)

- [ ] **Step 1: Write the failing test**
```typescript
import { describe, it, expect } from "vitest";
import { CATEGORY_LABELS } from "./category-labels";

describe("CATEGORY_LABELS", () => {
  it("only contains the real backend taxonomy (no stale kahvalti/kahve/tatli entries)", () => {
    expect(CATEGORY_LABELS).toEqual({ cafe: "Kahve", restaurant: "Restoran", bakery: "Fırın", "street-food": "Sokak lezzeti" });
  });
});
```
- [ ] **Step 2:** Run — FAIL. Create `apps/web/src/lib/category-labels.ts` with the exact 4-entry
      map. Update `venue-card.tsx` to import it instead of defining it locally. Delete
      `venue-detail.tsx`'s stale local map, importing from the new shared file. Update
      `category-quick-route.tsx`'s import source.
- [ ] **Step 3:** Run — PASS. Run every affected component's existing tests.
- [ ] **Step 4:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 5: Commit**
```bash
git add apps/web/src/lib/category-labels.ts apps/web/src/lib/category-labels.spec.ts apps/web/src/components/venue-card.tsx apps/web/src/components/venue-detail.tsx apps/web/src/components/category-quick-route.tsx
git commit -m "refactor(web): consolidate category labels into one shared lib/category-labels.ts, drop stale non-taxonomy keys"
```

---

## Task 11: Final regression and manual smoke verification

**Files:**
- Modify: `docs/STATE.md`
- Modify: `docs/SESSION-LOG-2026-07-26.md`

- [ ] **Step 1:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`
- [ ] **Step 2:** Run: `cd apps/admin && npx vitest run && npx tsc --noEmit`
- [ ] **Step 3:** Run: `cd packages/api-client && npx vitest run`
- [ ] **Step 4:** Run: `pnpm exec turbo run typecheck lint --filter=@gurmego/web... --filter=@gurmego/admin... --filter=@gurmego/api-client...`
- [ ] **Step 5: Manual verification (NOT an automated gate)** — start both the API and the web app
      (`cd apps/web && pnpm run dev`), then in a real browser:
      1. Visit each of the three district pages, switch to map view, confirm the map opens
         centered correctly for each, and navigating between districts (client-side link, not a
         hard reload) actually re-centers the map AND resets the venue list/filters (the
         `key={current.id}` fix from Task 3).
      2. Grant location permission, confirm the venue list auto-sorts to distance exactly once and
         the category quick-route buttons show "En yakın ... git" links only once a coords-driven
         fetch has actually succeeded (not merely once permission is granted).
      3. Deny location permission, confirm manual district browsing still works fully.
      4. Open a venue detail page, confirm address/single-marker map/photos (or empty state)
         render, and the native share button appears only where supported.
      5. Tab through the map's markers with a keyboard, confirm each is focusable and Enter/Space
         opens its popup (C14).
      6. In the favorites page, create a new list, confirm it appears as an additional card.
      7. In the admin panel, confirm the loading transition before the queue/dashboard renders is
         visibly announced, not a blank flash (C13).
- [ ] **Step 6:** Update `docs/STATE.md` and `docs/SESSION-LOG-2026-07-26.md`: Plan 4c complete,
      ready for the final whole-branch review (Superpowers reviewer + mandatory `cross-model-review`).
- [ ] **Step 7: Commit**
```bash
git add docs/STATE.md docs/SESSION-LOG-2026-07-26.md
git commit -m "docs: Plan 4c complete, ready for final whole-branch review"
```

---

## Self-Review Notes (round 5, after round 4's ground-truth-verification YENİDEN BÖL)

- **`serializeFilters`'s real `out.lat`/`out.lng` lines (confirmed by direct read this round,
  contradicting round 4's own claim) are now genuinely removed in Task 1**, with the pre-existing
  test that expected them updated rather than silently orphaned.
- **C13's three real silent `loading => null` screens** (`favoriler/page.tsx`, admin
  `layout.tsx`, admin `kuyruk/page.tsx`, all confirmed by direct read) **are now the actual Task 8
  target**, not a new loading message somewhere the audit never pointed at.
- **C14 now implements real keyboard focus and Enter/Space activation** via `CircleMarker`'s
  `eventHandlers.add`, not just a decorative `aria-label`.
- **Task 7 (admin copy) now targets the real stale artifact** — a source comment, confirmed by
  direct read to be the only place the false `verified_at` claim survives, since the visible
  button text was already fixed.
- **The former Task 4 is now three self-contained vertical slices** (Task 3: location/request
  state, Task 4: map centering, Task 5: category quick-route), each producing and consuming its
  own new props within itself, ordered so later slices only ADD props to an already-stable
  component rather than re-touching shared internals — closing round 4's "still too big, still has
  an internal producer/consumer gap" finding.
- **`key={current.id}` is added at `DiscoveryClient`'s OWN call site** (Task 3), not just at
  `VenueMap`'s — closing round 4's finding that only the map was remounting on district change
  while `venues`/`filters`/refs persisted stale in the same component instance.
- **`focusVenue` now has documented, tested priority over `center`** (Task 6), closing round 4's
  "undefined precedence" finding.
- **`packages/api-client` gets a minimal Vitest setup in Task 1**, since it had none.
- **`venue-map-leaflet.spec.tsx`/`venue-card.spec.tsx` are created fresh**, not "appended to" — both
  are confirmed absent from the repo today.
- **The remount/`focusVenue`/`sortedByDistance` tests use full, real `VenueListItem`-shaped
  fixtures** (`slug`/`category`/`priceRange`/`isBoutique`/`editorialNote`/`googleRating`/
  `googleRatingCount`), not incomplete `{id,name}` shapes that wouldn't typecheck.
- **The native-share test no longer reassigns `window.location`** — it asserts the `navigator.share`
  payload shape without touching jsdom's location object at all.
- **`AuthForm`'s real `signIn`/`signUp` return `{ error: string | null }`** — Task 3 (error
  handling)'s test mocks resolve that shape, not `void`.
- A pre-flight baseline step (Task 1, Step 0) catches any other pre-existing fixture drift against
  Plan 4b's schema before this plan's own test gates run, so a later "whole suite" gate failure is
  never conflated between this plan's own regressions and unrelated prior drift.
