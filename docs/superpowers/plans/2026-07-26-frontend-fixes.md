# GurmeGo — Plan 4c: Frontend/Admin Kritik Düzeltmeler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every frontend/admin finding from `docs/AUDIT-2026-07-26.md`, per
`docs/superpowers/specs/2026-07-26-frontend-fixes-design.md` (HAZIR after 5 idea-red-team rounds).

## Round 1 plan-red-team (Codex, YENİDEN BÖL) — uygulandı

Round 1's core finding: the exact class of bug Plan 4b's plan-red-team caught three times
recurred here — Task 1 claimed to atomically update every direct caller of the new `getVenues`/
`getNearestDistrict` signatures, but Task 2 then claimed ownership of those same call sites as a
separate task, a direct contradiction. Separately, `discovery-client.tsx` was touched by six
different tasks (2, 3, 4, 8, 9, 10) whose changes all mutate the same `applyFilters`/`coords`/
effect-dependency state machine — not independent additions, genuinely interdependent, causing
several tests to depend on behavior a LATER task hadn't implemented yet. Plus concrete bugs:
C10's test contradicted the design doc's own stated intent; `singlePoint` was an underspecified
prop instead of reusing the existing multi-marker rendering path; `CategoryQuickRoute`'s
`onSelectCategory(category: string)` signature couldn't express "deselect" (`undefined`); the
native-share check had no SSR-safety; the React-Leaflet remount claim had no test proving it;
Task 11's `Files: none` header contradicted its own doc-update requirement.

**Fixed in this revision:**
- Task 1 (API client + header propagation) now owns EVERY direct caller (`discovery-client.tsx`'s
  `getVenues` call, `district-picker.tsx`'s `getNearestDistrict` call, `serializeFilters`) in one
  atomic task/commit — no separate "Task 2" for callers.
- `LocationProvider` (previously a late "code quality" cleanup item) is pulled forward to Task 2,
  right after the API layer — every later task that needs `coords` consumes it from this context
  from the start, instead of two components independently calling `useGeolocation()` and one of
  them being migrated later.
- `discovery-client.tsx`'s entire state machine — location consumption, loading/error/race-id
  handling, the one-time auto-sort effect, category-route prop wiring, `aria-live` — is now ONE
  task (new Task 4), not six. It touches one file's state coherently instead of being rewritten
  six times by six different subagents.
- `VenueMapLeaflet`'s single-venue rendering reuses the EXISTING multi-marker path with a
  one-item `venues` array (`[{ id, name, lat, lng, category }]`) instead of inventing an
  underspecified `singlePoint` boolean prop — no new rendering mode needed at all.
- `CategoryQuickRoute`'s `onSelectCategory` is now typed `(category: string | undefined) => void`
  from the moment it's introduced, so "click the active category again to deselect" (the old
  Task 10 fix) doesn't require a later signature change.
- C10's test now matches the design doc's actual words: when `googleRatingCount` is null, the
  count number is omitted but "Google yorumu" text still renders (not hidden entirely).
- The native-share button is now behind a `useEffect`-set `canShare` state (client-only, set after
  mount), avoiding a server/client hydration mismatch on `"share" in navigator`.
- A concrete test now proves the React-Leaflet remount-on-district-change behavior (asserting the
  mocked `MapContainer` receives a distinct `key` across renders with different district props).
- Task 11's file header now accurately says it modifies two docs, not "none."
- The auth-form/favorite-button tests were corrected to not race their own async setup (fill
  required fields before submit; await the mount-time favorite-status fetch before toggling).
- The favorites-collections task now has an explicit multi-list-switching acceptance test, not
  just "create and see the new name."

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
- **A signature change is only complete in the same task as every one of its direct callers** —
  the exact rule Plan 4b's plan-red-team established after three violations; this plan does not
  repeat that mistake (see Task 1, Task 4).

---

## Task 1: API client header propagation (atomic — signature change + every direct caller)

