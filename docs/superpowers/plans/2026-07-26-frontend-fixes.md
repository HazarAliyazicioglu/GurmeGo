# GurmeGo — Plan 4c: Frontend/Admin Kritik Düzeltmeler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every frontend/admin finding from `docs/AUDIT-2026-07-26.md`, per
`docs/superpowers/specs/2026-07-26-frontend-fixes-design.md` (HAZIR after 5 idea-red-team rounds).

## Round 1 plan-red-team (Codex, YENİDEN BÖL) — uygulandı

Round 1's core finding: Task 1 claimed to atomically update every direct caller of the new
`getVenues`/`getNearestDistrict` signatures, but Task 2 then claimed ownership of those same call
sites as a separate task — a direct contradiction, the same bug class Plan 4b's plan-red-team
caught three times. Separately, `discovery-client.tsx` was touched by six different tasks whose
changes all mutate the same state machine; C10's test contradicted the design doc; `singlePoint`
was underspecified; `onSelectCategory`'s signature couldn't express deselect; native-share had no
SSR-safety; the remount claim had no test; Task 11's `Files: none` contradicted its own doc-update
step. Round 1's fixes: merged Task 1+2's callers into one atomic task; pulled `LocationProvider`
forward; consolidated the discovery state machine into one task (old Task 4); reused
`VenueMapLeaflet`'s multi-marker path instead of a new `singlePoint` prop; widened
`onSelectCategory` from its introduction; fixed the C10/native-share/Task-11 issues.

## Round 2 plan-red-team (Codex, YENİDEN BÖL again) — uygulandı

Round 2's verdict: the Task 1/Task 2 contradiction was genuinely fixed, but **the identical bug
class reappeared at the Task 4/Task 9 boundary** — old Task 4 passed `CategoryQuickRoute` props
(`venues`, `districtName`, `coordsAvailable`) that only old Task 9 defined on the component,
meaning Task 4's own `tsc --noEmit` step could not actually pass. Plus real, distinct bugs:

1. **No task actually wired `districtName` from `[district]/page.tsx` down to `DiscoveryClient`.**
   It was referenced as if it already existed.
2. **`coordsAvailable = Boolean(coords)` conflates "the browser resolved a coordinate" with "the
   list currently on screen is actually distance-sorted."** If the user changes a filter before
   coords resolve (auto-sort intentionally skipped, per C8's `userInteractedRef` guard) or the
   auto-sort's own fetch fails, `coords` becomes truthy while the visible list is still
   `newest`-sorted — the old plan would still show "En yakın [kategori] mekana git," which is false.
3. **Old Task 5's newly-required `centerLat`/`centerLng` props on `VenueMapLeaflet` would break
   every `DiscoveryClient` test render written in old Task 4**, with no migration step specified.
4. **`createList(name, token)`'s own task defined that signature, but its own test called
   `createList("Kadıköy Kahveleri")` with one argument** — self-contradictory.
5. **C10's `googleRatingCount !== null` check misses `undefined`**, which the schema also permits
   as "no count" — would literally render `"undefined Google yorumu"`.
6. **The native-share "unavailable" test set `navigator.share = undefined`, but `"share" in
   navigator"` still evaluates `true` for an own property set to `undefined`** — the test could
   never fail against the buggy implementation it was meant to catch.
7. **The remount-key test hardcoded `key="kadikoy"` directly in the test's own JSX** — a real
   `DiscoveryClient` with the `key` prop entirely deleted would still pass this test, so it proved
   nothing about production wiring, and (worse) it would pass even before Step 6 implemented the
   fix, violating TDD's fail-first requirement.
8. Several smaller test bugs: the "no auto-refetch after user interaction" test called `render()`
   a second time instead of `rerender()` (a fresh `render()` gets fresh refs, so the assertion
   proved nothing about the guard); Task 1's call-site test used `expect.anything()` instead of
   asserting the real coords value; `LocationProvider`'s own test description was self-contradictory
   (a provider that itself calls `useGeolocation()` cannot be tested by asserting "the hook was
   never called"); the favorites page's Server/Client Component boundary was unaddressed while the
   test assumed a client-side `initialLists` prop contract that was never established.

**Fixed in this revision** (the structural fix): old Tasks 4, 5, and 9 — discovery state machine,
map centering, and category-quick-route completion — are merged into **one** atomic task (new
Task 4), because Round 2 proved they are not independent: they all define and consume the same
prop surface (`DiscoveryClient` → `CategoryQuickRoute`, `DiscoveryClient` → `VenueMapLeaflet`) in
the same commit, so no intermediate task state is ever asked to compile against an interface that
doesn't exist yet. `sortedByDistance` (a real piece of `DiscoveryClient` state, set only after a
successful coords-driven fetch) replaces `coordsAvailable`/`Boolean(coords)` as the signal
`CategoryQuickRoute` uses for its "En yakın" copy. `districtName` is wired from `[district]/page.tsx`
in this same task, using the district list the page already fetches. The remount test now proves
production wiring by rendering `DiscoveryClient` itself (not `VenueMapLeaflet` with a hardcoded
key) and asserting a mount-tracking effect fires again when `districtId` changes. Every other
Round 2 finding is fixed at its specific location below.

**Architecture:** No new backend calls beyond what Plan 4b already exposes. The only new runtime
mechanism is header propagation through the existing `packages/api-client` → `apps/web/src/lib/api.ts`
chain, plus a `LocationProvider` React context replacing two independent `useGeolocation()` calls
— everything else is component-level state/effect fixes or copy changes.

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
  consumers** — established after two separate red-team rounds caught this violated at two
  different task boundaries (Task 1/2, then Task 4/9). Any task that defines a component's new
  prop must also update every call site passing those props, in the same commit.

---

## Task 1: API client header propagation (atomic — signature change + every direct caller)

Owns `packages/api-client`'s `get()` signature and `apps/web/src/lib/api.ts`'s `fetchValidated`/
`getVenues`/`getNearestDistrict`, AND every one of their direct callers
(`discovery-client.tsx`'s `getVenues` call, `district-picker.tsx`'s `getNearestDistrict` call,
`venue-filters.tsx`'s `serializeFilters`) in this same task/commit.

**Files:**
- Modify: `packages/api-client/src/index.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/components/venue-filters.tsx` (`serializeFilters`)
- Modify: `apps/web/src/components/discovery-client.tsx` (only the `getVenues` call site — the
  rest of this file's state machine is Task 4's job)
- Modify: `apps/web/src/components/district-picker.tsx` (only the `getNearestDistrict` call site)
- Modify: `apps/web/src/app/[district]/page.tsx` **only if** it calls `getVenues`/`getNearestDistrict`
  directly (read the file first — confirm whether its server-side call needs a `coords` argument;
  a Server Component cannot access browser geolocation, so if it calls `getVenues`, pass `null` or
  omit the parameter, matching the design doc's confirmation that the first server-side render is
  always `sort: newest` with no coords)
- Test: `packages/api-client/src/index.spec.ts` (new), `apps/web/src/lib/api.spec.ts` (append),
  `apps/web/src/components/venue-filters.spec.tsx` (append), `apps/web/src/components/discovery-client.spec.tsx` (append — one call-site test only), `apps/web/src/components/district-picker.spec.tsx` (append)

**Interfaces:**
- Consumes: nothing new (Plan 4b already defines the header contract)
- Produces: `createApiClient(...).get<T>(path, options?: { headers?: Record<string,string> })`;
  `fetchValidated(path, schema, token?, headers?)`; `locationHeaders(coords?)`;
  `getVenues(query: Record<string,string>, coords?: { lat: number; lng: number } | null, token?: string)`;
  `getNearestDistrict(coords: { lat: number; lng: number }, token?: string)` (coords REQUIRED,
  not optional). Every caller of both functions anywhere in `apps/web` is updated to the new
  signature in this same commit.

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
(Leave `post()` untouched.)
- [ ] **Step 4:** Run — PASS (2 tests).

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

describe("getVenues — sends location header instead of query params", () => {
  it("does not put lat/lng in the query string, sends the exact X-User-Location header instead", async () => {
    const getSpy = vi.spyOn(client, "get").mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });
    await getVenues({ districtId: "d1" }, { lat: 40.99, lng: 29.02 });
    const [pathArg, optionsArg] = getSpy.mock.calls[0];
    expect(pathArg).not.toContain("lat=");
    expect(pathArg).not.toContain("lng=");
    expect(optionsArg).toEqual({ headers: { "X-User-Location": "40.99,29.02" } });
  });

  it("sends no location header when coords is omitted", async () => {
    const getSpy = vi.spyOn(client, "get").mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });
    await getVenues({ districtId: "d1" });
    expect(getSpy.mock.calls[0][1]).toEqual({ headers: {} });
  });
});

