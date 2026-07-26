# GurmeGo — Plan 4c: Frontend/Admin Kritik Düzeltmeler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every frontend/admin finding from `docs/AUDIT-2026-07-26.md` (C1-C14), per
`docs/superpowers/specs/2026-07-26-frontend-fixes-design.md` (HAZIR after 5 idea-red-team rounds).

**C-item → task index (verified against this round's finding that C1/C11/C12 had been silently
dropped during a prior renumbering — every one of the 14 items is now explicitly listed here and
must map to exactly one task below before this plan is considered complete):**

| Item | Task | Item | Task |
|---|---|---|---|
| C1 (auth-context getSession failure) | Task 3 | C8 (location-based sort actually works) | Task 4 |
| C2 (discovery loading/error/race) | Task 4 | C9 (native share button) | Task 8 |
| C3 (map center per district) | Task 5 | C10 (Google badge attribution) | Task 9 |
| C4 (venue detail address/map/photos) | Task 7 | C11 (favorite-button real state) | Task 3 |
| C5 (favorites collection creation) | Task 13 | C12 (auth-form submitting state) | Task 3 |
| C6 (category quick-route deep link) | Task 6 | C13 (silent loading screens) | Task 11 |
| C7 (open-now filter) | Task 14 | C14 (keyboard-accessible map markers) | Task 12 |

## Rounds 1-4 plan-red-team (Codex, YENİDEN BÖL four times) — uygulandı

Round 1/2: task-contract contradictions (a producer task and a consumer task both claiming the
same file, or a task consuming a prop no task had defined yet) — fixed by merging producer+consumer
into one atomic task each time the pattern recurred. Round 3: the plan was written against
imagined interfaces (a `VenueMapLeaflet` taking a marker array, `createList(name,token)`, a
favorites tab-switcher, `VenueFilters`'s prop called `filters`, `AuthForm`'s mode as `"sign-in"`,
an unreachable `undefined` case for a `.nullable()` field) — fixed via a dedicated ground-truth
read of the real files. Round 4: even that ground-truth pass had missed real facts verifiable by a
direct grep (`serializeFilters` DOES emit `lat`/`lng`; C13's real targets are three specific
silent `loading => null` screens; C14 needs real keyboard behavior, not just an `aria-label`; the
admin approve button's stale claim survives only in a comment, not the visible text) — fixed by
re-verifying every real signature via direct reads/greps before writing this round.

## Round 5 plan-red-team (Codex, YENİDEN BÖL) — a whole task's scope was silently dropped

Splitting the old merged "discovery/map/quick-route" task into three ordered vertical slices (to
fix round 4's remaining internal producer/consumer gap) required renumbering every task after it —
and in that renumbering, **the entire error-handling task (C1: `auth-context.tsx`'s `getSession()`
failure, C11: `favorite-button.tsx`'s real state check, C12: `auth-form.tsx`'s submitting state)
was silently omitted from the plan**, not merely reordered. This is the single most serious defect
found across all five rounds: three real audit findings had no owning task at all, and nothing in
the plan's own structure would have caught the gap (no task list cross-check existed). Additional,
smaller findings, all confirmed by direct file reads this round:

1. **The Task 1 code example doesn't match the real `api.spec.ts`/`api.ts` test architecture.**
   There is no exported `client` to `vi.spyOn(...)` — the real pattern (confirmed) is
   `vi.hoisted(() => ({ mockGet: vi.fn(), mockPost: vi.fn() }))` + `vi.mock("@gurmego/api-client", () => ({ createApiClient: () => ({ get: mockGet, post: mockPost }) }))`.
2. **The proposed `fetchValidated` body silently changed `ApiValidationError`'s real, confirmed
   two-argument constructor** (`new ApiValidationError(path, result.error.issues)`) to a
   single-argument call — a real regression the plan itself would have introduced.
3. **The proposed `DistrictSchema` test fixture is invalid** — the real schema requires a `cityId`
   field and real UUIDs (confirmed via the existing `VALID_DISTRICT` fixture in `api.spec.ts`).
4. Adding a Vitest dependency to `packages/api-client` changes the root `pnpm-lock.yaml`, which
   Task 1's file list didn't mention. The real monorepo Vitest version is `^1.6.0`, not the plan's
   placeholder `^2.1.0`.
5. **`venue-detail.tsx` already has a decorative, non-map "directions" section** (a CSS-pattern
   background + `directionsUrl` link, confirmed at its real location) — the new map section this
   plan adds is a SEPARATE, ADDITIONAL section, not a replacement of that existing block (the
   round-5 draft wrongly implied no placeholder existed at all).
6. Task 1 (header propagation) and the former combined "venue detail" task were each still too
   large/mixed multiple independently-reviewable concerns — split further below.
7. `sortedByDistance`'s state is produced in the location/request-state slice but had no consumer
   until the quick-route slice — its own task's tests couldn't observably prove the state was
   correct (dead state until consumed). Its externally-observable proof now lives in the task that
   actually renders it.
8. The C14 (keyboard-accessible markers) test used a bbox mock returning `[]`, which — given the
   real `BoundsVenueLoader` only renders markers from bbox results, not the `venues` prop directly
   — means no marker would ever exist to test keyboard behavior against, regardless of the fix.
9. Several other test-realism bugs: the admin kuyruk page's loading state is its OWN `getQueue()`
   request, not auth loading; the admin layout's real test file uses `vi.doMock` + dynamic import,
   not a directly-mocked `useAuth`; `getByRole("status", { name: ... })` is unreliable — use
   `getByRole("status")` then `toHaveTextContent`; the favorites list-creation fixture needs
   `userId`/`createdAt` to match the real `FavoriteList` shape.

**All of the above are fixed in this revision.** The C-item table above is the concrete mechanism
preventing a repeat of finding zero (a dropped task surviving unnoticed) — every task list change
from here on must be checked against it before committing.

**Architecture:** Unchanged from round 5 — header propagation through `packages/api-client` →
`apps/web/src/lib/api.ts`, a `LocationProvider` context, real per-district map centering, a
`focusVenue` bypass for the venue-detail single-marker case.

**Tech Stack:** Next.js (App Router), React, Vitest (`^1.6.0`, matching the real monorepo version —
confirmed by reading `apps/web/package.json`) + `@testing-library/react`.

## Global Constraints

- Clients (`apps/web`, `apps/admin`) contain no business logic — display + request layer only.
- `X-User-Location` header format: `"<lat>,<lng>"` — identical to Plan 4b's `UserLocationHeaderSchema`.
- Without location permission/on denial, manual district selection must keep full functionality.
- This plan depends on Plan 4b being complete.
- Follow this codebase's existing test convention EXACTLY, confirmed by direct read, not assumed:
  Vitest, `@testing-library/react`, co-located `ComponentName.spec.tsx`, the REAL
  `vi.hoisted()` + `vi.mock("@gurmego/api-client", ...)` pattern for anything touching `api.ts`.
- **A signature/prop-contract change is only complete in the same task as every one of its direct
  consumers.**
- **Every task's "Files"/"Interfaces" section states the REAL current signature it changes FROM,
  confirmed by directly reading the file in THIS session** — a "ground-truth pass" from an earlier
  session or an earlier round of this same plan is not sufficient; verify again if in doubt.
- **Before finalizing any task-list restructuring, re-check every C-item in the table above still
  maps to a task.** This is the specific, mechanical safeguard against round 5's dropped-task defect.

---

## Task 1: API client header propagation (atomic — signature change + every direct caller, matching the REAL test architecture)

**Files:**
- Modify: `packages/api-client/src/index.ts`, `packages/api-client/package.json` (add Vitest
  `^1.6.0`, matching the real monorepo version — confirm by reading `apps/web/package.json`'s
  devDependency first), a minimal `vitest.config.ts` if needed
- Modify: `pnpm-lock.yaml` (regenerated by `pnpm install` after the `package.json` change — commit
  it alongside; do not hand-edit it)
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/components/venue-filters.tsx` (`serializeFilters` — REMOVES the real
  existing `out.lat`/`out.lng` lines at 25-26; does NOT touch `openNow` — that's Task 14's job, not
  this one, to keep this already-large task from growing further)
- Modify: `apps/web/src/components/discovery-client.tsx` (only the `getVenues` call site, real
  current line: `const { data } = await getVenues({ districtId, ...serializeFilters(next, coords) });`)
- Modify: `apps/web/src/components/district-picker.tsx` (only its `getNearestDistrict` call site)
- Modify: `apps/web/src/components/venue-detail.spec.tsx` (Step 0's pre-flight fixture fix, if this
  file's own fixtures are also found to be missing `lat`/`lng`/`address`/`photos` — check when
  running Step 0, list here explicitly rather than leaving it as an unlisted side effect)
- Test: `packages/api-client/src/index.spec.ts` (new), `apps/web/src/lib/api.spec.ts` (append —
  using the REAL existing `mockGet`/`mockPost`/`vi.hoisted()` pattern, not a `client` spy),
  `apps/web/src/components/venue-filters.spec.tsx` (append), `apps/web/src/components/discovery-client.spec.tsx` (append — one call-site test only), `apps/web/src/components/district-picker.spec.tsx` (new — confirmed this file does not exist in the repo today, create it, don't "append")

**Interfaces:**
- Consumes: nothing new
- Produces: `createApiClient(...).get<T>(path, options?: { headers?: Record<string,string> })`;
  `fetchValidated(path, schema, token?, headers?)` (preserving the real, confirmed
  `throw new ApiValidationError(path, result.error.issues)` — TWO arguments, not one);
  `locationHeaders(coords?: Coords | null)`; `getVenues(query, coords?: Coords | null)`;
  `getNearestDistrict(coords: Coords)` (was `(lat, lng)`); `serializeFilters` no longer emits
  `lat`/`lng` (unrelated to `openNow`, which this task does not touch).

- [ ] **Step 0: Pre-flight baseline check**
Run `cd apps/web && npx vitest run && npx tsc --noEmit`. The real `api.spec.ts`'s
`VALID_VENUE_DETAIL` fixture (confirmed by reading the file) is MISSING `lat`/`lng`/`address`/
`photos` — fields Plan 4b's real `VenueDetailSchema` requires (confirmed: `lat: z.number()`, no
`.optional()`). This is pre-existing drift, not something this plan introduces. Fix ONLY this
fixture (add valid `lat`/`lng`/`address`/`photos` values matching the schema) as part of this
step, and check for the same drift in `venue-detail.spec.tsx`'s own fixtures. Do not fold any other
feature work into this step.

- [ ] **Step 1: Add Vitest to `packages/api-client`, matching the real monorepo version**
Read `apps/web/package.json`'s Vitest devDependency version first (confirmed elsewhere in this
round to be `^1.6.0` — verify directly, do not trust this plan's own memory of that number).
```json
// packages/api-client/package.json
"scripts": {
  "generate": "openapi-typescript ../../apps/api/openapi.json -o src/generated-types.ts",
  "typecheck": "tsc --noEmit",
  "test": "vitest run"
},
"devDependencies": {
  "openapi-typescript": "^6.7.6",
  "typescript": "^5.9.3",
  "vitest": "<the real version confirmed above>"
}
```
Run `pnpm install` from the repo root (this regenerates `pnpm-lock.yaml` — include it in this
task's commit).

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

- [ ] **Step 6: Write the failing test for `locationHeaders` and `getVenues`/`getNearestDistrict`'s new signatures — using the REAL `mockGet`/`vi.hoisted()` pattern**
```typescript
// apps/web/src/lib/api.spec.ts (append -- this file ALREADY has the vi.hoisted()/mockGet setup
// shown at its own top; add to the SAME beforeEach/mock block, don't create a second one)
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
    mockGet.mockResolvedValueOnce({ data: [], meta: { next_cursor: null, has_more: false } });
    await getVenues({ districtId: "d1" }, { lat: 40.99, lng: 29.02 });
    expect(mockGet.mock.calls[0][1]).toEqual({ headers: { "X-User-Location": "40.99,29.02" } });
  });

  it("sends no location header when coords is omitted", async () => {
    mockGet.mockResolvedValueOnce({ data: [], meta: { next_cursor: null, has_more: false } });
    await getVenues({ districtId: "d1" });
    expect(mockGet.mock.calls[0][1]).toEqual({ headers: {} });
  });
});