Owns `packages/api-client`'s `get()` signature and `apps/web/src/lib/api.ts`'s `fetchValidated`/
`getVenues`/`getNearestDistrict`, AND every one of their direct callers
(`discovery-client.tsx`'s `getVenues` call, `district-picker.tsx`'s `getNearestDistrict` call,
`venue-filters.tsx`'s `serializeFilters`) in this same task/commit. Nothing about the location
header is a separate task.

**Files:**
- Modify: `packages/api-client/src/index.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/components/venue-filters.tsx` (`serializeFilters`)
- Modify: `apps/web/src/components/discovery-client.tsx` (only the `getVenues` call site — the
  rest of this file's state machine is Task 4's job, not this one)
- Modify: `apps/web/src/components/district-picker.tsx` (only the `getNearestDistrict` call site)
- Test: `packages/api-client/src/index.spec.ts` (new), `apps/web/src/lib/api.spec.ts` (append),
  `apps/web/src/components/venue-filters.spec.tsx` (append), `apps/web/src/components/discovery-client.spec.tsx` (append — one call-site test only), `apps/web/src/components/district-picker.spec.tsx` (append)

**Interfaces:**
- Consumes: nothing new (Plan 4b already defines the header contract)
- Produces: `createApiClient(...).get<T>(path, options?: { headers?: Record<string,string> })`;
  `fetchValidated(path, schema, token?, headers?)`; `locationHeaders(coords?)`;
  `getVenues(query: Record<string,string>, coords?: { lat: number; lng: number } | null, token?: string)`;
  `getNearestDistrict(coords: { lat: number; lng: number }, token?: string)` (coords REQUIRED,
  not optional — Plan 4b's endpoint 400s without the header). Every caller of both functions
  anywhere in `apps/web` is updated to the new signature in this same commit — Task 4 (which
  rewrites `discovery-client.tsx`'s broader state machine) receives an already-correct call site.

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
  it("does not put lat/lng in the query string, sends X-User-Location instead", async () => {
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
  it("sends X-User-Location, no query params", async () => {
    const getSpy = vi.spyOn(client, "get").mockResolvedValue({ id: "d1", name: "Kadıköy", slug: "kadikoy" });
    await getNearestDistrict({ lat: 40.99, lng: 29.02 });
    const [pathArg, optionsArg] = getSpy.mock.calls[0];
    expect(pathArg).toBe("/districts/nearest");
    expect(optionsArg).toEqual({ headers: { "X-User-Location": "40.99,29.02" } });
  });
});
```
(Read the real internal structure of `fetchValidated`/`client` first — if `client.get` isn't
directly spy-able because it's constructed fresh per module load, spy on `global.fetch` instead,
same pattern as Step 1's test. The point is proving the header reaches the underlying HTTP call,
not the specific spy target.)
- [ ] **Step 6:** Run — FAIL (`locationHeaders` doesn't exist, `getVenues`/`getNearestDistrict` don't take `coords` yet).
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
(Read the real current `getVenues`/`getNearestDistrict` bodies first — this replaces their
implementations; preserve the exact existing `qs`-building logic if it differs from the sketch
above, e.g. if empty-value keys need filtering before `URLSearchParams` construction.)
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

- [ ] **Step 10: Update `discovery-client.tsx`'s ONE `getVenues` call site** (the file's broader
      state machine — loading/error/race handling/auto-sort — is Task 4's job; this step ONLY
      changes the second argument passed to `getVenues`, so the file compiles against Task 1's new
      signature and stays that way through Task 4):
```typescript
// wherever the current call is, e.g. inside applyFilters:
const { data } = await getVenues({ districtId, ...serializeFilters(next, coords) }, coords);
```
Write the failing test, confirm it fails (current call passes one argument), fix, confirm it passes:
```typescript
// discovery-client.spec.tsx (append — ONE call-site test, the state-machine tests are Task 4's job)
describe("DiscoveryClient — getVenues call includes coords", () => {
  it("passes the resolved coords as getVenues' second argument", async () => {
    render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe")); // adjust to this file's real existing trigger
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledWith(expect.any(Object), expect.anything()));
  });
});
```
- [ ] **Step 11:** Run — PASS.

- [ ] **Step 12: Update `district-picker.tsx`'s ONE `getNearestDistrict` call site** — same
      pattern: find the current call (with the old `lat`/`lng`-split or no-argument signature),
      update to pass the single `coords` object. Write the failing test, confirm it fails, fix,
      confirm it passes.

- [ ] **Step 13:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`. Confirm every caller
      of `getVenues`/`getNearestDistrict` anywhere in `apps/web` compiles — grep for both names to
      be sure none was missed (`grep -rn "getVenues\|getNearestDistrict" apps/web/src --include=*.tsx --include=*.ts`).
- [ ] **Step 14: Commit**
```bash
git add packages/api-client/src apps/web/src/lib/api.ts apps/web/src/lib/api.spec.ts apps/web/src/components/venue-filters.tsx apps/web/src/components/venue-filters.spec.tsx apps/web/src/components/discovery-client.tsx apps/web/src/components/discovery-client.spec.tsx apps/web/src/components/district-picker.tsx apps/web/src/components/district-picker.spec.tsx
git commit -m "feat(web): propagate X-User-Location header through api-client, getVenues/getNearestDistrict, and every direct caller (atomic)"
```

---

## Task 2: `LocationProvider` — single shared coordinate source

Pulled forward from what would otherwise be a late "code quality" cleanup, specifically so Task 4
(the `DiscoveryClient` state machine) and `district-picker.tsx` both consume `coords` from ONE
place from the start, instead of two independent `useGeolocation()` calls that get unified later.

**Files:**
- Create: `apps/web/src/lib/location-context.tsx`
- Modify: `apps/web/src/app/[district]/page.tsx` (wrap `DistrictPicker` + `DiscoveryClient` in the provider)
- Modify: `apps/web/src/components/district-picker.tsx` (consume `useLocationContext()` instead of its own `useGeolocation()`)
- Test: `apps/web/src/lib/location-context.spec.tsx` (new), `apps/web/src/components/district-picker.spec.tsx` (append)

**Interfaces:**
- Consumes: `apps/web/src/lib/use-geolocation.ts`'s existing `useGeolocation()` hook (unchanged)
- Produces: `LocationProvider` (React context provider), `useLocationContext()` (returns the same
  `coords` shape `useGeolocation()` already returns). Consumed by Task 4 (`DiscoveryClient`) and
  this task's own update to `district-picker.tsx`.

- [ ] **Step 1: Write the failing test**
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
  it("provides the same coords value to two consumers without calling the browser API twice", () => {
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
- [ ] **Step 2:** Run — FAIL (file doesn't exist). Create `apps/web/src/lib/location-context.tsx`,
      following the exact provider pattern `apps/web/src/lib/auth-context.tsx` already establishes
      in this codebase (read it first for the pattern):
```typescript
"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useGeolocation } from "./use-geolocation";

const LocationContext = createContext<ReturnType<typeof useGeolocation> | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const coords = useGeolocation();
  return <LocationContext.Provider value={coords}>{children}</LocationContext.Provider>;
}

export function useLocationContext() {
  const ctx = useContext(LocationContext);
  if (ctx === undefined) {
    throw new Error("useLocationContext must be used within a LocationProvider");
  }
  return ctx;
}
```
- [ ] **Step 3:** Run — PASS.

- [ ] **Step 4: Wire the provider into the district page and migrate `district-picker.tsx`**
Read `apps/web/src/app/[district]/page.tsx`'s real current content, wrap its `DistrictPicker` +
`DiscoveryClient` render in `<LocationProvider>...</LocationProvider>`. Update
`district-picker.tsx`'s `useSuggestedDistrict` (or wherever it currently calls its own
`useGeolocation()`) to call `useLocationContext()` instead. Write the failing test confirming
`district-picker.tsx` no longer calls `useGeolocation` directly (spy on the hook module, assert
it's not called when the component is wrapped in `LocationProvider` with a mocked context value),
confirm it fails against the pre-migration code, migrate, confirm it passes.

- [ ] **Step 5:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 6: Commit**
```bash
git add apps/web/src/lib/location-context.tsx apps/web/src/lib/location-context.spec.tsx apps/web/src/app/\[district\]/page.tsx apps/web/src/components/district-picker.tsx apps/web/src/components/district-picker.spec.tsx
git commit -m "feat(web): LocationProvider — single shared geolocation source, migrate district-picker off its own useGeolocation call"
```

---

## Task 3: Error handling fixes (C1, C11, C12)

Three independent, small, single-file fixes unrelated to the `discovery-client.tsx` state machine
(that file's own error/loading handling is C2, folded into Task 4 since it's part of the same
state machine) — bundled here since none touches a shared file with another task in this group.

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

- [ ] **Step 1 (C1): Write the failing test**
```typescript
// auth-context.spec.tsx (append)
describe("AuthProvider — getSession() failure", () => {
  it("does not throw and settles loading to false when getSession() rejects", async () => {
    vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error("network down"));
    render(<AuthProvider><div data-testid="child" /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("child")).toBeInTheDocument());
    // vitest fails the whole run on an unhandled promise rejection -- this test's mere completion
    // without that failure is itself part of the proof; the explicit state check below is the rest.
    expect(useAuthLoadingState()).toBe(false); // adjust to however this file actually exposes loading, e.g. a data-testid on a loading indicator instead
  });
});
```
Run — FAIL (read the real current `useEffect` body first; confirm whether `.catch()` is genuinely
absent). Add `.catch(() => setLoading(false))` (or whatever the real state-setter is called — check
the file) to the `getSession()` promise chain. Run — PASS.

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
    // click isn't racing the initial state fetch (that race is a separate, not-yet-addressed
    // concern this test deliberately avoids by sequencing correctly).
    await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled());
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
`useAuth().user` is truthy) to determine initial pressed state — the button should be disabled
until this initial fetch resolves too, to close the mount-vs-toggle race the test above sequences
around — and a `pending` state set `true` on click / `false` in a `finally` after the toggle call,
with `disabled={pending || initialCheckPending}` on the button. Run — PASS.

- [ ] **Step 3 (C12): Write the failing test**
```typescript
// auth-form.spec.tsx (append)
describe("AuthForm — disabled while submitting", () => {
  it("disables the submit button until the request resolves", async () => {
    let resolveSignIn: () => void;
    signInMock.mockReturnValue(new Promise<void>((resolve) => { resolveSignIn = resolve; }));
    render(<AuthForm mode="sign-in" />);
    // fill required fields first so native HTML validation doesn't block submission before our
    // own async handler ever runs
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

## Task 4: `DiscoveryClient`'s complete state machine (C2, C3-partial, C8, C13) — atomic

This is the state machine round 1's plan-red-team found split across six tasks. It is one task
now: location consumption (via Task 2's `LocationProvider`), request loading/error/race-id
handling, the one-time auto-sort-to-distance effect (guarded against overriding real user
interaction), category-quick-route prop wiring, and the loading indicator's accessibility markup
— all in `discovery-client.tsx`, changed once, by one implementer, in dependency order within a
single task.

**Files:**
- Modify: `apps/web/src/components/discovery-client.tsx`
- Test: `apps/web/src/components/discovery-client.spec.tsx` (append)

**Interfaces:**
- Consumes: Task 1's `getVenues(query, coords, token?)` (already wired at this file's one call
  site by Task 1 — this task rewrites everything AROUND that call, not the call itself again);
  Task 2's `useLocationContext()`.
- Produces: `DiscoveryClient` with `loading`/`error` state, a `latestRequest` ref discarding stale
  responses, a one-time auto-sort effect, and `venues`/`districtName`/`coordsAvailable` props
  passed down to `CategoryQuickRoute` (the props `CategoryQuickRoute` needs are DEFINED here but
  actually consumed by Task 9 — Task 9's `CategoryQuickRoute` changes are independent of this
  file and don't need to land in the same task, since this task only needs to pass three values
  already in its own state, no new data fetch).

- [ ] **Step 1: Replace `useGeolocation()` with `useLocationContext()`**
Read the current file. Change `const coords = useGeolocation();` to
`const coords = useLocationContext();`, remove the now-unused `useGeolocation` import, add
`useLocationContext` from `@/lib/location-context`. Update this file's existing test mocks (it
currently mocks `useGeolocation` directly per Task 1's earlier confirmation) to mock
`useLocationContext` instead. Run the existing test suite for this file to confirm this
substitution alone doesn't break anything — commit-worthy on its own if useful, but continue to
the rest of this task before committing (this task is one commit).

- [ ] **Step 2: Write the failing test for loading/error/race-discarding (C2)**
```typescript
describe("DiscoveryClient — loading, error, and stale-response discarding", () => {
  it("shows a loading indicator while a request is in flight and an error message on failure", async () => {
    getVenuesMock.mockRejectedValueOnce(new Error("500"));
    render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/hata/i));
  });

  it("ignores a slow first response if a second request has already started", async () => {
    let resolveFirst: (v: unknown) => void;
    getVenuesMock
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ data: [{ id: "v2", name: "Second" }], meta: { next_cursor: null, has_more: false } });
    render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    fireEvent.click(screen.getByTestId("quick-category-bakery"));
    await waitFor(() => expect(screen.getByText("Second")).toBeInTheDocument());
    resolveFirst!({ data: [{ id: "v1", name: "First" }], meta: { next_cursor: null, has_more: false } });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText("First")).not.toBeInTheDocument();
  });
});
```
(Adjust `data-testid`s to whatever this codebase's real quick-category trigger elements are named
— check the current file.) Run — FAIL.
- [ ] **Step 3:** Implement:
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
Render (C13's accessibility requirement folded in here since it's the same JSX):
`{loading && <p role="status" aria-live="polite">Yükleniyor…</p>}` /
`{error && <p role="status" aria-live="polite">{error}</p>}`.
Run — PASS.

- [ ] **Step 4: Write the failing test for the one-time auto-sort-to-distance effect (C8)**
```typescript
describe("DiscoveryClient — one-time auto-sort to distance when coords resolve", () => {
  it("refetches with the resolved coords exactly once when they first become available", async () => {
    vi.mocked(useLocationContextMock).mockReturnValue(null);
    const { rerender } = render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    vi.mocked(useLocationContextMock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    rerender(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledWith(expect.any(Object), { lat: 40.99, lng: 29.02 }));
    expect(getVenuesMock).toHaveBeenCalledTimes(1);
    rerender(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    expect(getVenuesMock).toHaveBeenCalledTimes(1); // no second call from the re-render alone
  });

  it("does not auto-refetch if the user already changed a filter before coords resolved", async () => {
    vi.mocked(useLocationContextMock).mockReturnValue(null);
    render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    await waitFor(() => expect(getVenuesMock).toHaveBeenCalledTimes(1));
    vi.mocked(useLocationContextMock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    const { rerender } = render(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    rerender(<DiscoveryClient districtId="d1" initialVenues={[]} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(getVenuesMock).toHaveBeenCalledTimes(1); // still just the user's own request
  });
});
```
Run — FAIL. Implement:
```typescript
const autoSortedRef = useRef(false);
const userInteractedRef = useRef(false);

function handleQuickCategory(category: string) {
  userInteractedRef.current = true;
  void applyFilters({ ...filters, category });
}
// The onChange passed to VenueFilters also sets userInteractedRef.current = true before calling applyFilters.

useEffect(() => {
  if (coords && !autoSortedRef.current && !userInteractedRef.current) {
    autoSortedRef.current = true;
    void applyFilters(filters);
  }
}, [coords]);
```
Run — PASS.

- [ ] **Step 5: Pass `venues`/`districtName`/`coordsAvailable` props down to `CategoryQuickRoute`**
(`districtName` itself is threaded in from `[district]/page.tsx` — this task accepts it as a new
`DiscoveryClient` prop, it does not resolve it itself.) Write the failing test:
```typescript
describe("DiscoveryClient — passes venues/coordsAvailable to CategoryQuickRoute", () => {
  it("passes the current venues list and whether coords are available", () => {
    vi.mocked(useLocationContextMock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    render(<DiscoveryClient districtId="d1" initialVenues={[{ id: "v1", name: "X" }]} districtName="Kadıköy" />);
    expect(CategoryQuickRouteMock).toHaveBeenCalledWith(
      expect.objectContaining({ venues: [{ id: "v1", name: "X" }], coordsAvailable: true, districtName: "Kadıköy" }),
      expect.anything(),
    );
  });
});
```
(Adjust to however this file already mocks `CategoryQuickRoute`, if at all — if it doesn't
currently mock it, render normally and assert via DOM instead of a mock-call assertion.) Run —
FAIL, wire the props through, run — PASS.

- [ ] **Step 6:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`. This whole task's test
      suite for `discovery-client.tsx` is the single, coherent acceptance gate for the entire state
      machine — no later task should need to touch this file's internals again (Task 9's
      `CategoryQuickRoute` and Task 10's `category-labels.ts` consolidation touch OTHER files that
      merely consume props this task already produces).
- [ ] **Step 7: Commit**
```bash
git add apps/web/src/components/discovery-client.tsx apps/web/src/components/discovery-client.spec.tsx
git commit -m "feat(web): DiscoveryClient's complete state machine — LocationProvider consumption, loading/error/race handling, one-time auto-sort-to-distance, category-route prop wiring, aria-live"
```

---

## Task 5: Map correctness (C3-remainder, C14)

Depends on Task 4 only insofar as `DiscoveryClient` renders `VenueMapLeaflet` — this task changes
`VenueMapLeaflet` itself and the one call site in `DiscoveryClient` that passes it new props (not
a re-touch of Task 4's state machine, just adding two new props to an existing render call).

**Files:**
- Create: `apps/web/src/lib/district-centers.ts`
- Modify: `apps/web/src/components/venue-map-leaflet.tsx`
- Modify: `apps/web/src/app/[district]/page.tsx` (resolve the center, pass it down)
- Modify: `apps/web/src/components/discovery-client.tsx` (accept `centerLat`/`centerLng` props, forward to `VenueMapLeaflet` with a remount `key`)
- Test: `apps/web/src/lib/district-centers.spec.ts` (new), `apps/web/src/components/venue-map-leaflet.spec.tsx` (append)

**Interfaces:**
- Consumes: nothing new
- Produces: `DISTRICT_CENTERS`/`DEFAULT_CENTER`; `VenueMapLeaflet` takes `centerLat`/`centerLng`
  props; every `CircleMarker` gets `aria-label={venue.name}`; `[district]/page.tsx` resolves the
  center and passes it to `DiscoveryClient`, which forwards it to `VenueMapLeaflet` with
  `key={districtId}` to force a remount on navigation (React-Leaflet's `center` prop is immutable
  after first mount).

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

- [ ] **Step 4: Write the failing test for `VenueMapLeaflet`'s new center props + `aria-label`**
```typescript
// venue-map-leaflet.spec.tsx (append)
describe("VenueMapLeaflet — centerLat/centerLng and marker accessibility", () => {
  it("passes centerLat/centerLng through to the map container's center", () => {
    render(<VenueMapLeaflet venues={[]} centerLat={40.9906} centerLng={29.0274} />);
    expect(screen.getByTestId("map-container")).toHaveAttribute("data-center", "40.9906,29.0274");
  });

  it("gives each marker an aria-label with the venue's name", () => {
    render(<VenueMapLeaflet venues={[{ id: "v1", name: "Cafe Test", lat: 40.99, lng: 29.02 }]} centerLat={40.99} centerLng={29.02} />);
    expect(screen.getByLabelText("Cafe Test")).toBeInTheDocument();
  });
});
```
(Check the real current spec file's mocking pattern for `react-leaflet`'s `MapContainer` before
writing the center-prop assertion — it's almost certainly mocked given it depends on browser
globals; match that existing mock shape.) Run — FAIL. Add `centerLat`/`centerLng` props (the
current signature likely takes `venues` only — check), pass into `<MapContainer center={[centerLat, centerLng]} ...>`, and add `aria-label={venue.name}` to each `CircleMarker`. Run — PASS.

- [ ] **Step 5: Write the failing test proving the remount-on-district-change behavior**
```typescript
describe("VenueMapLeaflet — remounts (not just re-centers) when its key changes", () => {
  it("a changed key causes the mocked MapContainer to receive fresh initial center props, not an update to a stale instance", () => {
    const { rerender } = render(<VenueMapLeaflet key="kadikoy" venues={[]} centerLat={40.9906} centerLng={29.0274} />);
    expect(screen.getByTestId("map-container")).toHaveAttribute("data-center", "40.9906,29.0274");
    rerender(<VenueMapLeaflet key="besiktas" venues={[]} centerLat={41.0422} centerLng={29.0061} />);
    expect(screen.getByTestId("map-container")).toHaveAttribute("data-center", "41.0422,29.0061");
    // A React `key` change causes React to unmount the old element and mount a brand new one --
    // this test's mocked MapContainer re-reading centerLat/centerLng after rerender (rather than
    // ignoring the new props, as a real un-keyed React-Leaflet instance would after first mount)
    // is exactly the proof that the `key` prop is doing its job, since RTL's `rerender` on a
    // DIFFERENT `key` genuinely triggers React's unmount+remount, not a prop update to the same
    // instance.
  });
});
```
Run — this should already pass once the mocked `MapContainer` just renders whatever `center` prop
it receives (the mock doesn't need special "immutable after mount" behavior to prove the point —
the real proof is architectural: `key`'s presence at the call site in Step 6 below is what
guarantees a real browser remount; this test guards against someone removing the `key` and the
component silently still working in the MOCKED test environment, which wouldn't catch a real
immutable-`center`-prop regression — flag this as a known test-environment limitation, not
something fixable in a unit test; the manual browser verification in Task 11 is the real proof).

- [ ] **Step 6: Resolve and pass the center from `[district]/page.tsx` through to `VenueMapLeaflet` with a remount key**
```typescript
// [district]/page.tsx
import { DISTRICT_CENTERS, DEFAULT_CENTER } from "@/lib/district-centers";
// ...
const center = DISTRICT_CENTERS[params.district] ?? DEFAULT_CENTER;
// pass center.lat / center.lng as centerLat/centerLng props into <DiscoveryClient districtId={...} centerLat={center.lat} centerLng={center.lng} ... />
```
In `discovery-client.tsx`, accept `centerLat`/`centerLng` props (in addition to Task 4's existing
props — this is an additive prop, not a rewrite of that task's state) and forward them to
`<VenueMapLeaflet key={districtId} centerLat={centerLat} centerLng={centerLng} ... />`.

- [ ] **Step 7:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 8: Commit**
```bash
git add apps/web/src/lib/district-centers.ts apps/web/src/lib/district-centers.spec.ts apps/web/src/components/venue-map-leaflet.tsx apps/web/src/components/venue-map-leaflet.spec.tsx apps/web/src/app/\[district\]/page.tsx apps/web/src/components/discovery-client.tsx
git commit -m "fix(web): fixed district map centers with remount-on-navigation key, aria-label on map markers"
```

---

## Task 6: Venue detail completeness (C4, C9, C10)

**Files:**
- Modify: `apps/web/src/components/venue-detail.tsx`
- Modify: `apps/web/src/components/venue-card.tsx`
- Test: `apps/web/src/components/venue-detail.spec.tsx` (append), `apps/web/src/components/venue-card.spec.tsx` (append)

**Interfaces:**
- Consumes: Plan 4b's `VenueDetailSchema` (`lat`/`lng`/`address`/`photos`, already present); Task 5's `VenueMapLeaflet` (no new prop needed — reuses the existing multi-marker rendering path with a one-item array, see Step 2 below)
- Produces: `venue-detail.tsx` renders address, a real map (via the existing `VenueMapLeaflet`
  with a single-item `venues` array), and a photo grid (or empty state); a client-only,
  SSR-safe `navigator.share()` button; `venue-card.tsx`'s Google badge text includes "Google yorumu".

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
(Naming each photo `<img>`'s `alt` after the venue name, e.g. `alt={`${venue.name} fotoğrafı ${i+1}`}`,
is what makes `getAllByRole("img", { name: ... })` distinguish them from the map's own tiles/icons
— the map is a mocked `<div data-testid="map-container">` in tests per the existing mock pattern,
not real `<img>` elements, so no collision.)
- [ ] **Step 2:** Run — FAIL (read the real current file first — confirmed no address rendering, no
      real map usage, no photo grid at all currently). Implement: conditionally render
      `venue.address` in a labeled block (`data-testid="venue-address"`); replace whatever
      decorative placeholder currently sits where the map should be with:
```tsx
<VenueMapLeaflet
  venues={[{ id: venue.id, name: venue.name, lat: venue.lat, lng: venue.lng, category: venue.category }]}
  centerLat={venue.lat}
  centerLng={venue.lng}
/>
```
(No new prop on `VenueMapLeaflet` needed — this reuses the exact same multi-marker rendering path
Task 5 already built, with a one-item array. This replaces the design doc's originally-proposed
`singlePoint` boolean, which round 1's plan-red-team correctly flagged as underspecified.) Render
a photo grid (`<img key={i} src={url} alt={`${venue.name} fotoğrafı ${i + 1}`} />` for each) when
`venue.photos.length > 0`, else the empty-state text.
- [ ] **Step 3:** Run — PASS.

- [ ] **Step 4: Write the failing test for the SSR-safe native share button**
```typescript
describe("VenueDetail — native share button (client-only, SSR-safe)", () => {
  afterEach(() => {
    // @ts-expect-error -- test cleanup, restoring navigator.share to its jsdom default
    delete navigator.share;
  });

  it("renders a share button once mounted, when navigator.share exists", async () => {
    Object.defineProperty(navigator, "share", { value: vi.fn(), configurable: true });
    render(<VenueDetail venue={baseVenue} />);
    // the check runs in an effect (client-only), so it may not be present on the very first
    // synchronous render -- assert after allowing effects to flush.
    await waitFor(() => expect(screen.getByTestId("native-share-button")).toBeInTheDocument());
  });

  it("never renders a share button when navigator.share is unavailable", async () => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    render(<VenueDetail venue={baseVenue} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId("native-share-button")).not.toBeInTheDocument();
  });
});
```
Run — FAIL, then implement with a `useState` + `useEffect` (client-only check, avoiding a
server/client hydration mismatch since `navigator` doesn't exist during SSR):
```typescript
const [canShare, setCanShare] = useState(false);
useEffect(() => { setCanShare(typeof navigator !== "undefined" && "share" in navigator); }, []);
// ... {canShare && <button data-testid="native-share-button" onClick={() => navigator.share({ title: venue.name, url: window.location.href })}>...</button>}
```
matching `whatsapp-share-button.tsx`'s existing visual pattern (rounded icon circle, label). Run — PASS.

- [ ] **Step 5: Write the failing test for the Google badge text (C10 — matching the design doc's actual wording: count omitted when null, but "Google yorumu" text still shown)**
```typescript
// venue-card.spec.tsx (append)
describe("VenueCard — Google rating badge text", () => {
  it("shows '4.3 ★ · 120 Google yorumu' when a count is present", () => {
    render(<VenueCard venue={{ ...baseVenue, googleRating: 4.3, googleRatingCount: 120 }} />);
    expect(screen.getByText(/4\.3 ★ · 120 Google yorumu/)).toBeInTheDocument();
  });
  it("shows '4.3 ★ · Google yorumu' (no count number, but 'Google yorumu' still shown) when googleRatingCount is null", () => {
    render(<VenueCard venue={{ ...baseVenue, googleRating: 4.3, googleRatingCount: null }} />);
    expect(screen.getByText(/4\.3 ★ · Google yorumu/)).toBeInTheDocument();
  });
});
```
Run — FAIL (current format is bare `4.5 (123)`, no star glyph, no "Google" word — confirmed by
reading the real file). Update the badge markup:
```tsx
<span>{venue.googleRating.toFixed(1)} ★ · {venue.googleRatingCount !== null ? `${venue.googleRatingCount} ` : ""}Google yorumu</span>
```
Run — PASS.

- [ ] **Step 6:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 7: Commit**
```bash
git add apps/web/src/components/venue-detail.tsx apps/web/src/components/venue-detail.spec.tsx apps/web/src/components/venue-card.tsx apps/web/src/components/venue-card.spec.tsx
git commit -m "feat(web): venue detail shows address/real single-marker map/photo grid + SSR-safe native share button, venue-card Google badge attribution text"
```

---

## Task 7: Admin curation copy sync with Plan 4b's A3 decision

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

## Task 8: Favorites collections (C5), open-now filter (C7), boutique toggle fix (Plan 4b schema)

**Files:**
- Modify: `apps/web/src/app/favoriler/page.tsx` (or wherever the favorites page lives — check)
- Modify: `apps/web/src/lib/api.ts` (add a `createList`/`POST /me/lists` helper if one doesn't already exist — check first, per round 1's finding that this wasn't guaranteed)
- Modify: `apps/web/src/components/venue-filters.tsx`
- Test: corresponding `.spec.tsx` files (append)

**Interfaces:**
- Consumes: `POST /me/lists` (backend endpoint — confirm it exists; if `apps/web/src/lib/api.ts`
  has no client-side helper for it yet, this task creates one), Plan 4b's `OptionalTrueFlag`
  pattern (already rejects `isBoutique=false`/`openNow=false`)
- Produces: a "create new list" form + a working switcher between multiple lists (showing the
  selected list's venues, not just the newly-created list's name) on the favorites page; an
  `openNow` toggle in `VenueFilters`; `serializeFilters`'s boutique output only ever emits
  `"true"`, never `"false"`.

- [ ] **Step 1: Write the failing test for the boutique toggle fix** (most urgent of the three —
      Plan 4b's schema change means the CURRENT toggle logic actively breaks in production the
      moment both plans are live, since `update({ isBoutique: !filters.isBoutique })` can produce
      `isBoutique: false`, which the backend now rejects with 400)
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
`FavoriteListSchema` or similar to validate against, following this file's established
`fetchValidated`-equivalent pattern for POST if one exists, or a direct `post()` call if this
file's existing `POST` helpers don't validate responses — check the real current file for the
established convention before choosing.)

- [ ] **Step 6: Write the failing test for creating AND switching between lists**
```typescript
// favoriler/page.spec.tsx (append, or new file if none exists — check first)
describe("Favorites page — create and switch between lists", () => {
  it("submits a new list name via POST /me/lists and shows it as a selectable option", async () => {
    createListMock.mockResolvedValue({ id: "l2", name: "Kadıköy Kahveleri", venues: [] });
    render(<FavoritesPage initialLists={[{ id: "l1", name: "Default", venues: [{ id: "v1", name: "Cafe A" }] }]} />);
    fireEvent.change(screen.getByLabelText(/liste adı/i), { target: { value: "Kadıköy Kahveleri" } });
    fireEvent.click(screen.getByRole("button", { name: /oluştur/i }));
    await waitFor(() => expect(createListMock).toHaveBeenCalledWith("Kadıköy Kahveleri"));
    expect(await screen.findByRole("tab", { name: "Kadıköy Kahveleri" })).toBeInTheDocument();
  });

  it("shows the selected list's venues when switching tabs, not the previously active list's", () => {
    render(<FavoritesPage initialLists={[
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
Run — FAIL. Read the current page's real structure (round 1 confirmed it likely assumes a single
list) and add: a name input + submit button calling `createList`, appending the new list to local
state on success; a simple tab list (`role="tab"` per list) with `activeListId` state, rendering
only the active list's venues. Run — PASS.

- [ ] **Step 7:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 8: Commit**
```bash
git add apps/web/src/app/favoriler apps/web/src/lib/api.ts apps/web/src/lib/api.spec.ts apps/web/src/components/venue-filters.tsx apps/web/src/components/venue-filters.spec.tsx
git commit -m "feat(web): favorites collection creation + multi-list switching UI, open-now filter, fix boutique toggle for Plan 4b's OptionalTrueFlag schema"
```

---

## Task 9: Category quick-route deep link completion (C6)

**Files:**
- Create: `apps/web/src/lib/directions.ts`
- Modify: `apps/web/src/components/venue-detail.tsx` (extract `directionsUrl` out — a small,
  independent change to this file, unrelated to Task 6's changes to the same file; safe to land
  separately since it touches a different function)
- Modify: `apps/web/src/components/category-quick-route.tsx`
- Test: `apps/web/src/lib/directions.spec.ts` (new), `apps/web/src/components/category-quick-route.spec.tsx` (append)

**Interfaces:**
- Consumes: `venues`/`districtName`/`coordsAvailable` props, already produced by Task 4 (`DiscoveryClient` already passes these — this task only changes what `CategoryQuickRoute` itself does with them)
- Produces: `directionsUrl(venueName, districtName)` (extracted, shared); `CategoryQuickRoute`'s
  `onSelectCategory` is typed `(category: string | undefined) => void` from this task onward
  (supports deselection, closing the round-1-flagged signature gap in the SAME task that
  introduces the deep-link feature, not a later "code quality" pass); renders a real directions
  link to the first matching venue.

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

- [ ] **Step 4: Write the failing test for `CategoryQuickRoute`'s widened signature + directions link**

Since this component is CONTROLLED (its `activeCategory` is a prop from the parent, not owned
locally — confirmed by reading the current file), the click handler calls `onSelectCategory`, the
PARENT updates its own state, and the parent re-renders this component with a new `activeCategory`
prop. The test below reflects that: it asserts the directions link appears only AFTER the
component receives the updated `activeCategory` prop (a `rerender`, matching real controlled-component behavior), not synchronously within the same click.
```typescript
// category-quick-route.spec.tsx (append)
describe("CategoryQuickRoute — direct directions link (controlled component)", () => {
  const venues = [{ id: "v1", name: "First Cafe", category: "cafe" }, { id: "v2", name: "Second Cafe", category: "cafe" }];

  it("calls onSelectCategory(category) on click, then renders a directions link once the parent re-renders with the new activeCategory", () => {
    const onSelectCategory = vi.fn();
    const { rerender } = render(<CategoryQuickRoute venues={venues} districtName="Kadıköy" coordsAvailable onSelectCategory={onSelectCategory} activeCategory={undefined} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    expect(onSelectCategory).toHaveBeenCalledWith("cafe");
    // simulate the parent (DiscoveryClient) re-rendering with the now-active category, exactly
    // as it would in real usage since activeCategory lives in the parent, not here
    rerender(<CategoryQuickRoute venues={venues} districtName="Kadıköy" coordsAvailable onSelectCategory={onSelectCategory} activeCategory="cafe" />);
    const link = screen.getByRole("link", { name: /en yakın cafe mekana git/i });
    expect(link).toHaveAttribute("href", expect.stringContaining(encodeURIComponent("First Cafe Kadıköy")));
  });

  it("uses neutral copy (not 'en yakın') when coordsAvailable is false", () => {
    const onSelectCategory = vi.fn();
    const { rerender } = render(<CategoryQuickRoute venues={venues} districtName="Kadıköy" coordsAvailable={false} onSelectCategory={onSelectCategory} activeCategory={undefined} />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    rerender(<CategoryQuickRoute venues={venues} districtName="Kadıköy" coordsAvailable={false} onSelectCategory={onSelectCategory} activeCategory="cafe" />);
    expect(screen.getByRole("link", { name: /cafe mekana git/i })).toBeInTheDocument();
    expect(screen.queryByText(/en yakın/i)).not.toBeInTheDocument();
  });

  it("renders no directions link when no venue matches the active category", () => {
    render(<CategoryQuickRoute venues={[]} districtName="Kadıköy" coordsAvailable onSelectCategory={vi.fn()} activeCategory="cafe" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("calls onSelectCategory(undefined) when the already-active category is clicked again", () => {
    const onSelectCategory = vi.fn();
    render(<CategoryQuickRoute venues={venues} districtName="Kadıköy" coordsAvailable onSelectCategory={onSelectCategory} activeCategory="cafe" />);
    fireEvent.click(screen.getByTestId("quick-category-cafe"));
    expect(onSelectCategory).toHaveBeenCalledWith(undefined);
  });
});
```
- [ ] **Step 5:** Run — FAIL. Update `CategoryQuickRoute`'s props to
      `{ venues: VenueListItem[]; districtName: string; coordsAvailable: boolean; onSelectCategory: (category: string | undefined) => void; activeCategory?: string }`.
      Click handler: `onSelectCategory(activeCategory === category ? undefined : category)`
      (this widened signature closes the round-1-flagged toggle-off gap in this same step, not a
      later task). When `activeCategory` matches a real category and at least one venue in
      `venues` has that category, render a directions link using
      `directionsUrl(matchingVenue.name, districtName)`, label text
      `` coordsAvailable ? `En yakın ${label} mekana git` : `${label} mekana git` ``.
- [ ] **Step 6:** Run — PASS.

- [ ] **Step 7:** Confirm `DiscoveryClient`'s existing call to `<CategoryQuickRoute onSelectCategory={handleQuickCategory} .../>` (from Task 4) passes a compatible handler — `handleQuickCategory` currently takes `(category: string)`; update it to `(category: string | undefined)` to match, and have it clear the category filter when called with `undefined` (this is a small, additive change to Task 4's already-landed code, not a rewrite — one line).
- [ ] **Step 8:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`.
- [ ] **Step 9: Commit**
```bash
git add apps/web/src/lib/directions.ts apps/web/src/lib/directions.spec.ts apps/web/src/components/venue-detail.tsx apps/web/src/components/category-quick-route.tsx apps/web/src/components/category-quick-route.spec.tsx apps/web/src/components/discovery-client.tsx
git commit -m "feat(web): category quick-route gets a real directions deep link + deselect-on-second-click, shared directionsUrl helper"
```

---

## Task 10: Code-quality cleanup — category labels consolidation

(`LocationProvider`, originally slated here, was pulled forward to Task 2. `onSelectCategory`'s
widened signature, originally slated here, was folded into Task 9 where it belongs. What remains
is the category-labels duplication.)

**Files:**
- Create: `apps/web/src/lib/category-labels.ts`
- Modify: `apps/web/src/components/venue-card.tsx`, `venue-detail.tsx`, `category-quick-route.tsx`
- Test: `apps/web/src/lib/category-labels.spec.ts` (new)

**Interfaces:** Consumes nothing new. Produces `CATEGORY_LABELS` (real backend taxonomy, dropping
`venue-detail.tsx`'s stale extra keys `kahvalti`/`kahve`/`tatli` — confirmed not real category
values), consumed by all three components instead of two separate/duplicated local definitions.

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

## Task 11: Final regression and manual smoke verification

**Files:** none (this task verifies the whole plan's diff and updates two documentation files — no
source code changes).

- [ ] **Step 1:** Run: `cd apps/web && npx vitest run && npx tsc --noEmit`
- [ ] **Step 2:** Run: `cd apps/admin && npx vitest run && npx tsc --noEmit`
- [ ] **Step 3:** Run: `pnpm exec turbo run typecheck lint --filter=@gurmego/web... --filter=@gurmego/admin...`
- [ ] **Step 4: Manual verification (NOT an automated gate)** — start both the API (Plan 4b, this
      worktree) and the web app (`cd apps/web && pnpm run dev`), then in a real browser:
      1. Visit each of the three district pages, confirm the map opens centered correctly for
         each, and navigating between districts actually re-centers the map (this is the one
         thing Task 5's unit tests structurally cannot prove — react-leaflet's real immutable-`center`
         behavior only manifests in a real browser, not the mocked test environment).
      2. Grant location permission, confirm the venue list auto-sorts to distance exactly once
         (not repeatedly) and the category quick-route buttons show "En yakın ... git" links.
      3. Deny location permission, confirm manual district browsing still works fully, quick-route
         buttons show neutral (non-"en yakın") copy.
      4. Open a venue detail page, confirm address/map/photos (or empty state) render, and the
         native share button appears only on a browser/device that actually supports it.
      5. In the favorites page, create a second list and confirm switching between the two shows
         each list's own venues.
      6. In the admin panel, open the curation queue, confirm the approve button's new copy.
- [ ] **Step 5:** Update `docs/STATE.md` and `docs/SESSION-LOG-2026-07-26.md`: Plan 4c complete,
      ready for the final whole-branch review (Superpowers reviewer + mandatory `cross-model-review`).

---

## Self-Review Notes (round 2, after round 1's YENİDEN BÖL)

- **The Task 1/Task 2 contract-ownership contradiction is resolved**: Task 1 now owns the
  signature change AND every direct caller in one commit — no separate task claims the same call
  sites.
- **`discovery-client.tsx`'s state machine is now one task (Task 4)**, not six — location
  consumption, loading/error/race handling, auto-sort, and prop-passing to `CategoryQuickRoute` all
  land together. Later tasks (5, 9) only ADD new props to an already-stable file, they don't
  rewrite its internals again.
- **`LocationProvider` moved forward to Task 2**, right after the API layer, so `district-picker.tsx`
  and `DiscoveryClient` both consume it from the start — no "two independent hooks, unified later" churn.
- **`onSelectCategory`'s widened signature** (`string | undefined`, supporting deselection) is now
  introduced in the SAME task (9) that adds the feature needing it, not deferred to a later
  cleanup task that would have required changing an already-shipped signature again.
- **`VenueMapLeaflet`'s single-venue case reuses its existing multi-marker path** with a one-item
  array — no new `singlePoint` prop, closing round 1's "underspecified marker contract" finding.
- **C10's test now matches the design doc's literal wording** — count omitted, "Google yorumu" text
  still shown, not hidden entirely.
- **Native share is now behind a mount-effect `canShare` state** — SSR-safe, no hydration mismatch.
- **A test now exists for the remount-key behavior**, with an explicit note on its real limit (a
  mocked `MapContainer` can't prove React-Leaflet's real immutable-`center` behavior — that's
  Task 11's manual verification's job, called out explicitly rather than papered over).
- **Task 11's file header no longer contradicts itself** — it modifies two docs, not zero files.
- **Auth-form/favorite-button tests fixed** to not race their own setup (fields filled before
  submit; mount-time fetch awaited before toggling).
- **Favorites task now has a real multi-list-switching test**, not just "create and see the name."