describe("getNearestDistrict — coords required, sent via header", () => {
  it("sends the exact X-User-Location value derived from the given coords, no query params", async () => {
    const getSpy = vi.spyOn(client, "get").mockResolvedValue({ id: "d1", name: "Kadıköy", slug: "kadikoy" });
    await getNearestDistrict({ lat: 40.99, lng: 29.02 });
    const [pathArg, optionsArg] = getSpy.mock.calls[0];
    expect(pathArg).toBe("/districts/nearest");
    expect(optionsArg).toEqual({ headers: { "X-User-Location": "40.99,29.02" } });
  });
});
```
(Read the real internal structure of `fetchValidated`/`client` first — if `client.get` isn't
directly spy-able, spy on `global.fetch` instead, same pattern as Step 1. The point is proving the
exact header value reaches the underlying HTTP call — not a placeholder matcher.)
- [ ] **Step 6:** Run — FAIL.
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

export async function getVenues(query: Record<string, string>, coords?: { lat: number; lng: number } | null, token?: string) {
  const qs = new URLSearchParams(query).toString();
  return fetchValidated(`/venues${qs ? `?${qs}` : ""}`, VenueListResponseSchema, token, locationHeaders(coords));
}

export async function getNearestDistrict(coords: { lat: number; lng: number }, token?: string) {
  return fetchValidated("/districts/nearest", DistrictSchema, token, locationHeaders(coords));
}
```
(Read the real current bodies first — preserve any existing query-building nuance, e.g. filtering
empty-value keys before `URLSearchParams` construction, if that already exists.)
- [ ] **Step 8:** Run — PASS.

- [ ] **Step 9: `serializeFilters` stops emitting `lat`/`lng`**
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
(`openNow` is included here now, even though Task 7 is the task that adds the UI toggle for it —
`serializeFilters` is one function, and Task 1 is establishing its complete final shape so Task 7
only needs to add a UI control, not touch this function again. `FilterState`'s `openNow?: boolean`
field is added here too, as a type-only addition — Task 7 adds the actual toggle button.)
Write the failing test first (append to `venue-filters.spec.tsx`):
```typescript
describe("serializeFilters — no longer emits lat/lng, handles openNow", () => {
  it("omits lat/lng even when coords and radiusM are both present", () => {
    const out = serializeFilters({ radiusM: 2000 }, { lat: 40.99, lng: 29.02 });
    expect(out).toEqual({ radiusM: "2000" });
    expect(out.lat).toBeUndefined();
    expect(out.lng).toBeUndefined();
  });

  it("emits openNow=true only when true, omits it entirely when false or undefined", () => {
    expect(serializeFilters({ openNow: true })).toEqual({ openNow: "true" });
    expect(serializeFilters({ openNow: false })).toEqual({});
    expect(serializeFilters({})).toEqual({});
  });
});
```
Run — FAIL, then apply the change above, run — PASS.

- [ ] **Step 10: Update `discovery-client.tsx`'s ONE `getVenues` call site.** Find the current call
      (e.g. inside `applyFilters`), change its second argument to the component's resolved
      `coords`:
```typescript
const { data } = await getVenues({ districtId, ...serializeFilters(next, coords) }, coords);
```
Write the failing test, asserting the exact coords value reaches the mock (not a placeholder
matcher — this closes a Round 2 finding about `expect.anything()`):
```typescript
// discovery-client.spec.tsx (append — ONE call-site test, the state-machine tests are Task 4's job)
describe("DiscoveryClient — getVenues call includes coords", () => {
  it("passes the exact resolved coords as getVenues' second argument", async () => {
    vi.mocked(useGeolocationMock).mockReturnValue({ lat: 40.99, lng: 29.02 }); // match this file's real mock setup once read
    render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe")); // match this file's real existing trigger
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledWith(expect.any(Object), { lat: 40.99, lng: 29.02 }));
  });
});
```
Confirm it fails first (current call passes one argument), then fix, then confirm it passes.

- [ ] **Step 11: Update `district-picker.tsx`'s ONE `getNearestDistrict` call site** — same
      pattern: find the current call, update to pass the single `coords` object with the exact
      value asserted (not `expect.anything()`). Write the failing test, confirm it fails, fix,
      confirm it passes.