describe("getNearestDistrict — now takes one coords object instead of two number arguments", () => {
  it("sends the exact X-User-Location header, no lat/lng query params", async () => {
    mockGet.mockResolvedValueOnce(VALID_DISTRICT); // reuse this file's existing real fixture (id/cityId/name/slug), do not invent a new one
    await getNearestDistrict({ lat: 40.99, lng: 29.02 });
    const [pathArg, optionsArg] = mockGet.mock.calls[0];
    expect(pathArg).toBe("/districts/nearest");
    expect(optionsArg).toEqual({ headers: { "X-User-Location": "40.99,29.02" } });
  });
});
```
- [ ] **Step 7:** Run — FAIL.
- [ ] **Step 8: Implement in `apps/web/src/lib/api.ts`, preserving the real `ApiValidationError(path, issues)` two-argument contract**
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
  if (!result.success) throw new ApiValidationError(path, result.error.issues); // UNCHANGED two-arg call -- do not collapse to one argument
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
(Every OTHER call to `fetchValidated` in this file — `getVenueBySlug`, `getDistricts`,
`getFavoriteLists` — is unchanged; only its own signature grows a 4th optional parameter, which
defaults to `undefined` and therefore doesn't affect any existing call.) Import `Coords` from
`./use-geolocation`. Run — PASS.

- [ ] **Step 9: `serializeFilters` — remove the REAL existing `out.lat`/`out.lng` lines (does NOT touch `openNow`)**
Read the real current function:
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
New version (`openNow` is added by Task 14, not here):
```typescript
export function serializeFilters(filters: FilterState, coords?: Coords | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.category) out.category = filters.category;
  if (filters.priceRange) out.priceRange = filters.priceRange;
  if (filters.isBoutique !== undefined) out.isBoutique = String(filters.isBoutique);
  if (filters.radiusM !== undefined && coords) out.radiusM = String(filters.radiusM);
  return out;
}
```
Find and update the EXISTING test in `venue-filters.spec.tsx` that currently asserts `lat`/`lng`
ARE present (it must exist, since the current code emits them) — invert its expectation:
```typescript
it("never includes lat/lng, even when coords and radiusM are both present", () => {
  const out = serializeFilters({ radiusM: 2000 }, { lat: 40.99, lng: 29.02 });
  expect(out).toEqual({ radiusM: "2000" });
});
```
Run — FAIL (the updated assertion fails against the still-unmodified function), apply the code
change, run — PASS.

- [ ] **Step 10: Update `discovery-client.tsx`'s ONE `getVenues` call site**, adding `coords` as
      the second argument. Write the failing test asserting the exact coords value, confirm fail,
      fix, confirm pass. **Also read the EXISTING `discovery-client.spec.tsx` in full and update
      every existing assertion that currently expects `getVenuesMock` to have been called with only
      ONE argument** (round-6 finding: adding a required second parameter to a call this file
      already tests against breaks those pre-existing one-argument expectations unless they're
      explicitly widened to two here, in the same step that introduces the second argument).
- [ ] **Step 11: Update `district-picker.tsx`'s ONE `getNearestDistrict` call site** — read the
      file first for its exact current call, change to the single `coords` object. Write the
      failing test, confirm fail, fix, confirm pass. **Also update `api.spec.ts`'s own two existing
      `getNearestDistrict` tests** (confirmed real calls: `getNearestDistrict(40.99, 29.03)` at two
      places in its `describe("getNearestDistrict", ...)` block) **from the two-number-argument
      form to `getNearestDistrict({ lat: 40.99, lng: 29.03 })`, in this same step** — they currently
      test the OLD signature this step replaces.
- [ ] **Step 12:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit` and
      `cd packages/api-client && npx vitest run`.
- [ ] **Step 13: Commit**
```bash
git add packages/api-client pnpm-lock.yaml apps/web/src/lib/api.ts apps/web/src/lib/api.spec.ts apps/web/src/components/venue-filters.tsx apps/web/src/components/venue-filters.spec.tsx apps/web/src/components/discovery-client.tsx apps/web/src/components/discovery-client.spec.tsx apps/web/src/components/district-picker.tsx apps/web/src/components/district-picker.spec.tsx apps/web/src/components/venue-detail.spec.tsx
git commit -m "feat(web): add coords parameter + X-User-Location header to getVenues/getNearestDistrict, remove lat/lng from serializeFilters, add Vitest to api-client"
```

---

## Task 2: `LocationProvider` — single shared coordinate source (provider only — `DiscoveryClient`'s migration is Task 4's job)

**Files:**
- Create: `apps/web/src/lib/location-context.tsx`
- Modify: `apps/web/src/app/[district]/page.tsx` (wrap `DistrictPicker` + `DiscoveryClient`)
- Modify: `apps/web/src/components/district-picker.tsx`
- Test: `apps/web/src/lib/location-context.spec.tsx` (new), `apps/web/src/components/district-picker.spec.tsx` (append — Task 1 creates this file first; by the time this task runs, it already exists)

**Interfaces:**
- Consumes: `useGeolocation(): Coords | null`
- Produces: `LocationProvider`, `useLocationContext(): Coords | null`.

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
- [ ] **Step 2:** Run — FAIL. Create `apps/web/src/lib/location-context.tsx`:
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
Wrap `<DistrictPicker>` + `<DiscoveryClient>` in `<LocationProvider>`. Migrate
`district-picker.tsx`'s own `useGeolocation()` call to `useLocationContext()`. Write the failing
test:
```typescript
import * as geolocationModule from "@/lib/use-geolocation";

it("does not call useGeolocation directly -- reads coords from LocationProvider's context instead", () => {
  const spy = vi.spyOn(geolocationModule, "useGeolocation");
  render(<LocationProvider><DistrictPicker districts={[]} current="kadikoy" /></LocationProvider>);
  expect(spy).toHaveBeenCalledTimes(1);
});
```
Confirm fail, migrate, confirm pass.

- [ ] **Step 5:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 6: Commit**
```bash
git add apps/web/src/lib/location-context.tsx apps/web/src/lib/location-context.spec.tsx apps/web/src/app/\[district\]/page.tsx apps/web/src/components/district-picker.tsx apps/web/src/components/district-picker.spec.tsx
git commit -m "feat(web): LocationProvider -- shared geolocation source, migrate district-picker"
```

---

## Task 3: Error handling fixes (C1, C11, C12) — RESTORED after round 5 silently dropped this entire task

**Files:**
- Modify: `apps/web/src/lib/auth-context.tsx` (C1 — real current: `useEffect` calling
  `supabase.auth.getSession()` with no `.catch()`, confirmed)
- Modify: `apps/web/src/components/favorite-button.tsx` (C11 — real current: no mount-time real
  state check, no disabled-while-pending, confirmed)
- Modify: `apps/web/src/components/auth-form.tsx` (C12 — real current: no `submitting` state,
  confirmed; real `signIn`/`signUp` resolve `{ error: string | null }`, destructured as
  `const { error } = await fn(email, password);` — mocks in the new test below must resolve that
  exact shape, not `void`)
- Test: `apps/web/src/lib/auth-context.spec.tsx` (append), `apps/web/src/components/favorite-button.spec.tsx` (append), `apps/web/src/components/auth-form.spec.tsx` (append)

**Interfaces:**
- Consumes: `auth-context.tsx`'s real `useAuth()` shape (`loading: boolean`, among others)
- Produces: `auth-context.tsx` settles `loading` to `false` even when `getSession()` rejects;
  `FavoriteButton` checks real favorite state on mount and disables itself mid-toggle-request;
  `AuthForm` disables its submit button while a request is in flight.