- [ ] **Step 12:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`. Confirm every caller
      of `getVenues`/`getNearestDistrict` anywhere in `apps/web` compiles —
      `grep -rn "getVenues\|getNearestDistrict" apps/web/src --include=*.tsx --include=*.ts` and
      check each result by hand, including `[district]/page.tsx`'s server-side call if one exists.
- [ ] **Step 13: Commit**
```bash
git add packages/api-client/src apps/web/src/lib/api.ts apps/web/src/lib/api.spec.ts apps/web/src/components/venue-filters.tsx apps/web/src/components/venue-filters.spec.tsx apps/web/src/components/discovery-client.tsx apps/web/src/components/discovery-client.spec.tsx apps/web/src/components/district-picker.tsx apps/web/src/components/district-picker.spec.tsx apps/web/src/app/\[district\]/page.tsx
git commit -m "feat(web): propagate X-User-Location header through api-client, getVenues/getNearestDistrict, and every direct caller (atomic)"
```

---

## Task 2: `LocationProvider` — single shared coordinate source

**Files:**
- Create: `apps/web/src/lib/location-context.tsx`
- Modify: `apps/web/src/app/[district]/page.tsx` (wrap `DistrictPicker` + `DiscoveryClient` in the provider)
- Modify: `apps/web/src/components/district-picker.tsx` (consume `useLocationContext()` instead of its own `useGeolocation()`)
- Test: `apps/web/src/lib/location-context.spec.tsx` (new), `apps/web/src/components/district-picker.spec.tsx` (append)

**Interfaces:**
- Consumes: `apps/web/src/lib/use-geolocation.ts`'s existing `useGeolocation()` hook (unchanged)
- Produces: `LocationProvider` (React context provider), `useLocationContext()` (returns the same
  `coords` shape `useGeolocation()` already returns — read that file first to confirm its real
  return type/initial value before choosing a sentinel, see Step 2 below). Consumed by Task 4
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
  it("calls the browser geolocation API exactly once total, and both consumers read the same resolved value", () => {
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
    // once; this does NOT mean useGeolocation is never called, it means it's called once, not
    // once per consumer.
    expect(getCurrentPositionSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("a")).toHaveTextContent("40.99,29.02");
    expect(screen.getByTestId("b")).toHaveTextContent("40.99,29.02");
  });
});
```
- [ ] **Step 2:** Run — FAIL (file doesn't exist). Before implementing, read
      `apps/web/src/lib/use-geolocation.ts` in full to confirm its real return type and what it
      returns before the browser resolves a position (this determines the sentinel below — do not
      guess). Create `apps/web/src/lib/location-context.tsx`, following the exact provider pattern
      `apps/web/src/lib/auth-context.tsx` already establishes:
```typescript
"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useGeolocation } from "./use-geolocation";

type LocationContextValue = ReturnType<typeof useGeolocation>;

// useGeolocation()'s own "not yet resolved" value (confirmed by reading the hook) is used as the
// context's default too, so there is no separate "no provider" sentinel to confuse with a real
// unresolved state -- a consumer outside the provider simply behaves as if geolocation hasn't
// resolved yet, rather than throwing.
const LocationContext = createContext<LocationContextValue>(/* the hook's real unresolved value, e.g. null */);

export function LocationProvider({ children }: { children: ReactNode }) {
  const coords = useGeolocation();
  return <LocationContext.Provider value={coords}>{children}</LocationContext.Provider>;
}

export function useLocationContext(): LocationContextValue {
  return useContext(LocationContext);
}
```
- [ ] **Step 3:** Run — PASS.

- [ ] **Step 4: Wire the provider into the district page and migrate `district-picker.tsx`**
Read `apps/web/src/app/[district]/page.tsx`'s real current content, wrap its `DistrictPicker` +
`DiscoveryClient` render in `<LocationProvider>...</LocationProvider>`. Update
`district-picker.tsx`'s `useSuggestedDistrict` (or wherever it currently calls its own
`useGeolocation()`) to call `useLocationContext()` instead. Write the failing test that mocks
`./use-geolocation` and asserts **`district-picker.tsx`'s own module never imports/calls it
directly** (the assertion is scoped to this one file's behavior, not "the hook is never called
anywhere" — `LocationProvider` legitimately calls it once, per Step 1's test):
```typescript
// district-picker.spec.tsx (append)
import * as geolocationModule from "@/lib/use-geolocation";

it("does not call useGeolocation directly -- reads coords from LocationProvider's context instead", () => {
  const spy = vi.spyOn(geolocationModule, "useGeolocation");
  render(
    <LocationProvider>
      <DistrictPicker />
    </LocationProvider>,
  );
  // useGeolocation is called once by LocationProvider itself (proven in location-context.spec.tsx);
  // this test only proves DistrictPicker doesn't ALSO call it, which would mean two independent
  // instances instead of one shared value.
  expect(spy).toHaveBeenCalledTimes(1);
});
```
Confirm it fails against the pre-migration code (which would show 2 calls: `LocationProvider`'s
plus `DistrictPicker`'s own), migrate, confirm it passes (1 call, `LocationProvider`'s only).

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
- Consumes: nothing new
- Produces: `auth-context.tsx` no longer throws unhandled on `getSession()` rejection;
  `FavoriteButton` checks real favorite state on mount (awaited before allowing interaction) and
  disables itself mid-toggle-request; `AuthForm` disables its submit button while a request is in
  flight.

- [ ] **Step 1 (C1): Write the failing test using a real, visible signal — not a placeholder hook**
Read `auth-context.tsx` first to find its real exposed loading signal (e.g. a `loading` value from
`useAuth()`, or a data-testid on a loading UI element somewhere that consumes it). Do not invent a
`useAuthLoadingState()` that doesn't exist in this codebase.
```typescript
// auth-context.spec.tsx (append)
describe("AuthProvider — getSession() failure", () => {
  it("does not throw and settles to a loaded state when getSession() rejects", async () => {
    vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error("network down"));
    function Probe() {
      const { loading } = useAuth(); // replace `loading` with this file's real field name once read
      return <div data-testid="loading-state">{String(loading)}</div>;
    }
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("loading-state")).toHaveTextContent("false"));
  });
});
```
Run — FAIL (read the real current `useEffect` body first; confirm `.catch()` is genuinely absent —
this test also fails today via an unhandled promise rejection under Vitest, which is itself part of
the proof). Add `.catch(() => setLoading(false))` (matching the real state-setter's name) to the
`getSession()` promise chain. Run — PASS.

- [ ] **Step 2 (C11): Write the failing test**
```typescript
// favorite-button.spec.tsx (append)
describe("FavoriteButton — real state check and disabled-while-pending", () => {
  it("reflects the venue's real favorite status from GET /me/lists on mount", async () => {
    getMyListsMock.mockResolvedValue([{ id: "l1", name: "Default", venueIds: ["v1"] }]);
    render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByTestId("favorite-button")).toHaveAttribute("aria-pressed", "true"));
  });

  it("disables itself while a toggle request is in flight, after the initial mount-time check resolves", async () => {
    getMyListsMock.mockResolvedValue([{ id: "l1", name: "Default", venueIds: [] }]);
    let resolveToggle: () => void;
    toggleFavoriteMock.mockReturnValue(new Promise<void>((resolve) => { resolveToggle = resolve; }));
    render(<FavoriteButton venueId="v1" />);
    // wait for the mount-time GET /me/lists check to resolve BEFORE interacting, so the toggle
    // click doesn't race the initial state fetch.
    await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("favorite-button"));
    expect(screen.getByTestId("favorite-button")).toBeDisabled();
    resolveToggle!();
    await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled());
  });
});
```
(Match mock names/shapes to what `favorite-button.spec.tsx` already establishes.)
Run — FAIL. Read the real current component, add a mount-time fetch of the user's lists (only if
`useAuth().user` is truthy) to determine initial pressed state — disabled until this initial fetch
resolves too — and a `pending` state set `true` on click / `false` in a `finally`, with
`disabled={pending || initialCheckPending}`. Run — PASS.

- [ ] **Step 3 (C12): Write the failing test with valid form data so native HTML validation doesn't
      block the async handler before it's ever exercised**
```typescript
// auth-form.spec.tsx (append)
describe("AuthForm — disabled while submitting", () => {
  it("disables the submit button until the request resolves", async () => {
    let resolveSignIn: () => void;
    signInMock.mockReturnValue(new Promise<void>((resolve) => { resolveSignIn = resolve; }));
    render(<AuthForm mode="sign-in" />);
    fireEvent.change(screen.getByLabelText(/e-posta/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/şifre/i), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /giriş/i }));
    expect(screen.getByRole("button", { name: /giriş/i })).toBeDisabled();
    resolveSignIn!();
    await waitFor(() => expect(screen.getByRole("button", { name: /giriş/i })).not.toBeDisabled());
  });
});
```
(Match the real field labels — read the current file first.) Run — FAIL. Add a `submitting` state,
`true` on submit start, `false` in a `finally`, `disabled={submitting}` on the submit button. Run — PASS.

- [ ] **Step 4:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 5: Commit**
```bash
git add apps/web/src/lib/auth-context.tsx apps/web/src/lib/auth-context.spec.tsx apps/web/src/components/favorite-button.tsx apps/web/src/components/favorite-button.spec.tsx apps/web/src/components/auth-form.tsx apps/web/src/components/auth-form.spec.tsx
git commit -m "fix(web): handle getSession() failure, real favorite-button state + disabled-while-pending, disable auth-form while submitting"
```

---

## Task 4: Discovery experience — state machine, map centering, category quick-route (C2, C3, C6, C8, C13, C14) — atomic

Round 2's central finding: splitting `DiscoveryClient`'s state machine (loading/error/auto-sort),
`VenueMapLeaflet`'s new center props, and `CategoryQuickRoute`'s new prop contract across separate
tasks recreated the exact producer/consumer contradiction the plan-red-team already caught once.
All three are genuinely interdependent — `DiscoveryClient` both produces the props
`CategoryQuickRoute` consumes and the props `VenueMapLeaflet` consumes, in the same render — so
this is now one task, landing together in one commit.

**Files:**
- Create: `apps/web/src/lib/district-centers.ts`
- Create: `apps/web/src/lib/directions.ts`
- Modify: `apps/web/src/components/discovery-client.tsx`
- Modify: `apps/web/src/components/venue-map-leaflet.tsx`
- Modify: `apps/web/src/components/category-quick-route.tsx`
- Modify: `apps/web/src/app/[district]/page.tsx` (resolve `center`/`districtName` from the district
  list this Server Component already fetches, pass both as props into `DiscoveryClient`)
- Test: `apps/web/src/lib/district-centers.spec.ts` (new), `apps/web/src/lib/directions.spec.ts`
  (new), `apps/web/src/components/discovery-client.spec.tsx` (append), `apps/web/src/components/venue-map-leaflet.spec.tsx` (append), `apps/web/src/components/category-quick-route.spec.tsx` (append)

**Interfaces:**
- Consumes: Task 1's `getVenues(query, coords, token?)` (already wired at this file's one call
  site); Task 2's `useLocationContext()`.
- Produces (all defined AND consumed in this one task, closing Round 2's Task-4/Task-9 gap):
  `DISTRICT_CENTERS`/`DEFAULT_CENTER`; `directionsUrl(venueName, districtName)`; `VenueMapLeaflet`
  takes `centerLat`/`centerLng` props; `DiscoveryClient` takes `districtName: string` and
  `centerLat`/`centerLng` props (from `[district]/page.tsx`, resolved in this task); `DiscoveryClient`
  tracks `sortedByDistance: boolean` state (true only immediately after a successful coords-driven
  fetch, false otherwise — NOT `Boolean(coords)`) and passes `venues`/`districtName`/`sortedByDistance`
  to `CategoryQuickRoute`, whose `onSelectCategory` is `(category: string | undefined) => void` from
  its first introduction in this task.

- [ ] **Step 1: `DISTRICT_CENTERS` — write the failing test**
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
  it("has a numeric default fallback for an unknown slug", () => {
    expect(DEFAULT_CENTER).toEqual({ lat: expect.any(Number), lng: expect.any(Number) });
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

- [ ] **Step 4: `directionsUrl` — write the failing test**
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
- [ ] **Step 5:** Run — FAIL, then create `apps/web/src/lib/directions.ts`:
```typescript
export function directionsUrl(venueName: string, districtName: string): string {
  const query = encodeURIComponent(`${venueName} ${districtName}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}
```
Read `venue-detail.tsx`'s current local `directionsUrl` implementation — if one exists there
already, replace it with an import from this new shared file (do not leave two implementations).
Run its existing tests to confirm no regression. Run this new test — PASS.

- [ ] **Step 6: `VenueMapLeaflet`'s `centerLat`/`centerLng` props — write the failing test**
```typescript
// venue-map-leaflet.spec.tsx (append)
describe("VenueMapLeaflet — centerLat/centerLng and marker accessibility", () => {
  it("passes centerLat/centerLng through to the map container's center", () => {
    render(<VenueMapLeaflet venues={[]} centerLat={40.9906} centerLng={29.0274} />);
    expect(screen.getByTestId("map-container")).toHaveAttribute("data-center", "40.9906,29.0274");
  });

  it("gives each marker an aria-label with the venue's name (C14)", () => {
    render(<VenueMapLeaflet venues={[{ id: "v1", name: "Cafe Test", lat: 40.99, lng: 29.02 }]} centerLat={40.99} centerLng={29.02} />);
    expect(screen.getByLabelText("Cafe Test")).toBeInTheDocument();
  });
});
```
(Check the real current spec file's mocking pattern for `react-leaflet`'s `MapContainer` before
writing the center-prop assertion — match that existing mock shape.) Run — FAIL. Add `centerLat`/
`centerLng` props (the current signature likely takes `venues` only), pass into
`<MapContainer center={[centerLat, centerLng]} ...>`, add `aria-label={venue.name}` to each
`CircleMarker`. Run — PASS.

- [ ] **Step 7: `CategoryQuickRoute`'s full prop contract — write the failing test, defined and
      consumed together with `DiscoveryClient` in this same task**

`CategoryQuickRoute` is a CONTROLLED component (its `activeCategory` is a prop from the parent —
confirm by reading the current file). The test below reflects that: the directions link appears
only AFTER the parent re-renders with the updated `activeCategory` prop, not synchronously.
```typescript
// category-quick-route.spec.tsx (append)
describe("CategoryQuickRoute — full prop contract (controlled component)", () => {
  const venues = [{ id: "v1", name: "First Cafe", category: "cafe" }, { id: "v2", name: "Second Cafe", category: "cafe" }];

  it("calls onSelectCategory(category) on click, then renders a directions link once the parent re-renders with the new activeCategory, labeled 'En yakın' when sortedByDistance is true", () => {
    const onSelectCategory = vi.fn();
    const { rerender } = render(<CategoryQuickRoute venues={venues} districtName="Kadıköy" sortedByDistance onSelectCategory={onSelectCategory} activeCategory={undefined} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    expect(onSelectCategory).toHaveBeenCalledWith("cafe");
    rerender(<CategoryQuickRoute venues={venues} districtName="Kadıköy" sortedByDistance onSelectCategory={onSelectCategory} activeCategory="cafe" />);
    const link = screen.getByRole("link", { name: /en yakın cafe mekana git/i });
    expect(link).toHaveAttribute("href", expect.stringContaining(encodeURIComponent("First Cafe Kadıköy")));
  });

  it("uses neutral copy (not 'en yakın') when sortedByDistance is false, even if the browser has resolved coords", () => {
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
- [ ] **Step 8:** Run — FAIL. Update `CategoryQuickRoute`'s props to
      `{ venues: VenueListItem[]; districtName: string; sortedByDistance: boolean; onSelectCategory: (category: string | undefined) => void; activeCategory?: string }`.
      Click handler: `onSelectCategory(activeCategory === category ? undefined : category)`.
      When `activeCategory` matches a real category and at least one venue in `venues` has that
      category, render a directions link using `directionsUrl(matchingVenue.name, districtName)`,
      label text `` sortedByDistance ? `En yakın ${label} mekana git` : `${label} mekana git` ``.
      Run — PASS.

- [ ] **Step 9: `DiscoveryClient`'s complete state machine — write the failing tests, then implement**

First, replace this file's existing `useGeolocation()` call with `useLocationContext()` (from Task
2), updating this file's test mocks accordingly.

```typescript
// discovery-client.spec.tsx (append)
describe("DiscoveryClient — loading, error, and stale-response discarding (C2)", () => {
  it("shows a loading indicator while a request is in flight and an error message on failure", async () => {
    getVenuesMock.mockRejectedValueOnce(new Error("500"));
    render(<DiscoveryClient districtId="d1" districtName="Kadıköy" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/hata/i));
  });

  it("ignores a slow first response if a second request has already started", async () => {
    let resolveFirst: (v: unknown) => void;
    getVenuesMock
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ data: [{ id: "v2", name: "Second" }], meta: { next_cursor: null, has_more: false } });
    render(<DiscoveryClient districtId="d1" districtName="Kadıköy" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    fireEvent.click(screen.getByTestId("quick-category-bakery"));
    await waitFor(() => expect(screen.getByText("Second")).toBeInTheDocument());
    resolveFirst!({ data: [{ id: "v1", name: "First" }], meta: { next_cursor: null, has_more: false } });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText("First")).not.toBeInTheDocument();
  });
});

describe("DiscoveryClient — sortedByDistance reflects the actual displayed list, not just coords presence", () => {
  it("is false before coords resolve, true immediately after the resulting auto-fetch succeeds", async () => {
    vi.mocked(useLocationContextMock).mockReturnValue(null);
    const { rerender } = render(<DiscoveryClient districtId="d1" districtName="Kadıköy" initialVenues={[]} />);
    expect(screen.getByTestId("category-quick-route")).toHaveAttribute("data-sorted-by-distance", "false");
    vi.mocked(useLocationContextMock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    getVenuesMock.mockResolvedValueOnce({ data: [{ id: "v1", name: "X" }], meta: { next_cursor: null, has_more: false } });
    rerender(<DiscoveryClient districtId="d1" districtName="Kadıköy" initialVenues={[]} />);
    await waitFor(() => expect(screen.getByTestId("category-quick-route")).toHaveAttribute("data-sorted-by-distance", "true"));
  });

  it("stays false if the user changes a filter before coords resolve, even once coords later resolve (C8's guard)", async () => {
    vi.mocked(useLocationContextMock).mockReturnValue(null);
    render(<DiscoveryClient districtId="d1" districtName="Kadıköy" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("category-quick-route")).toHaveAttribute("data-sorted-by-distance", "false");
  });

  it("resets to false if a coords-driven fetch fails (the old list, not distance-sorted, stays on screen)", async () => {
    vi.mocked(useLocationContextMock).mockReturnValue(null);
    const { rerender } = render(<DiscoveryClient districtId="d1" districtName="Kadıköy" initialVenues={[{ id: "v0", name: "Initial" }]} />);
    vi.mocked(useLocationContextMock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    getVenuesMock.mockRejectedValueOnce(new Error("500"));
    rerender(<DiscoveryClient districtId="d1" districtName="Kadıköy" initialVenues={[{ id: "v0", name: "Initial" }]} />);
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("category-quick-route")).toHaveAttribute("data-sorted-by-distance", "false");
  });
});

describe("DiscoveryClient — one-time auto-sort effect fires exactly once and respects prior user interaction", () => {
  it("auto-refetches with resolved coords exactly once via rerender, not again on a further unrelated rerender", async () => {
    vi.mocked(useLocationContextMock).mockReturnValue(null);
    const { rerender } = render(<DiscoveryClient districtId="d1" districtName="Kadıköy" initialVenues={[]} />);
    vi.mocked(useLocationContextMock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    rerender(<DiscoveryClient districtId="d1" districtName="Kadıköy" initialVenues={[]} />);
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledWith(expect.any(Object), { lat: 40.99, lng: 29.02 }));
    expect(getVenuesMock).toHaveBeenCalledTimes(1);
    rerender(<DiscoveryClient districtId="d1" districtName="Kadıköy" initialVenues={[]} />);
    expect(getVenuesMock).toHaveBeenCalledTimes(1); // no extra call from an unrelated rerender
  });

  it("does not auto-refetch if the user already changed a filter before coords resolved (same component instance, via rerender)", async () => {
    vi.mocked(useLocationContextMock).mockReturnValue(null);
    const { rerender } = render(<DiscoveryClient districtId="d1" districtName="Kadıköy" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledTimes(1));
    vi.mocked(useLocationContextMock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    rerender(<DiscoveryClient districtId="d1" districtName="Kadıköy" initialVenues={[]} />); // rerender, NOT a fresh render -- refs must persist
    await new Promise((r) => setTimeout(r, 0));
    expect(getVenuesMock).toHaveBeenCalledTimes(1); // still just the user's own request, refs weren't reset by a remount
  });
});

describe("DiscoveryClient — remounts VenueMapLeaflet when districtId changes (proves the key prop actually forces a remount)", () => {
  it("re-fires VenueMapLeaflet's mount-only effect when districtId changes, proving a real remount not just a prop update", () => {
    const mountLog: string[] = [];
    vi.mock("./venue-map-leaflet", () => ({
      VenueMapLeaflet: (props: { centerLat: number }) => {
        useEffect(() => { mountLog.push(String(props.centerLat)); }, []); // mount-only effect
        return <div data-testid="map-container" />;
      },
    }));
    const { rerender } = render(<DiscoveryClient districtId="kadikoy" districtName="Kadıköy" centerLat={40.9906} centerLng={29.0274} initialVenues={[]} />);
    expect(mountLog).toEqual(["40.9906"]);
    rerender(<DiscoveryClient districtId="besiktas" districtName="Beşiktaş" centerLat={41.0422} centerLng={29.0061} initialVenues={[]} />);
    // if VenueMapLeaflet were rendered without key={districtId}, this mount-only effect would NOT
    // re-run on a mere prop update -- mountLog would still have only one entry. A second entry
    // proves React actually unmounted and remounted the component, which only happens because the
    // key changed.
    expect(mountLog).toEqual(["40.9906", "41.0422"]);
  });
});
```
(Adjust `data-testid`s and mock names to this file's real established patterns once read — the
`vi.mock` for `venue-map-leaflet` in the last test may need to be hoisted to the top of the file
per Vitest's mocking rules; place it there if the inline version doesn't work.) Run all of the
above — FAIL (none of this state exists yet).

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
// The onChange passed to VenueFilters also sets userInteractedRef.current = true before calling applyFilters(next, coords).

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
<VenueMapLeaflet key={districtId} venues={venues} centerLat={centerLat} centerLng={centerLng} />
<CategoryQuickRoute
  data-testid="category-quick-route"
  venues={venues}
  districtName={districtName}
  sortedByDistance={sortedByDistance}
  onSelectCategory={handleQuickCategory}
  activeCategory={filters.category}
/>
```
(The `data-testid`/`data-sorted-by-distance` attribute used in Step 9's tests should be added to
`CategoryQuickRoute`'s own root element in Step 8 — pass `sortedByDistance` through to a
`data-sorted-by-distance={String(sortedByDistance)}` attribute there, since that's the component
actually rendering it; adjust Step 9's tests to query through `CategoryQuickRoute`'s real rendered
DOM once both pieces are wired together in this same task, not two different components disagreeing
on where the test hook lives.)
- [ ] **Step 11:** Run — PASS.

- [ ] **Step 12: Wire `[district]/page.tsx` to resolve and pass `districtName`/`centerLat`/`centerLng`**
Read the page's real current content (a Server Component that already calls `getDistricts()`).
Find the current district's name from that existing list by matching the route's slug param (no
new API call needed — the page already fetches the district list):
```typescript
import { DISTRICT_CENTERS, DEFAULT_CENTER } from "@/lib/district-centers";
// ...
const districts = await getDistricts(); // however this file already calls it
const currentDistrict = districts.find((d) => d.slug === params.district);
const center = DISTRICT_CENTERS[params.district] ?? DEFAULT_CENTER;
// <DiscoveryClient districtId={currentDistrict?.id ?? params.district} districtName={currentDistrict?.name ?? params.district} centerLat={center.lat} centerLng={center.lng} initialVenues={...} />
```
- [ ] **Step 13:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`. This whole task's test
      suite is the single, coherent acceptance gate for the entire discovery experience — no later
      task should need to touch `discovery-client.tsx`'s internals, `VenueMapLeaflet`'s props, or
      `CategoryQuickRoute`'s prop contract again.
- [ ] **Step 14: Commit**
```bash
git add apps/web/src/lib/district-centers.ts apps/web/src/lib/district-centers.spec.ts apps/web/src/lib/directions.ts apps/web/src/lib/directions.spec.ts apps/web/src/components/discovery-client.tsx apps/web/src/components/discovery-client.spec.tsx apps/web/src/components/venue-map-leaflet.tsx apps/web/src/components/venue-map-leaflet.spec.tsx apps/web/src/components/category-quick-route.tsx apps/web/src/components/category-quick-route.spec.tsx apps/web/src/app/\[district\]/page.tsx apps/web/src/components/venue-detail.tsx
git commit -m "feat(web): discovery experience -- state machine (loading/error/race handling), fixed map centers with remount-on-navigation, real sortedByDistance tracking, category quick-route deep link, aria-live loading state"
```

---

## Task 5: Venue detail completeness (C4, C9, C10)

**Files:**
- Modify: `apps/web/src/components/venue-detail.tsx`
- Modify: `apps/web/src/components/venue-card.tsx`
- Test: `apps/web/src/components/venue-detail.spec.tsx` (append), `apps/web/src/components/venue-card.spec.tsx` (append)

**Interfaces:**
- Consumes: Plan 4b's `VenueDetailSchema` (`lat`/`lng`/`address`/`photos`); Task 4's
  `VenueMapLeaflet` (no new prop — reuses the existing multi-marker path with a one-item array,
  `[{ id: venue.id, name: venue.name, lat: venue.lat, lng: venue.lng, category: venue.category }]`)
  and Task 4's shared `directionsUrl` (already extracted there, imported here — not redefined).
- Produces: address/map/photos rendering; SSR-safe native share button; `venue-card.tsx`'s Google
  badge text handles both `null` and `undefined` count.

- [ ] **Step 1: Write the failing test for address/map/photos**
```typescript
// venue-detail.spec.tsx (append)
describe("VenueDetail — address, real map, photo grid", () => {
  const baseVenue = { /* existing test fixture, extended with: */ address: "Bahariye Cd. No:1", lat: 40.99, lng: 29.02, photos: ["https://x/1.jpg", "https://x/2.jpg"] };

  it("renders the venue's address when present", () => {
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.getByText("Bahariye Cd. No:1")).toBeInTheDocument();
  });

  it("does not render an address section when address is null", () => {
    render(<VenueDetail venue={{ ...baseVenue, address: null }} />);
    expect(screen.queryByTestId("venue-address")).not.toBeInTheDocument();
  });

  it("renders the map centered on the venue's real coordinates with one marker", () => {
    render(<VenueDetail venue={baseVenue} />);
    expect(screen.getByTestId("map-container")).toHaveAttribute("data-center", "40.99,29.02");
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
- [ ] **Step 2:** Run — FAIL (read the real current file first). Implement: conditionally render
      `venue.address` in a labeled block (`data-testid="venue-address"`); replace whatever
      placeholder sits where the map should be with:
```tsx
<VenueMapLeaflet
  venues={[{ id: venue.id, name: venue.name, lat: venue.lat, lng: venue.lng, category: venue.category }]}
  centerLat={venue.lat}
  centerLng={venue.lng}
/>
```
Render a photo grid (`<img key={i} src={url} alt={`${venue.name} fotoğrafı ${i + 1}`} />` for each)
when `venue.photos.length > 0`, else the empty-state text.
- [ ] **Step 3:** Run — PASS.

- [ ] **Step 4: Write the failing test for the SSR-safe native share button**
```typescript
describe("VenueDetail — native share button (client-only, SSR-safe)", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });

  it("renders a share button once mounted, when navigator.share is a real function", async () => {
    Object.defineProperty(navigator, "share", { value: vi.fn(), configurable: true });
    render(<VenueDetail venue={baseVenue} />);
    await waitFor(() => expect(screen.getByTestId("native-share-button")).toBeInTheDocument());
  });

  it("never renders a share button when navigator.share is undefined (the check must test the value's type, not `in`, since `in` is true even for an own property set to undefined)", async () => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    render(<VenueDetail venue={baseVenue} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId("native-share-button")).not.toBeInTheDocument();
  });
});
```
Run — FAIL, then implement with a `useState` + `useEffect`, checking the value's type rather than
`"share" in navigator` (which is true for an own property whose value happens to be `undefined`):
```typescript
const [canShare, setCanShare] = useState(false);
useEffect(() => {
  setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
}, []);
// ... {canShare && <button data-testid="native-share-button" onClick={() => navigator.share({ title: venue.name, url: window.location.href })}>...</button>}
```
matching `whatsapp-share-button.tsx`'s existing visual pattern. Run — PASS.

- [ ] **Step 5: Write the failing test for the Google badge text — handling both `null` and `undefined`**
```typescript
// venue-card.spec.tsx (append)
describe("VenueCard — Google rating badge text", () => {
  it("shows '4.3 ★ · 120 Google yorumu' when a count is present", () => {
    render(<VenueCard venue={{ ...baseVenue, googleRating: 4.3, googleRatingCount: 120 }} />);
    expect(screen.getByText(/4\.3 ★ · 120 Google yorumu/)).toBeInTheDocument();
  });
  it("shows '4.3 ★ · Google yorumu' (no count number) when googleRatingCount is null", () => {
    render(<VenueCard venue={{ ...baseVenue, googleRating: 4.3, googleRatingCount: null }} />);
    expect(screen.getByText(/4\.3 ★ · Google yorumu/)).toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
  });
  it("shows '4.3 ★ · Google yorumu' (no count number) when googleRatingCount is undefined", () => {
    render(<VenueCard venue={{ ...baseVenue, googleRating: 4.3, googleRatingCount: undefined }} />);
    expect(screen.getByText(/4\.3 ★ · Google yorumu/)).toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
  });
});
```
Run — FAIL. Update the badge markup, using `!= null` (loose equality — deliberately catches both
`null` and `undefined` in one check) rather than `!== null`:
```tsx
<span>{venue.googleRating.toFixed(1)} ★ · {venue.googleRatingCount != null ? `${venue.googleRatingCount} ` : ""}Google yorumu</span>
```
Run — PASS.

- [ ] **Step 6:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 7: Commit**
```bash
git add apps/web/src/components/venue-detail.tsx apps/web/src/components/venue-detail.spec.tsx apps/web/src/components/venue-card.tsx apps/web/src/components/venue-card.spec.tsx
git commit -m "feat(web): venue detail shows address/real single-marker map/photo grid + SSR-safe native share button, venue-card Google badge handles null and undefined count"
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
- Modify: `apps/web/src/app/favoriler/page.tsx` (read first to determine whether this is currently
  a Server or Client Component — if Server, it keeps fetching `initialLists` server-side and
  renders a new Client Component below for the interactive parts, since list-creation/switching
  needs local state and an event handler, which a Server Component cannot have)
- Create: `apps/web/src/components/favorites-manager.tsx` (Client Component, only if `page.tsx`
  turns out to be a Server Component per the check above — owns the create-list form + tab
  switcher + selected list's venues; skip creating this file and put the logic directly in
  `page.tsx` if it's already a Client Component)
- Modify: `apps/web/src/lib/api.ts` (add a `createList`/`POST /me/lists` helper if one doesn't already exist — check first)
- Modify: `apps/web/src/components/venue-filters.tsx`
- Test: corresponding `.spec.tsx` files (new/append)

**Interfaces:**
- Consumes: `POST /me/lists` (backend endpoint — confirm it exists); Task 1's `serializeFilters`
  (already handles `openNow` from Task 1, this task only adds the toggle UI); Plan 4b's
  `OptionalTrueFlag` pattern.
- Produces: a "create new list" form + a working switcher between multiple lists on the favorites
  page; an `openNow` toggle in `VenueFilters`; `serializeFilters`'s boutique output only ever emits
  `"true"`, never `"false"`.

- [ ] **Step 1: Write the failing test for the boutique toggle fix** (most urgent — Plan 4b's
      schema rejects `isBoutique=false` with 400, and the current toggle can produce exactly that)
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
- [ ] **Step 2:** Run — FAIL (current logic: `update({ isBoutique: !filters.isBoutique })`).
      Change to: `onClick={() => update({ isBoutique: filters.isBoutique ? undefined : true })}`.
- [ ] **Step 3:** Run — PASS.

- [ ] **Step 4: Write the failing test for the `openNow` toggle UI**
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
Run — FAIL. Add a toggle button matching the boutique toggle's exact true/undefined pattern
(`FilterState.openNow` and `serializeFilters`'s handling of it were already added in Task 1 — this
step only adds the button UI, no further change to `serializeFilters`). Run — PASS.

- [ ] **Step 5: Confirm/add the `createList` API helper**
Check `apps/web/src/lib/api.ts` for an existing `createList`/`POST /me/lists` function. If absent,
add:
```typescript
export async function createList(name: string, token: string) {
  const authedClient = createApiClient(API_BASE, () => token);
  return authedClient.post("/me/lists", { name });
}
```
(Match the exact response schema this endpoint returns — check `packages/shared` for a
`FavoriteListSchema` or similar, following this file's established pattern for POST calls.)

- [ ] **Step 6: Determine `favoriler/page.tsx`'s Server/Client boundary before writing the UI test**
Read the file. If it is already a Client Component (has `"use client"` at the top), the
create-list/switching logic goes directly in it. If it is a Server Component, create
`favorites-manager.tsx` as a `"use client"` component that receives `initialLists` as a prop from
`page.tsx` (the server-side fetch stays in `page.tsx`; only the interactive list-management UI
moves to the new client component).

- [ ] **Step 7: Write the failing test for creating AND switching between lists, matching `createList`'s real two-argument signature**
```typescript
// favorites-manager.spec.tsx (new, or favoriler/page.spec.tsx if page.tsx stays a client component — match Step 6's finding)
describe("Favorites — create and switch between lists", () => {
  it("submits a new list name via createList(name, token) and shows it as a selectable option", async () => {
    createListMock.mockResolvedValue({ id: "l2", name: "Kadıköy Kahveleri", venues: [] });
    render(<FavoritesManager initialLists={[{ id: "l1", name: "Default", venues: [{ id: "v1", name: "Cafe A" }] }]} />);
    fireEvent.change(screen.getByLabelText(/liste adı/i), { target: { value: "Kadıköy Kahveleri" } });
    fireEvent.click(screen.getByRole("button", { name: /oluştur/i }));
    await waitFor(() => expect(createListMock).toHaveBeenCalledWith("Kadıköy Kahveleri", expect.any(String)));
    expect(await screen.findByRole("tab", { name: "Kadıköy Kahveleri" })).toBeInTheDocument();
  });

  it("shows the selected list's venues when switching tabs, not the previously active list's", () => {
    render(<FavoritesManager initialLists={[
      { id: "l1", name: "Default", venues: [{ id: "v1", name: "Cafe A" }] },
      { id: "l2", name: "Kadıköy Kahveleri", venues: [{ id: "v2", name: "Cafe B" }] },
    ]} />);
    expect(screen.getByText("Cafe A")).toBeInTheDocument();
    expect(screen.queryByText("Cafe B")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Kadıköy Kahveleri" }));
    expect(screen.getByText("Cafe B")).toBeInTheDocument();
    expect(screen.queryByText("Cafe A")).not.toBeInTheDocument();
  });
});
```
Run — FAIL. Implement per Step 6's finding: a name input + submit button calling
`createList(name, token)` (token from `useAuth()`), appending the new list to local state on
success; a tab list (`role="tab"` per list) with `activeListId` state, rendering only the active
list's venues. Run — PASS.

- [ ] **Step 8:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 9: Commit**
```bash
git add apps/web/src/app/favoriler apps/web/src/components/favorites-manager.tsx apps/web/src/lib/api.ts apps/web/src/lib/api.spec.ts apps/web/src/components/venue-filters.tsx apps/web/src/components/venue-filters.spec.tsx
git commit -m "feat(web): favorites collection creation + multi-list switching UI, open-now filter toggle, fix boutique toggle for Plan 4b's OptionalTrueFlag schema"
```

---

## Task 8: Code-quality cleanup — category labels consolidation

**Files:**
- Create: `apps/web/src/lib/category-labels.ts`
- Modify: `apps/web/src/components/venue-card.tsx`, `venue-detail.tsx`, `category-quick-route.tsx`
- Test: `apps/web/src/lib/category-labels.spec.ts` (new)

**Interfaces:** Consumes nothing new. Produces `CATEGORY_LABELS` (real backend taxonomy, dropping
`venue-detail.tsx`'s stale extra keys `kahvalti`/`kahve`/`tatli`), consumed by all three components.

- [ ] **Step 1: Write the failing test**
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
- [ ] **Step 2:** Run — FAIL. Create `apps/web/src/lib/category-labels.ts`, moving the correct
      (non-stale) label set currently in `venue-card.tsx` into this new file, exported as
      `CATEGORY_LABELS`. Update `venue-card.tsx`, `venue-detail.tsx` (deleting its separate stale
      local copy), and `category-quick-route.tsx` to import from this one shared file.
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
      1. Visit each of the three district pages, confirm the map opens centered correctly for
         each, and navigating between districts actually re-centers the map.
      2. Grant location permission, confirm the venue list auto-sorts to distance exactly once
         and the category quick-route buttons show "En yakın ... git" links only once the
         auto-sorted (or a later coords-driven) fetch has actually succeeded.
      3. Deny location permission, confirm manual district browsing still works fully, quick-route
         buttons show neutral (non-"en yakın") copy.
      4. Open a venue detail page, confirm address/map/photos (or empty state) render, and the
         native share button appears only on a browser/device that actually supports it.
      5. In the favorites page, create a second list and confirm switching between the two shows
         each list's own venues.
      6. In the admin panel, open the curation queue, confirm the approve button's new copy.
- [ ] **Step 5:** Update `docs/STATE.md` and `docs/SESSION-LOG-2026-07-26.md`: Plan 4c complete,
      ready for the final whole-branch review (Superpowers reviewer + mandatory `cross-model-review`).
- [ ] **Step 6: Commit**
```bash
git add docs/STATE.md docs/SESSION-LOG-2026-07-26.md
git commit -m "docs: Plan 4c complete, ready for final whole-branch review"
```

---

## Self-Review Notes (round 3, after round 2's second YENİDEN BÖL)

- **The Task 4/Task 9 contradiction (the same bug class as round 1's Task 1/Task 2) is resolved**
  by merging the discovery state machine, map centering, and category quick-route completion into
  one atomic task (new Task 4) — no task is ever asked to compile against a prop contract a later
  task hasn't defined yet.
- **`districtName` now has an explicit wiring step** (Task 4, Step 12) reading it from the district
  list `[district]/page.tsx` already fetches, not assumed to already exist.
- **`sortedByDistance` replaces `Boolean(coords)`/`coordsAvailable`** — it's real component state,
  set `true` only immediately after a successful coords-driven fetch and reset to `false` on a
  failed fetch or a user-initiated filter change before coords resolved, so the "En yakın" label
  only ever describes what's actually on screen.
- **The remount-key test now renders `DiscoveryClient` itself** with a mount-tracking effect on the
  mocked `VenueMapLeaflet`, proving a real unmount+remount fires on `districtId` change — not a
  hardcoded `key` in the test's own JSX that would pass regardless of production wiring.
- **`createList`'s test now matches its own two-argument signature** (`name`, `token`).
- **C10 uses `!= null`**, explicitly tested against both `null` and `undefined`.
- **The native-share test now toggles a real function vs. `undefined` and the implementation
  checks `typeof navigator.share === "function"`**, not `"share" in navigator` (which was always
  `true` for an own property set to `undefined`, making the old test unable to fail against the bug
  it was meant to catch).
- **`LocationProvider`'s test and sentinel are no longer self-contradictory** — the test asserts
  exactly one total call across two consumers (not "never called"), and the context's default
  value is the hook's own real "unresolved" value (read from the actual file before choosing),
  not a thrown error on `undefined`.
- **The "no auto-refetch after user interaction" test now uses `rerender()`**, preserving the same
  component instance's refs, instead of a fresh `render()` that would reset them and invalidate the
  assertion.
- **Task 1's call-site tests assert the exact coords value**, not `expect.anything()`.
- **The favorites page's Server/Client Component boundary is explicitly checked** (Task 7, Step 6)
  before the interactive UI is built, with a `FavoritesManager` client component split out if the
  page turns out to be a Server Component.
- **Task 9 (final regression)'s file header lists the two real doc files it modifies**, removing
  the earlier "Files: none" self-contradiction.