- [ ] **Step 1 (C1): Write the failing test using the real `loading` field**
```typescript
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
Run — FAIL (confirm `.catch()` is genuinely absent by reading the file first — this test also
fails today via an unhandled promise rejection under Vitest). Add
`.catch(() => setLoading(false))` (matching the real state-setter's name) to the `getSession()`
chain. Run — PASS.

- [ ] **Step 2 (C11): Write the failing test — round-7 finding: the real `FavoriteButton` has no
      "toggle" concept at all (confirmed by reading the file in full). It only ADDS: `handleClick`
      calls `getFavoriteLists(token)`, uses `lists[0]` or calls `createFavoriteList` if none exist,
      then `addFavoriteVenue(token, listId, venueId)`, then `setAdded(true)`. There is no
      `toggleFavorite` function anywhere in this codebase — do not invent one. The real mock
      harness (confirmed in the existing `favorite-button.spec.tsx`) already exposes
      `getFavoriteLists`, `createFavoriteList`, `addFavoriteVenue` as individually-mockable
      functions via one `vi.mock("@/lib/api", ...)` block — reuse that exact harness, don't add a
      new one.**
```typescript
describe("FavoriteButton — real mount-time state check and disabled-while-pending", () => {
  it("reflects the venue's real favorite status from GET /me/lists on mount (no click needed)", async () => {
    getFavoriteLists.mockResolvedValue([{
      id: "l1", name: "Default",
      favorites: [{ id: "f1", venueId: "v1", venue: { id: "v1", name: "X", slug: "x", category: "cafe", priceRange: "BUDGET", isBoutique: false } }],
    }]);
    render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByTestId("favorite-button")).toHaveAttribute("aria-pressed", "true"));
  });

  it("disables itself while the add flow (getFavoriteLists -> createFavoriteList/addFavoriteVenue) is in flight", async () => {
    getFavoriteLists.mockResolvedValue([{ id: "l1", name: "Default", favorites: [] }]);
    let resolveAdd: () => void;
    addFavoriteVenue.mockReturnValue(new Promise<void>((resolve) => { resolveAdd = resolve; }));
    render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled()); // mount-time check resolved
    fireEvent.click(screen.getByTestId("favorite-button"));
    expect(screen.getByTestId("favorite-button")).toBeDisabled();
    resolveAdd!();
    await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled());
  });
});
```
Run — FAIL. Add a mount-time `useEffect` (only if `useAuth().user` is truthy) that calls
`getFavoriteLists(session.access_token)` and sets `added` to `true` if any returned list's
`favorites` array contains an entry whose `venueId === venueId` — the button is disabled until
this initial check resolves too (a separate `initialCheckPending` state, distinct from the
existing `added` state). Add a `pending` state set `true` at the start of `handleClick`, `false` in
a `finally`, with `disabled={pending || initialCheckPending}` on the button.

**Update the two EXISTING tests in `favorite-button.spec.tsx` in the SAME step** (round-6/7
finding: they click immediately after `render()`, and their fixtures — confirmed by reading the
file — have no `favorites` field at all, e.g. `getFavoriteLists.mockResolvedValue([{ id: "existing", name: "Denenecekler" }])`
— the new mount-time check would crash calling `.some()` on an undefined `favorites`):
- Add `favorites: []` to both existing fixture objects (`{ id: "list1", name: "Favorilerim" }` →
  add `favorites: []`; `{ id: "existing", name: "Denenecekler" }` → add `favorites: []`).
- Add `await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled());`
  immediately after `render(...)` and before `fireEvent.click(...)` in both tests, so the click
  doesn't race the new mount-time check.
Run — PASS.

- [ ] **Step 3 (C12): Write the failing test with the real `mode="signin"` value, real field labels, and the real `{ error }` resolution shape**
```typescript
describe("AuthForm — disabled while submitting", () => {
  it("disables the submit button until the request resolves", async () => {
    let resolveSignIn: (v: { error: string | null }) => void;
    signInMock.mockReturnValue(new Promise((resolve) => { resolveSignIn = resolve; }));
    render(<AuthForm mode="signin" />);
    fireEvent.change(screen.getByLabelText("E-posta"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText("Şifre"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Giriş yap" }));
    expect(screen.getByRole("button", { name: "Giriş yap" })).toBeDisabled();
    resolveSignIn!({ error: null });
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

## Task 4: Discovery location/request-state slice (C2, C8) — atomic

**Files:**
- Modify: `apps/web/src/components/discovery-client.tsx`
- Modify: `apps/web/src/app/[district]/page.tsx` (add `key={current.id}` to the `<DiscoveryClient>` call)
- Test: `apps/web/src/components/discovery-client.spec.tsx` (append)

**Interfaces:**
- Consumes: Task 2's `useLocationContext()`; Task 1's `getVenues(query, coords)`.
- Produces: `DiscoveryClient` migrated off `useGeolocation()`; `loading`/`error` state with a
  `latestRequest` ref; a `sortedByDistance: boolean` state, produced here but **not yet consumed by
  any other component** — its full, externally-observable proof (via the real `CategoryQuickRoute`
  it's eventually passed to) is Task 6's job, not this one (round 5's "dead state" finding); this
  task's own tests verify `sortedByDistance` only through directly-inspectable means available at
  this point (call arguments, call counts), not a rendered UI signal that doesn't exist yet.

- [ ] **Step 1: Migrate off `useGeolocation()`**
Replace `const coords = useGeolocation();` with `const coords = useLocationContext();`, update the
import and this file's test mocks. Run existing tests to confirm no regression.

- [ ] **Step 2: Write the failing tests for loading/error/race-discarding (C2) — as two SEPARATE
      tests, not one test named for both but proving only the error path (round-6 finding)**
```typescript
describe("DiscoveryClient — loading, error, and stale-response discarding (C2)", () => {
  it("shows a loading indicator while a request is genuinely still in flight", async () => {
    let resolveVenues: (v: unknown) => void;
    getVenuesMock.mockReturnValueOnce(new Promise((resolve) => { resolveVenues = resolve; }));
    render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/yükleniyor/i));
    resolveVenues!({ data: [], meta: { next_cursor: null, has_more: false } });
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("shows an error message on failure", async () => {
    getVenuesMock.mockRejectedValueOnce(new Error("500"));
    render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/hata/i));
  });

  it("ignores a slow first response if a second request has already started", async () => {
    let resolveFirst: (v: unknown) => void;
    const venueA = { id: "v1", name: "First", slug: "first", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: null, googleRatingCount: null };
    const venueB = { id: "v2", name: "Second", slug: "second", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: null, googleRatingCount: null };
    getVenuesMock
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ data: [venueB], meta: { next_cursor: null, has_more: false } });
    render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    fireEvent.click(screen.getByTestId("filter-boutique")); // toggles back off -- a second, distinct request
    await waitFor(() => expect(screen.getByText("Second")).toBeInTheDocument());
    resolveFirst!({ data: [venueA], meta: { next_cursor: null, has_more: false } });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText("First")).not.toBeInTheDocument();
  });
});
```
Run — FAIL. Implement:
```typescript
const latestRequest = useRef(0);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [sortedByDistance, setSortedByDistance] = useState(false);
const autoSortedRef = useRef(false);
const userInteractedRef = useRef(false);

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
```
Render `{loading && <p role="status" aria-live="polite">Yükleniyor…</p>}` /
`{error && <p role="status" aria-live="polite">{error}</p>}`. Run — PASS.

- [ ] **Step 3: Write the failing tests for the one-time auto-sort effect (verifiable parts only — `sortedByDistance`'s full proof is Task 6's)**
```typescript
describe("DiscoveryClient — one-time auto-sort effect", () => {
  it("auto-refetches with resolved coords exactly once via rerender", async () => {
    vi.mocked(useLocationContextMock).mockReturnValue(null);
    const { rerender } = render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    vi.mocked(useLocationContextMock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    rerender(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledWith(expect.any(Object), { lat: 40.99, lng: 29.02 }));
    expect(getVenuesMock).toHaveBeenCalledTimes(1);
    rerender(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    expect(getVenuesMock).toHaveBeenCalledTimes(1);
  });

  it("does not auto-refetch if the user already changed a filter before coords resolved", async () => {
    vi.mocked(useLocationContextMock).mockReturnValue(null);
    const { rerender } = render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledTimes(1));
    vi.mocked(useLocationContextMock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    rerender(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(getVenuesMock).toHaveBeenCalledTimes(1);
  });
});
```
Implement:
```typescript
useEffect(() => {
  if (coords && !autoSortedRef.current && !userInteractedRef.current) {
    autoSortedRef.current = true;
    void runFetch(filters, coords);
  }
}, [coords]);
```
Run — PASS.

- [ ] **Step 4: Add `key={current.id}` to `[district]/page.tsx`'s `<DiscoveryClient>` call**
One-line addition guaranteeing a fresh component instance per district (resetting all of this
task's new state, not just a map's). Verified manually in Task 16's final smoke pass, not by a
unit test (React's `key` semantics are a framework guarantee).

- [ ] **Step 5:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 6: Commit**
```bash
git add apps/web/src/components/discovery-client.tsx apps/web/src/components/discovery-client.spec.tsx apps/web/src/app/\[district\]/page.tsx
git commit -m "feat(web): DiscoveryClient migrates to LocationProvider, loading/error/race handling, one-time auto-sort producing sortedByDistance, key-based state reset on district navigation"
```

---

## Task 5: Map-centering slice (C3)

**Files:**
- Create: `apps/web/src/lib/district-centers.ts`
- Modify: `apps/web/src/components/venue-map.tsx`, `apps/web/src/components/venue-map-leaflet.tsx`
  (real current: hardcoded `KADIKOY_CENTER: [number, number] = [40.9909, 29.0287]` at
  `<MapContainer center={KADIKOY_CENTER} ...>`)
- Modify: `apps/web/src/components/discovery-client.tsx` (gains a `center: [number, number]` prop)
- Modify: `apps/web/src/app/[district]/page.tsx`
- Test: `apps/web/src/lib/district-centers.spec.ts` (new), `apps/web/src/components/venue-map-leaflet.spec.tsx` (new — confirmed absent from the repo today)

**Interfaces:**
- Produces: `DISTRICT_CENTERS`/`DEFAULT_CENTER`; `VenueMapCanvas`/`VenueMap` gain a
  `center: [number, number]` prop, replacing `KADIKOY_CENTER` (deleted); `DiscoveryClient` gains
  `center`; `key={districtId}` is set on `DiscoveryClient`'s own `<VenueMap>` render (belt-and-
  suspenders alongside Task 4's page-level `key`, since `viewMode` toggling alone shouldn't force a
  remount, but a genuine district change always should, even in the hypothetical where the outer
  key somehow didn't apply).

- [ ] **Step 1: `DISTRICT_CENTERS` — write the failing test**
```typescript
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
- [ ] **Step 2:** Run — FAIL, create `apps/web/src/lib/district-centers.ts`:
```typescript
export const DISTRICT_CENTERS: Record<string, [number, number]> = {
  kadikoy: [40.9906, 29.0274],
  besiktas: [41.0422, 29.0061],
  beyoglu: [41.0370, 28.9850],
};
export const DEFAULT_CENTER: [number, number] = [41.0082, 28.9784];
```
- [ ] **Step 3:** Run — PASS.

- [ ] **Step 4: Create a fresh Leaflet mock harness, using `vi.hoisted()` for anything shared across the mock factory and the test body (round-5 finding), write the failing test for `center`**
```typescript
// apps/web/src/components/venue-map-leaflet.spec.tsx (new)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// `openPopupMock` is unused by this task's own test (Step 4 below only asserts on `center`) but is
// declared here, in the ONE shared vi.hoisted() block this whole file uses, because Task 12 (C14)
// appends to this exact block rather than re-declaring it -- keeping every hoisted mock in one
// place from the start avoids a second, conflicting vi.hoisted() call later.
const { getVenuesInBboxMock, openPopupMock } = vi.hoisted(() => ({
  getVenuesInBboxMock: vi.fn(),
  openPopupMock: vi.fn(),
}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ center, children }: { center: [number, number]; children: React.ReactNode }) => (
    <div data-testid="map-container" data-center={center.join(",")}>{children}</div>
  ),
  TileLayer: () => null,
  CircleMarker: ({ center, children, eventHandlers }: { center: [number, number]; children: React.ReactNode; eventHandlers?: { add?: (e: unknown) => void } }) => {
    const ref = (el: HTMLDivElement | null) => {
      if (el && eventHandlers?.add) eventHandlers.add({ target: { getElement: () => el, openPopup: openPopupMock } });
    };
    return <div ref={ref} data-testid="circle-marker" data-center={center.join(",")}>{children}</div>;
  },
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({ getBounds: () => ({ getWest: () => 0, getSouth: () => 0, getEast: () => 0, getNorth: () => 0 }) }),
  useMapEvents: () => undefined,
}));
vi.mock("@/lib/api", () => ({ getVenuesInBbox: getVenuesInBboxMock }));

import { VenueMapCanvas } from "./venue-map-leaflet";

beforeEach(() => { getVenuesInBboxMock.mockReset().mockResolvedValue([]); openPopupMock.mockReset(); });

describe("VenueMapCanvas — center prop replaces the hardcoded KADIKOY_CENTER", () => {
  it("passes the given center prop through to the map container", () => {
    render(<VenueMapCanvas venues={[]} center={[40.9906, 29.0274]} />);
    expect(screen.getByTestId("map-container")).toHaveAttribute("data-center", "40.9906,29.0274");
  });
});
```
(This mock harness is reused and extended by Task 6 and Task 12 — those tasks append to this same
file, they don't recreate the mock.) Run — FAIL. Add `center: [number, number]` to
`VenueMapCanvas`, replace `<MapContainer center={KADIKOY_CENTER} ...>` with
`<MapContainer center={center} ...>`, delete `KADIKOY_CENTER`. Thread `center` through `VenueMap`.
Run — PASS.

- [ ] **Step 5: Wire `DiscoveryClient` and `[district]/page.tsx`**
```typescript
export function DiscoveryClient({ districtId, initialVenues, center }: { districtId: string; initialVenues: VenueListItem[]; center: [number, number] }) {
  // ...
  {viewMode === "map" && <VenueMap key={districtId} venues={venues} center={center} />}
```
```typescript
// [district]/page.tsx
import { DISTRICT_CENTERS, DEFAULT_CENTER } from "@/lib/district-centers";
const center = DISTRICT_CENTERS[params.district] ?? DEFAULT_CENTER;
// <DiscoveryClient key={current.id} districtId={current.id} initialVenues={venues} center={center} />
```
Write the failing test asserting `DiscoveryClient` forwards `center` to a mocked `VenueMap`,
confirm fail, wire, confirm pass. **`center` becomes a required prop on `DiscoveryClient` — before
running the full suite, grep `discovery-client.spec.tsx` for every existing `render(<DiscoveryClient ...>)`
call (round-6 finding: `tsc` fails on any existing render call missing a newly-required prop) and
add `center={[40.99, 29.02]}` (or an equivalent fixed value) to each one, in this same step.**

- [ ] **Step 6:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 7: Commit**
```bash
git add apps/web/src/lib/district-centers.ts apps/web/src/lib/district-centers.spec.ts apps/web/src/components/venue-map.tsx apps/web/src/components/venue-map-leaflet.tsx apps/web/src/components/venue-map-leaflet.spec.tsx apps/web/src/components/discovery-client.tsx apps/web/src/components/discovery-client.spec.tsx apps/web/src/app/\[district\]/page.tsx
git commit -m "feat(web): real per-district map centering, new Leaflet test harness"
```

---

## Task 6: Category quick-route slice (C6) — also the FIRST real consumer of `sortedByDistance`

**Files:**
- Create: `apps/web/src/lib/directions.ts`
- Modify: `apps/web/src/components/venue-detail.tsx` (delegates its existing local
  `directionsUrl(venue)` — confirmed real, at line 30 — to the new shared helper; its OWN
  decorative "directions" section, confirmed real at lines 96-114, is unrelated and untouched)
- Modify: `apps/web/src/components/category-quick-route.tsx` (real current props confirmed:
  `{ activeCategory?: string; onSelectCategory: (category: string) => void }`)
- Modify: `apps/web/src/components/discovery-client.tsx` (gains `districtName: string`; wires
  `venues`/`districtName`/`sortedByDistance` into `CategoryQuickRoute` — **this is where
  `sortedByDistance`'s full observable behavior finally gets tested**, closing round 5's
  "produced-but-unconsumed dead state" finding)
- Modify: `apps/web/src/app/[district]/page.tsx` (passes `districtName={current.name}`)
- Test: `apps/web/src/lib/directions.spec.ts` (new), `apps/web/src/components/category-quick-route.spec.tsx` (append), `apps/web/src/components/discovery-client.spec.tsx` (append)

**Interfaces:**
- Consumes: Task 4's `sortedByDistance`.
- Produces: `directionsUrl(venueName, districtName)`; `CategoryQuickRoute` gains
  `venues`/`districtName`/`sortedByDistance`, `onSelectCategory` widens to accept `undefined`;
  `DiscoveryClient` gains `districtName`.

- [ ] **Step 1: Extract `directionsUrl`**
Read the real `venue-detail.tsx` function. Write the failing test:
```typescript
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
Run — FAIL. Create `apps/web/src/lib/directions.ts` with the extracted function.

**Round-7 finding: do not keep a local wrapper also named `directionsUrl(venue)` that calls the
newly-imported `directionsUrl(name, district)`** — same identifier, either a duplicate-declaration
error or accidental self-recursion. Instead, DELETE `venue-detail.tsx`'s local `directionsUrl`
function entirely, `import { directionsUrl } from "@/lib/directions"` at the top, and change its
one call site directly from `href={directionsUrl(venue)}` to
`href={directionsUrl(venue.name, venue.district.name)}`. Run existing `venue-detail.spec.tsx`
tests — no regression (same URL, same `data-testid="directions-link"`, just called with two
strings at the call site instead of one object internally). Run the new test — PASS.

- [ ] **Step 2: `CategoryQuickRoute`'s widened contract**
```typescript
const venues = [{ id: "v1", name: "First Cafe", slug: "first-cafe", category: "cafe", priceRange: "BUDGET", isBoutique: true, editorialNote: null, googleRating: null, googleRatingCount: null }];

describe("CategoryQuickRoute — widened contract: venues, districtName, sortedByDistance, deselect", () => {
  it("calls onSelectCategory(category), then renders a directions link once re-rendered with the new activeCategory, labeled 'En yakın' when sortedByDistance is true", () => {
    const onSelectCategory = vi.fn();
    const { rerender } = render(<CategoryQuickRoute venues={venues} districtName="Kadıköy" sortedByDistance onSelectCategory={onSelectCategory} activeCategory={undefined} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    expect(onSelectCategory).toHaveBeenCalledWith("cafe");
    rerender(<CategoryQuickRoute venues={venues} districtName="Kadıköy" sortedByDistance onSelectCategory={onSelectCategory} activeCategory="cafe" />);
    const link = screen.getByRole("link", { name: /en yakın cafe mekana git/i });
    expect(link).toHaveAttribute("href", expect.stringContaining(encodeURIComponent("First Cafe Kadıköy")));
  });

  it("uses neutral copy when sortedByDistance is false", () => {
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

  it("calls onSelectCategory(undefined) when the already-active category is clicked again", () => {
    const onSelectCategory = vi.fn();
    render(<CategoryQuickRoute venues={venues} districtName="Kadıköy" sortedByDistance onSelectCategory={onSelectCategory} activeCategory="cafe" />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    expect(onSelectCategory).toHaveBeenCalledWith(undefined);
  });
});
```
Run — FAIL. Update props to
`{ activeCategory?: string; venues: VenueListItem[]; districtName: string; sortedByDistance: boolean; onSelectCategory: (category: string | undefined) => void }`.
Click: `onSelectCategory(activeCategory === category ? undefined : category)`. Render a directions
link when a matching venue exists, labeled by `sortedByDistance`.

**`venues`/`districtName`/`sortedByDistance` all become required props — before running the full
suite, update the THREE existing render calls in `category-quick-route.spec.tsx`** (confirmed real
file, 3 tests, each currently rendering `<CategoryQuickRoute onSelectCategory={...} />` or
`<CategoryQuickRoute activeCategory="restaurant" onSelectCategory={...} />` with none of the new
props) **to add `venues={[]} districtName="Kadıköy" sortedByDistance={false}` to each of the three
calls, in this same step** — none of those three tests depend on those props' actual values, so a
fixed placeholder is correct for all of them.

Run — PASS.

- [ ] **Step 3: Wire `DiscoveryClient` and `[district]/page.tsx`, proving `sortedByDistance`'s full observable behavior end-to-end**
```typescript
export function DiscoveryClient({ districtId, initialVenues, center, districtName }: { districtId: string; initialVenues: VenueListItem[]; center: [number, number]; districtName: string }) {
  function handleQuickCategory(category: string | undefined) {
    applyFilters({ ...filters, category });
  }
  // ...
  <CategoryQuickRoute venues={venues} districtName={districtName} sortedByDistance={sortedByDistance} onSelectCategory={handleQuickCategory} activeCategory={filters.category} />
```
```typescript
// [district]/page.tsx
// <DiscoveryClient key={current.id} districtId={current.id} initialVenues={venues} center={center} districtName={current.name} />
```
**`districtName` becomes a required prop on `DiscoveryClient` (alongside Task 5's `center`) —
before running the full suite, grep `discovery-client.spec.tsx` for every existing
`render(<DiscoveryClient ...>)` call and add `districtName="Kadıköy"` (or an equivalent fixed
value) to each one that doesn't already have it from this task's own new tests, in this same step.**

Write the failing test (this is `sortedByDistance`'s real, complete proof — closing round 5's
"dead state" finding). **Round-6 finding: `vi.mock()` is hoisted and file-scoped in Vitest — a
per-test mock of `CategoryQuickRoute` would silently apply to every other test in this file,
including ones that need the real component's rendering/click behavior.** Rather than mocking
`CategoryQuickRoute` at all, assert through its REAL rendered DOM output (the real component is
already exercised directly by Task 6, Step 2's own tests, so this is consistent, not a new mocking
strategy introduced only for this one test):
**Round-7 finding: the prior draft of this test clicked a category FIRST (which sets
`userInteractedRef.current = true` inside `handleQuickCategory`/`applyFilters`), then expected the
auto-sort effect to still fire later and flip the copy to "En yakın" — but Task 4's own guard
(`!userInteractedRef.current`) makes that transition impossible by design. This was testing a
state change the implementation deliberately prevents.** Split into two independent, individually
valid scenarios instead — neither depends on a transition the guard blocks:

```typescript
describe("DiscoveryClient — sortedByDistance reaches CategoryQuickRoute correctly (via real rendered output, not a mock)", () => {
  const venue = { id: "v1", name: "First Cafe", slug: "first-cafe", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: null, googleRatingCount: null };

  it("shows neutral quick-route copy when the user picks a category before coords ever resolve (auto-sort correctly never fires)", async () => {
    vi.mocked(useLocationContextMock).mockReturnValue(null);
    getVenuesMock.mockResolvedValue({ data: [venue], meta: { next_cursor: null, has_more: false } });
    render(<DiscoveryClient districtId="d1" districtName="Kadıköy" center={[40.99, 29.02]} initialVenues={[venue]} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    await waitFor(() => expect(screen.getByRole("link", { name: /cafe mekana git/i })).toBeInTheDocument());
    expect(screen.queryByText(/en yakın/i)).not.toBeInTheDocument();
  });

  it("shows 'En yakın' quick-route copy when coords are ALREADY available at mount, so the one-time auto-sort fires with no prior user interaction to block it", async () => {
    vi.mocked(useLocationContextMock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    getVenuesMock.mockResolvedValue({ data: [venue], meta: { next_cursor: null, has_more: false } });
    render(<DiscoveryClient districtId="d1" districtName="Kadıköy" center={[40.99, 29.02]} initialVenues={[venue]} />);
    // no click at all -- the auto-sort effect runs on mount since coords are non-null and
    // userInteractedRef is still false, proving sortedByDistance reaches true purely from the
    // effect, not from a blocked/impossible post-interaction transition.
    await waitFor(() => expect(screen.getByRole("link", { name: /en yakın cafe mekana git/i })).toBeInTheDocument());
  });
});
```
Confirm both fail, wire, confirm both pass.

- [ ] **Step 4:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 5: Commit**
```bash
git add apps/web/src/lib/directions.ts apps/web/src/lib/directions.spec.ts apps/web/src/components/venue-detail.tsx apps/web/src/components/category-quick-route.tsx apps/web/src/components/category-quick-route.spec.tsx apps/web/src/components/discovery-client.tsx apps/web/src/components/discovery-client.spec.tsx apps/web/src/app/\[district\]/page.tsx
git commit -m "feat(web): category quick-route real directions deep link + deselect, sortedByDistance's full observable proof via CategoryQuickRoute"
```

---

## Task 7: Venue detail — address, single-marker map, photo grid (C4)

**Files:**
- Modify: `apps/web/src/components/venue-map.tsx`, `apps/web/src/components/venue-map-leaflet.tsx`
  (add `focusVenue` bypass)
- Modify: `apps/web/src/components/venue-detail.tsx` (ADDS a new, separate map/address/photos
  section; the existing decorative "directions" section at lines 96-114 is untouched, not replaced)
- Test: `apps/web/src/components/venue-map-leaflet.spec.tsx` (append), `apps/web/src/components/venue-detail.spec.tsx` (append)

**Interfaces:**
- Produces: `VenueMapCanvas`/`VenueMap` gain an optional
  `focusVenue?: { id: string; name: string; slug: string; category: string; lat: number; lng: number }`
  prop — round-6 finding: the shared marker/popup renderer needs `slug`/`category` (the same
  fields a bbox-derived `LocatedVenue` has) to render an identical popup, not just `{id,name,lat,lng}`.
  When present: the effective center is ALWAYS `[focusVenue.lat, focusVenue.lng]` (priority over
  `center`, tested); the bbox fetch AND its `BoundsVenueLoader` mount are skipped entirely; exactly
  one marker renders via the SAME accessible-marker rendering path Task 12 makes keyboard-accessible;
  `loadState`'s initial value is `"ready"` when `focusVenue` is given (round-6 finding: otherwise it
  stays stuck at its default `"loading"` forever, since nothing ever calls `onLoadStateChange`,
  showing a permanent "Bu alandaki mekanlar aranıyor" banner over a single-venue map that has
  nothing to search for); `VenueMap`'s venue-count header (round-6 finding: it currently reads
  `venues.length`, confirmed) shows `1` when `focusVenue` is given, not `venues.length` (which is
  `0` in this usage, producing a contradictory "0 mekan" header next to a real marker).

- [ ] **Step 1: `focusVenue` bypass + center priority + loadState + count — write the failing test**

**Round-7 finding:** initializing `loadState` to `"ready"` when `focusVenue` is given (round-6's
fix) has a side effect the round-6 pass missed: the real, existing empty-state banner condition is
`loadState === "ready" && locations.length === 0` (confirmed at its real line) — and in
`focusVenue` mode, `locations` is never populated at all (it's exclusively filled by
`BoundsVenueLoader`, which is skipped). So `"ready"` + an always-empty `locations` array would
show "Bu görünümde seçili mekanlardan biri yok" directly over the one real marker. This condition
must ALSO be guarded by `!focusVenue`.

```typescript
describe("VenueMapCanvas — focusVenue bypasses the bbox fetch, wins over center, shows exactly one marker, starts ready (not stuck loading), and never shows the bbox-driven empty-state banner", () => {
  it("centers on focusVenue's coordinates even when a different center is given, renders only that marker, never calls getVenuesInBbox, and shows neither the loading nor the empty-state banner", async () => {
    render(<VenueMapCanvas venues={[]} center={[41.0, 29.0]} focusVenue={{ id: "v1", name: "Cafe Test", slug: "cafe-test", category: "cafe", lat: 40.99, lng: 29.02 }} />);
    expect(screen.getByTestId("map-container")).toHaveAttribute("data-center", "40.99,29.02");
    expect(screen.getAllByTestId("circle-marker")).toHaveLength(1);
    expect(getVenuesInBboxMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/aranıyor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/seçili mekanlardan biri yok/i)).not.toBeInTheDocument();
  });
});

describe("VenueMap — venue-count header reflects focusVenue, not venues.length", () => {
  it("shows '1 mekan' (not '0 mekan') when focusVenue is given with an empty venues array", () => {
    render(<VenueMap venues={[]} center={[40.99, 29.02]} focusVenue={{ id: "v1", name: "Cafe Test", slug: "cafe-test", category: "cafe", lat: 40.99, lng: 29.02 }} />);
    expect(screen.getByText(/1 mekan/i)).toBeInTheDocument();
    expect(screen.queryByText(/0 mekan/i)).not.toBeInTheDocument();
  });
});
```
(Reuse Task 5's mock harness in this same file — `getVenuesInBboxMock` is already hoisted there.)
Run — FAIL. Implement: effective center = `focusVenue ? [focusVenue.lat, focusVenue.lng] : center`;
when `focusVenue` present, skip mounting `BoundsVenueLoader` entirely and initialize
`useState<LoadState>(focusVenue ? "ready" : "loading")` instead of always defaulting to
`"loading"`; change the real existing empty-state condition from
`loadState === "ready" && locations.length === 0` to
`!focusVenue && loadState === "ready" && locations.length === 0`; render one marker via the shared
marker-rendering helper (Step 1 of Task 12 defines this helper — if Task 12 hasn't landed yet when
this task is implemented, inline the marker JSX here and Task 12 refactors it into the shared
helper then, updating this task's call site). Thread `focusVenue` through `VenueMap`, and update
`VenueMap`'s header count expression from `venues.length` to `focusVenue ? 1 : venues.length`.
Run — PASS.

- [ ] **Step 2: Write the failing test for address/map/photos, mocking `VenueMap` explicitly so its `data-testid="map-container"`/`data-center` attributes are actually present for the assertions below**
```typescript
// venue-detail.spec.tsx (append) -- mock VenueMap the same way this file already mocks its other
// child components (FavoriteButton, ReportForm, WhatsappShareButton -- read their real mock setup
// first and match it), rendering a stand-in that exposes the same test hooks Task 5/7's real
// component does:
vi.mock("@/components/venue-map", () => ({
  VenueMap: ({ center, focusVenue }: { center: [number, number]; focusVenue?: { lat: number; lng: number } }) => {
    const effectiveCenter = focusVenue ? [focusVenue.lat, focusVenue.lng] : center;
    return <div data-testid="map-container" data-center={effectiveCenter.join(",")} />;
  },
}));

describe("VenueDetail — address, single-marker map, photo grid (net-new section, existing decorative directions section untouched)", () => {
  const baseVenue = { /* existing fixture, extended with: */ address: "Bahariye Cd. No:1", lat: 40.99, lng: 29.02, photos: ["https://x/1.jpg", "https://x/2.jpg"] };

  it("renders the venue's address when present", () => {
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.getByText("Bahariye Cd. No:1")).toBeInTheDocument();
  });
  it("does not render an address section when address is null", () => {
    render(<VenueDetail venue={{ ...baseVenue, address: null }} />);
    expect(screen.queryByTestId("venue-address")).not.toBeInTheDocument();
  });
  it("still renders the existing 'Sıradaki durak' directions section unchanged", () => {
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.getByTestId("directions-link")).toBeInTheDocument();
  });
  it("renders the new map focused on the venue's real coordinates", () => {
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.getByTestId("map-container")).toHaveAttribute("data-center", "40.99,29.02");
  });
  it("renders a photo grid using real <img> elements", () => {
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.getAllByRole("img", { name: new RegExp(baseVenue.name) })).toHaveLength(2);
  });
  it("renders an empty state when photos is empty", () => {
    render(<VenueDetail venue={{ ...baseVenue, photos: [] }} />);
    expect(screen.getByText(/henüz fotoğraf eklenmedi/i)).toBeInTheDocument();
  });
});
```
Run — FAIL. Add a new section (separate from, not replacing, the existing "Sıradaki durak"
block): conditionally render `venue.address` (`data-testid="venue-address"`);
`<VenueMap venues={[]} center={[venue.lat, venue.lng]} focusVenue={{ id: venue.id, name: venue.name, slug: venue.slug, category: venue.category, lat: venue.lat, lng: venue.lng }} />`
(note `slug`/`category` now included, per this task's widened `focusVenue` type above — both
already exist on `VenueDetailType`); a photo grid or empty state. Run — PASS.

- [ ] **Step 3:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 4: Commit**
```bash
git add apps/web/src/components/venue-map.tsx apps/web/src/components/venue-map-leaflet.tsx apps/web/src/components/venue-map-leaflet.spec.tsx apps/web/src/components/venue-detail.tsx apps/web/src/components/venue-detail.spec.tsx
git commit -m "feat(web): venue detail address/single-marker map (focusVenue bypass, wins over center)/photo grid, additive to the existing directions section"
```

---

## Task 8: Native share button (C9)

**Files:**
- Create: `apps/web/src/components/native-share-button.tsx`
- Modify: `apps/web/src/components/venue-detail.tsx` (adds one render line next to the existing `<WhatsappShareButton>`, real location: inside the "Birlikte karar ver" section)
- Test: `apps/web/src/components/native-share-button.spec.tsx` (new)

- [ ] **Step 1: Write the failing test, without reassigning `window.location`**
```typescript
describe("NativeShareButton", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });

  it("renders once mounted when navigator.share is a real function, and calls it with the venue name and a URL", async () => {
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
- [ ] **Step 2:** Run — FAIL. Create `apps/web/src/components/native-share-button.tsx`, mirroring
      `whatsapp-share-button.tsx`'s structural pattern:
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
Render `<NativeShareButton venue={venue} />` next to `<WhatsappShareButton venue={venue} />`. Run — PASS.
- [ ] **Step 3:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 4: Commit**
```bash
git add apps/web/src/components/native-share-button.tsx apps/web/src/components/native-share-button.spec.tsx apps/web/src/components/venue-detail.tsx
git commit -m "feat(web): SSR-safe native share button next to WhatsApp share"
```

---

## Task 9: Google badge attribution text (C10)

**Files:**
- Modify: `apps/web/src/components/venue-card.tsx` (real current badge confirmed at lines 68-78,
  correctly checking `!== null` already)
- Test: `apps/web/src/components/venue-card.spec.tsx` (new — confirmed absent from the repo today)

- [ ] **Step 1: Write the failing test, matching the design doc's literal `"· 120 Google yorumu"` format**
```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VenueCard } from "./venue-card";

const baseVenue = { id: "v1", name: "Cafe Test", slug: "cafe-test", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: 4.3, googleRatingCount: null };

describe("VenueCard — Google rating badge attribution text", () => {
  it("shows '4.3 · 120 Google yorumu' when a count is present", () => {
    render(<VenueCard venue={{ ...baseVenue, googleRatingCount: 120 }} />);
    expect(screen.getByText(/4\.3.*·\s*120 Google yorumu/)).toBeInTheDocument();
  });
  it("shows unlabeled 'Google yorumu' (no count) when googleRatingCount is null", () => {
    render(<VenueCard venue={{ ...baseVenue, googleRatingCount: null }} />);
    expect(screen.getByText(/Google yorumu/)).toBeInTheDocument();
    expect(screen.queryByText(/\d+ Google yorumu/)).not.toBeInTheDocument();
  });
});
```
(Check `venue-card.tsx`'s real imports/context requirements — e.g. a router mock for its `Link` —
before assuming a bare `render()` works; this is a NEW spec file, match whatever wrapper this
component's siblings' spec files use.) Run — FAIL. Update the real badge markup (lines 68-78) to:
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
- [ ] **Step 2:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 3: Commit**
```bash
git add apps/web/src/components/venue-card.tsx apps/web/src/components/venue-card.spec.tsx
git commit -m "feat(web): venue-card Google badge gains attribution text matching design doc's literal format"
```

---

## Task 10: Admin curation copy — fix the real stale artifact (a source comment, confirmed at line 64, not the visible button text confirmed correct at line 78)

**Files:**
- Modify: `apps/admin/src/components/queue-item.tsx`

- [ ] **Step 1:** Read the real file in full. Confirm (already verified this round): the visible
      button text at line 78 already says "yalnızca incelendi olarak işaretler" (correct, matches
      Plan 4b's A3 decision); a stale comment near line 64 still claims `verified_at` is refreshed.
- [ ] **Step 2:** Fix the stale comment to accurately describe Plan 4b's A3 behavior. No test
      needed — no visible/behavioral change, confirmed by Step 1.
- [ ] **Step 3:** Run: `cd apps/admin && npx vitest run && npx tsc --noEmit` (confirm no regression).
- [ ] **Step 4: Commit**
```bash
git add apps/admin/src/components/queue-item.tsx
git commit -m "docs(admin): fix stale verified_at claim in queue-item's source comment (Plan 4b A3) -- visible copy was already correct"
```

---

## Task 11: Accessibility — real loading-state visibility (C13)

**Files:**
- Modify: `apps/web/src/app/favoriler/page.tsx` (real gap, confirmed line 26: `if (loading || !user) return null;`)
- Modify: `apps/admin/src/app/(protected)/layout.tsx` (real gap, confirmed line 42: `if (loading) return null;` — this is AUTH loading, its own real test file's existing mocking pattern uses `vi.doMock` + dynamic import, confirmed this round; match that exactly, don't introduce a directly-mocked `useAuth` that doesn't match the file's real convention)
- Modify: `apps/admin/src/app/(protected)/kuyruk/page.tsx` (real gap, confirmed line 90:
  `if (loading) return null;` — this `loading` is this page's OWN `getQueue()` request state, NOT
  auth loading; the test below must leave a `getQueue()` promise unresolved, not mock `useAuth`)
- Test: each page's existing test file

- [ ] **Step 1: `favoriler/page.tsx`**
```typescript
describe("FavorilerPage — visible loading state instead of a silent blank screen", () => {
  it("renders a visible, accessible loading indicator while auth is loading, not null", () => {
    vi.mocked(useAuthMock).mockReturnValue({ user: null, session: null, loading: true });
    render(<FavorilerPage />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/yükleniyor/i);
  });
});
```
Run — FAIL. Change `if (loading || !user) return null;` to only return `null` once
`!loading && !user` (imminent redirect), rendering a visible `<p role="status" aria-live="polite">Yükleniyor…</p>`
while `loading` is true. Run — PASS.

- [ ] **Step 2: `apps/admin/src/app/(protected)/layout.tsx`**
Read this file's REAL existing test first to confirm its real mocking convention (`vi.doMock` +
dynamic import, per this round's finding — do not assume a simpler `vi.mock` pattern works).
```typescript
describe("ProtectedLayout — visible loading state instead of a silent blank screen", () => {
  it("renders a visible, accessible loading indicator while auth is loading", async () => {
    // set up loading:true via this file's REAL vi.doMock + dynamic-import convention, matching
    // its existing tests exactly
    render(<ProtectedLayout><div /></ProtectedLayout>);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/yükleniyor/i);
  });
});
```
Run — FAIL. Replace `if (loading) return null;` (line 42) with a visible
`<p role="status" aria-live="polite">Yükleniyor…</p>`. Leave the subsequent
`if (!user || !role) return null;` (line 59) as-is. Run — PASS.

- [ ] **Step 3: `apps/admin/src/app/(protected)/kuyruk/page.tsx`**
```typescript
describe("KuyrukPage — visible loading state while the queue itself is loading", () => {
  it("renders a visible, accessible loading indicator while getQueue() is unresolved", () => {
    getQueueMock.mockReturnValue(new Promise(() => {})); // never resolves within this test
    render(<KuyrukPage />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/yükleniyor/i);
  });
});
```
Run — FAIL. Replace `if (loading) return null;` (line 90) with the visible indicator. Run — PASS.

- [ ] **Step 4:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit` and
      `cd apps/admin && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 5: Commit**
```bash
git add apps/web/src/app/favoriler/page.tsx apps/admin/src/app/\(protected\)/layout.tsx apps/admin/src/app/\(protected\)/kuyruk/page.tsx
git commit -m "fix(web,admin): replace three silent loading=>null screens with visible accessible indicators (C13)"
```

---

## Task 12: Real keyboard-accessible map markers (C14)

**Files:**
- Modify: `apps/web/src/components/venue-map-leaflet.tsx`
- Test: `apps/web/src/components/venue-map-leaflet.spec.tsx` (append — extends Task 5's mock
  harness, which already simulates `eventHandlers.add` via its `CircleMarker` mock's `ref`
  callback)

**Interfaces:** Consumes Task 5's mock harness (already wired to call `eventHandlers.add` with a
mock layer). Produces: each marker's underlying element gains `tabindex="0"`, `role="button"`,
`aria-label`, and Enter/Space opens its popup — for BOTH the bbox-driven multi-marker case and
Task 7's `focusVenue` single-marker case, via one shared marker-rendering path (not two copies).

- [ ] **Step 1: Write the failing test, with a bbox mock that actually returns a matching venue (round-5 finding: `[]` proves nothing), and a real assertion on `openPopupMock` (round-6 finding: the prior draft left a comment instead of an assertion; `openPopupMock` is already declared in this file's ONE shared `vi.hoisted()` block from Task 5, Step 4 — no second mock setup needed here)**
```typescript
describe("VenueMapCanvas — real keyboard accessibility for markers (C14)", () => {
  it("gives each marker's underlying element a tabindex/role/aria-label", async () => {
    getVenuesInBboxMock.mockResolvedValueOnce([{ id: "v1", name: "Cafe Test", category: "cafe", lat: 40.99, lng: 29.02 }]);
    render(<VenueMapCanvas venues={[{ id: "v1", name: "Cafe Test", slug: "cafe-test", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: null, googleRatingCount: null }]} center={[40.99, 29.02]} />);
    const marker = await screen.findByTestId("circle-marker");
    expect(marker).toHaveAttribute("tabindex", "0");
    expect(marker).toHaveAttribute("role", "button");
    expect(marker).toHaveAttribute("aria-label", "Cafe Test");
  });

  it("opens the popup on both Enter and Space, proven via a real assertion on the hoisted openPopupMock", async () => {
    getVenuesInBboxMock.mockResolvedValueOnce([{ id: "v1", name: "Cafe Test", category: "cafe", lat: 40.99, lng: 29.02 }]);
    render(<VenueMapCanvas venues={[{ id: "v1", name: "Cafe Test", slug: "cafe-test", category: "cafe", priceRange: "BUDGET", isBoutique: false, editorialNote: null, googleRating: null, googleRatingCount: null }]} center={[40.99, 29.02]} />);
    const marker = await screen.findByTestId("circle-marker");
    fireEvent.keyDown(marker, { key: "Enter" });
    expect(openPopupMock).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(marker, { key: " " });
    expect(openPopupMock).toHaveBeenCalledTimes(2);
  });

  it("the focusVenue single-marker case (Task 7) uses the same accessible marker path", async () => {
    render(<VenueMapCanvas venues={[]} center={[40.99, 29.02]} focusVenue={{ id: "v1", name: "Cafe Test", slug: "cafe-test", category: "cafe", lat: 40.99, lng: 29.02 }} />);
    const marker = await screen.findByTestId("circle-marker");
    expect(marker).toHaveAttribute("role", "button");
    fireEvent.keyDown(marker, { key: "Enter" });
    expect(openPopupMock).toHaveBeenCalledTimes(1);
  });
});
```
Run — FAIL. Implement via `CircleMarker`'s `eventHandlers`:
```tsx
function markerEventHandlers(name: string) {
  return {
    add: (e: { target: { getElement: () => HTMLElement | null; openPopup: () => void } }) => {
      const layer = e.target;
      const el = layer.getElement();
      if (!el) return;
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", name);
      el.addEventListener("keydown", (evt: KeyboardEvent) => {
        if (evt.key === "Enter" || evt.key === " ") {
          evt.preventDefault();
          layer.openPopup();
        }
      });
    },
  };
}
```
Use `markerEventHandlers(venue.name)` as the `eventHandlers` prop on BOTH the bbox-driven marker
loop and Task 7's `focusVenue` single-marker render — one shared function, not two copies. Run — PASS.

- [ ] **Step 2:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 3: Commit**
```bash
git add apps/web/src/components/venue-map-leaflet.tsx apps/web/src/components/venue-map-leaflet.spec.tsx
git commit -m "fix(web): real keyboard focus + Enter/Space popup activation for map markers (C14), shared across the bbox and focusVenue paths"
```

---

## Task 13: Favorites collection creation (C5)

**Files:**
- Modify: `apps/web/src/app/favoriler/page.tsx` (already a Client Component; already renders every
  list as its own card — only a create-list form is missing)
- Test: `apps/web/src/app/favoriler/page.spec.tsx` (new, or wherever this page's test lives —
  check first)

**Interfaces:** Consumes the real `createFavoriteList(token: string, name: string): Promise<FavoriteList>`.
Produces a create-list form appending to the existing `lists` state.

**Round-6 finding (design doc vs. implementation — resolved as a documented scope reduction, not a
gap):** the design doc's C5 section asks for a tab/dropdown switcher across multiple lists. The
real `favoriler/page.tsx` (confirmed) already renders EVERY list as its own `<article>` card in a
grid, each showing its own favorited venues inline — functionally equivalent to a switcher for the
pilot's expected list count (a handful of lists per user), and simpler. Building a separate
tab/dropdown UI on top of an already-adequate all-lists-visible grid would be over-engineering per
this project's own YAGNI convention. This is recorded as an accepted, reasoned deviation:

```markdown
## Red-team bulguları — reddedilenler
- C5'in design doc'taki tab/dropdown switcher isteği: reddedildi. Gerekçe: favoriler sayfası
  zaten TÜM listeleri ayrı kart olarak gösteriyor (grid), bu pilot ölçeğinde (kullanıcı başına
  az sayıda liste) bir switcher'dan daha basit ve en az o kadar kullanılabilir. Bu yanlışsa ne
  olur: kullanıcı sayısı/liste sayısı arttıkça grid kalabalıklaşır, o zaman gerçek bir switcher
  eklenir (Faz 2).
```

- [ ] **Step 1: Write the failing test, with a fixture matching the real `FavoriteList` shape (`userId`/`createdAt` included), and correct sequencing around the page's real `lists === null` loading state**
```typescript
describe("Favoriler page — create a new list", () => {
  it("submits a new list name via createFavoriteList(token, name) and shows it as a new card once appended", async () => {
    getFavoriteListsMock.mockResolvedValue([]); // real initial load -- must resolve to a real array before lists stops being null
    createFavoriteListMock.mockResolvedValue({ id: "l2", userId: "u1", name: "Kadıköy Kahveleri", createdAt: "2026-01-01T00:00:00.000Z", favorites: [] });
    render(<FavorilerPage />);
    // wait for the real initial getFavoriteLists() load to resolve (lists: null -> []) before
    // interacting -- the create form only exists once lists has loaded, matching the page's real
    // three-state (null/empty/populated) rendering already confirmed by reading the file.
    await waitFor(() => expect(screen.getByLabelText(/liste adı/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/liste adı/i), { target: { value: "Kadıköy Kahveleri" } });
    fireEvent.click(screen.getByRole("button", { name: /oluştur/i }));
    await waitFor(() => expect(createFavoriteListMock).toHaveBeenCalledWith(expect.any(String), "Kadıköy Kahveleri"));
    expect(await screen.findByText("Kadıköy Kahveleri")).toBeInTheDocument();
  });
});
```
(This page's test file mocks `@/lib/api` statically — read its real current mock object and ADD
`createFavoriteList: vi.fn()` to it in this same step, since the mock doesn't include it yet.) Run
— FAIL. Add a name input + submit button calling `createFavoriteList(session.access_token, name)`,
appending the result to `lists` on success. Run — PASS.

- [ ] **Step 2:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 3: Commit**
```bash
git add apps/web/src/app/favoriler
git commit -m "feat(web): favorites list creation via the real createFavoriteList(token, name) helper"
```

---

## Task 14: Filter toggles — open-now (C7) and the boutique toggle fix (Plan 4b schema regression)

**Files:**
- Modify: `apps/web/src/components/venue-filters.tsx` (real boutique bug, confirmed line 145:
  `onClick={() => update({ isBoutique: !filters.isBoutique })}`; `FilterState` gains
  `openNow?: boolean`; `serializeFilters` gains `if (filters.openNow) out.openNow = "true";`)
- Test: `apps/web/src/components/venue-filters.spec.tsx` (append)

- [ ] **Step 1: Write the failing test for the boutique toggle fix** (most urgent — Plan 4b's
      schema rejects `isBoutique=false` with 400)
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
Run — FAIL. Change to `filters.isBoutique ? undefined : true`. Run — PASS.

- [ ] **Step 2: Write the failing test for `openNow` (`FilterState`/`serializeFilters`/UI toggle all together, since none of it exists yet)**
```typescript
describe("VenueFilters — openNow toggle", () => {
  it("toggles between undefined and true", () => {
    const onChange = vi.fn();
    render(<VenueFilters value={{}} onChange={onChange} coordsAvailable={false} />);
    fireEvent.click(screen.getByTestId("filter-open-now"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ openNow: true }));
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
Run — FAIL. Add `openNow?: boolean;` to `FilterState`, the `serializeFilters` line, and a toggle
button (matching the boutique toggle's pattern, label "Şimdi açık", `data-testid="filter-open-now"`).
Run — PASS.

- [ ] **Step 3:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 4: Commit**
```bash
git add apps/web/src/components/venue-filters.tsx apps/web/src/components/venue-filters.spec.tsx
git commit -m "feat(web): open-now filter toggle, fix boutique toggle for Plan 4b's OptionalTrueFlag schema"
```

---

## Task 15: Code-quality cleanup — category labels consolidation

**Files:**
- Create: `apps/web/src/lib/category-labels.ts`
- Modify: `apps/web/src/components/venue-card.tsx`, `venue-detail.tsx`, `category-quick-route.tsx`
- Test: `apps/web/src/lib/category-labels.spec.ts` (new)

- [ ] **Step 1: Write the failing test**
```typescript
import { describe, it, expect } from "vitest";
import { CATEGORY_LABELS } from "./category-labels";

describe("CATEGORY_LABELS", () => {
  it("only contains the real backend taxonomy", () => {
    expect(CATEGORY_LABELS).toEqual({ cafe: "Kahve", restaurant: "Restoran", bakery: "Fırın", "street-food": "Sokak lezzeti" });
  });
});
```
- [ ] **Step 2:** Run — FAIL. Create the file with the exact 4-entry map (currently in
      `venue-card.tsx`). Update `venue-card.tsx` to import it. Delete `venue-detail.tsx`'s stale
      7-entry local map (including non-taxonomy `kahvalti`/`kahve`/`tatli`), import the shared one.
      Update `category-quick-route.tsx`'s import source.
- [ ] **Step 3:** Run — PASS. Run every affected component's existing tests.
- [ ] **Step 4:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 5: Commit**
```bash
git add apps/web/src/lib/category-labels.ts apps/web/src/lib/category-labels.spec.ts apps/web/src/components/venue-card.tsx apps/web/src/components/venue-detail.tsx apps/web/src/components/category-quick-route.tsx
git commit -m "refactor(web): consolidate category labels into one shared lib/category-labels.ts"
```

---

## Task 16: Final regression, C-item cross-check, and manual smoke verification

**Files:**
- Modify: `docs/STATE.md`
- Modify: `docs/SESSION-LOG-2026-07-26.md`

- [ ] **Step 1: Re-check the C-item table at the top of this plan against the actual commits made.**
      For each of C1-C14, confirm a corresponding commit exists. This is the direct, mechanical
      defense against round 5's dropped-task defect — do not skip it.
- [ ] **Step 2:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`
- [ ] **Step 3:** Run: `cd apps/admin && npx vitest run && npx tsc --noEmit`
- [ ] **Step 4:** Run: `cd packages/api-client && npx vitest run`
- [ ] **Step 5:** Run: `pnpm exec turbo run typecheck lint --filter=@gurmego/web... --filter=@gurmego/admin... --filter=@gurmego/api-client...`
- [ ] **Step 6: Manual verification (NOT an automated gate)** — start both the API and
      `cd apps/web && pnpm run dev`:
      1. Visit each district page, switch to map view, confirm centering; navigate between
         districts (client-side link) and confirm both the map re-centers AND the venue
         list/filters reset.
      2. Grant location permission, confirm the list auto-sorts once and quick-route buttons show
         "En yakın ... git" only once a coords-driven fetch actually succeeded.
      3. Deny location permission, confirm manual browsing still works, neutral quick-route copy.
      4. Open a venue detail page: address/single-marker map/photos, native share where supported.
      5. Tab through map markers with a keyboard, confirm focus outline and Enter/Space popup.
      6. Create a favorites list, confirm it appears as a new card.
      7. Confirm the admin panel's auth/queue loading transitions are visibly announced.
      8. Toggle boutique/open-now filters, confirm no 400 errors in the network tab.
- [ ] **Step 7:** Update `docs/STATE.md` and `docs/SESSION-LOG-2026-07-26.md`: Plan 4c complete,
      ready for the final whole-branch review.
- [ ] **Step 8: Commit**
```bash
git add docs/STATE.md docs/SESSION-LOG-2026-07-26.md
git commit -m "docs: Plan 4c complete, ready for final whole-branch review"
```

---

## Self-Review Notes (round 6, after round 5's most severe finding — a dropped task)

- **C1/C11/C12 are restored as Task 3**, and the C-item → task table at the top of this plan is
  the direct mechanism preventing this specific class of defect (an entire task vanishing during
  renumbering) from recurring silently again.
- **Task 1's test examples now match the REAL `api.spec.ts` architecture** (`vi.hoisted()` +
  `mockGet`/`mockPost`, no invented `client` export to spy on) and preserve the real
  `ApiValidationError(path, issues)` two-argument contract instead of silently narrowing it.
- **The real `DistrictSchema` fixture (`id`/`cityId`/`name`/`slug`, real UUIDs) is reused from the
  file's own existing `VALID_DISTRICT` constant**, not invented.
- **Vitest's real monorepo version and the `pnpm-lock.yaml` regeneration are both accounted for**
  in Task 1.
- **`venue-detail.tsx`'s existing decorative "directions" section is explicitly preserved,
  untouched** — the new map/address/photos section (Task 7) is additive, not a replacement,
  closing round 5's wrong "no placeholder exists" claim.
- **`sortedByDistance`'s full, externally-observable proof now lives in Task 6** (its first real
  consumer), not Task 4 (its producer) — closing round 5's "dead, unobservable state" finding.
- **C14's test now mocks a real bbox response** matching a venue, instead of `[]`, which the real
  `BoundsVenueLoader` would never render a marker for regardless of the fix.
- **Task 6/7's venue-detail work, Task 8 (native share), Task 9 (Google badge), Task 11 (loading
  states), Task 12 (keyboard a11y), Task 13 (list creation), and Task 14 (filter toggles) are now
  each independently small tasks**, per this round's explicit splitting finding.
- **The admin `kuyruk`/`layout` loading tests now match their real distinct loading sources**
  (queue-fetch vs. auth) and real mocking conventions (`vi.doMock` + dynamic import for the
  layout), rather than assuming a uniform, simpler pattern.

## Self-Review Notes (round 7 — DÜZELTİLEBİLİR fixes applied in place, no re-split needed)

Round 6's verdict was **DÜZELTİLEBİLİR** (a first, after six rounds of YENİDEN BÖL) — the C1-C14
completeness table held up, and the task-level structure was accepted as reasonable. The specific,
local fixes it required are applied directly above, at each location:

- **Task 7's `focusVenue` type widened to `{id,name,slug,category,lat,lng}`** (was missing
  `slug`/`category`, which the shared marker/popup renderer needs); **`loadState` now initializes
  to `"ready"` when `focusVenue` is given** (was stuck at `"loading"` forever, since nothing calls
  `onLoadStateChange` in the bypass path); **`VenueMap`'s venue-count header now accounts for
  `focusVenue`** (was reading `venues.length`, showing a contradictory "0 mekan" next to a real
  marker).
- **Task 7's `venue-detail.spec.tsx` test now explicitly mocks `VenueMap`**, so its `map-container`/
  `data-center` assertions have something real to assert against.
- **Task 12 (C14)'s Enter/Space test now asserts against a real, shared `vi.hoisted()`
  `openPopupMock`** (declared once, in Task 5's own mock setup, not re-declared) instead of leaving
  a comment where an assertion belonged.
- **Task 5's mock harness now imports `beforeEach`** (was used but not imported).
- **Task 4's C2 test is now two separate tests** — one genuinely proving the loading indicator via
  an unresolved promise, one proving the error path — instead of one test named for both that only
  exercised the error case.
- **Task 6's `sortedByDistance` proof no longer proposes a per-test `vi.mock`** (Vitest's mocks are
  file-hoisted and would have silently altered every other test in the file) — it now asserts
  through the real `CategoryQuickRoute`'s rendered DOM output instead.
- **Task 1 (getVenues' new second argument) and Task 3 (favorite-button's mount-time check) now
  explicitly instruct updating every pre-existing test call site/fixture in the same step**, not
  as an implied afterthought — closing a real `tsc`/test-breakage gap in both.
- **Task 5 and Task 6 now explicitly instruct adding the newly-required `center`/`districtName`
  props to every pre-existing `render(<DiscoveryClient ...>)` call** in `discovery-client.spec.tsx`.
- **Task 1/Task 2's `district-picker.spec.tsx` now says "create," not "append"** — confirmed absent
  from the repo today.
- **C5's design-doc/implementation gap (a tab/dropdown switcher vs. the real page's existing
  all-lists-as-cards grid) is resolved as a documented, reasoned scope reduction** (Task 13),
  following this project's own convention for recording rejected red-team findings with rationale,
  rather than building a switcher that duplicates already-adequate functionality.
- **Task 13's test now waits for the real `lists === null → []` initial load to resolve** before
  looking for the create-list form (which only renders once `lists` has loaded), and adds
  `createFavoriteList` to the page's existing static API mock, which didn't include it.
