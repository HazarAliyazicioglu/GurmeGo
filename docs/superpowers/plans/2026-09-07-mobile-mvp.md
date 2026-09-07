# Mobile MVP (apps/mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/mobile` (Expo + React Native), a native iOS/Android app that reproduces
`apps/web`'s (Plan 2) consumer feature set — venue discovery/filters (including native location
permission + distance-based sort), venue detail with map, favorites, "get directions", share,
"report wrong info", and auth (sign-in + register) — against the existing, unchanged `apps/api`.

**Out of scope (deferred):** KVKK consent checkbox and account deletion — the design doc (§2.1,
§6) lists these as mobile-scope, but their backend (`DELETE /v1/me`, the KVKK copy itself) is
Plan 4d's, not yet built. Building mobile UI against an endpoint that doesn't exist would be
untestable scaffolding. Once Plan 4d lands `DELETE /v1/me`, a follow-up task adds the mobile
screens for it — tracked in Plan 4d's own plan, not duplicated here. EAS Build/Submit and the
actual store account setup are Plan 4e's (provisioning), also out of scope for this plan — this
plan produces working, tested app code; Plan 4e ships it.

**Architecture:** New pnpm workspace member. Zero backend changes. `packages/shared`'s zod schemas
are the single source of truth for response shapes (mobile validates against them exactly like
`apps/web/src/lib/api.ts` does — `packages/api-client`'s generated types are NOT relied on for
validation, only as a thin transport; see design doc §3). Auth via Supabase (`@supabase/supabase-js`
+ `expo-secure-store` for token persistence). Screens built with React Navigation (native stack).

**Tech Stack:** Expo (managed workflow, SDK installed via `npx create-expo-app`), TypeScript,
`@supabase/supabase-js`, `@react-navigation/native` + `@react-navigation/native-stack`,
`react-native-maps`, `expo-location`, React's built-in `Share` API (NOT `expo-sharing`), Jest +
`@testing-library/react-native`.

**Spec:** [docs/superpowers/specs/2026-09-07-mobile-mvp-pivot-design.md](../specs/2026-09-07-mobile-mvp-pivot-design.md)

## Global Constraints

- TypeScript `strict: true`; `any` forbidden unless justified inline with a comment.
- All API responses validated with zod schemas from `packages/shared` — never trust an unvalidated
  `fetch().json()` result, never rely on `packages/api-client`'s generated response types as if
  they were runtime-validated (they are `never`-typed placeholders; see design doc §3).
- No business logic in `apps/mobile` — it is a display + request layer only, exactly like
  `apps/web`. Any business rule (rule-engine thresholds, "who can approve", etc.) lives in
  `apps/api` and is never re-implemented here.
- User's device location coordinates are NEVER logged or sent to any analytics/logging call — only
  used as a request parameter (`X-User-Location` header, same as web; NFR-04).
- Branch naming `feat/...`; commits follow Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`).
- Every task's tests must actually run (`pnpm --filter @gurmego/mobile test`) and pass before that
  task's commit.
- Real device/simulator manual verification (Expo Go) is called out per task where relevant — this
  plan cannot fully verify native behavior (permissions, deep links) through Jest alone.

---

### Task 1: Workspace scaffold — `apps/mobile` project + monorepo wiring

**Files:**
- Create: `apps/mobile/` (via `npx create-expo-app@latest apps/mobile --template blank-typescript`,
  run from repo root)
- Modify: `pnpm-workspace.yaml` (already includes `apps/*`, verify `apps/mobile` is picked up —
  no change needed if the glob already covers it; only edit if it doesn't)
- Modify: `apps/mobile/package.json` — set `"name": "@gurmego/mobile"`, add `"test": "jest"` script
- Create: `apps/mobile/App.tsx` (replaces the scaffold's default)
- Create: `apps/mobile/src/navigation/RootNavigator.tsx`
- Create: `apps/mobile/src/screens/DiscoveryScreen.tsx` (placeholder screen — real content in
  Task 5; this task only proves navigation mounts)
- Test: `apps/mobile/App.spec.tsx`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `RootNavigator` (default export, a React component with no props) — Task 5 onward
  register their screens inside it. `DiscoveryScreen` (default export, no props) — Task 5 replaces
  its body but keeps the same export.

- [ ] **Step 1: Scaffold the Expo project**

From the repo root:

```bash
npx create-expo-app@latest apps/mobile --template blank-typescript
```

- [ ] **Step 2: Install navigation and testing dependencies**

```bash
pnpm --filter @gurmego/mobile add @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context
pnpm --filter @gurmego/mobile add -D jest jest-expo @testing-library/react-native @types/jest
```

- [ ] **Step 3: Set the package name**

Edit `apps/mobile/package.json`, change:
```json
"name": "apps-mobile",
```
to:
```json
"name": "@gurmego/mobile",
```
Add a `"test"` script to the existing `"scripts"` object:
```json
"test": "jest",
```
Add a `"jest"` config block (Expo's Jest preset):
```json
"jest": {
  "preset": "jest-expo"
}
```

- [ ] **Step 4: Write the failing test**

Create `apps/mobile/App.spec.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import App from "./App";

describe("App", () => {
  it("mounts the root navigator and shows the discovery screen", () => {
    render(<App />);
    expect(screen.getByText("Mekanlar")).toBeTruthy();
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm --filter @gurmego/mobile test`
Expected: FAIL — `App.tsx` still has the scaffold's default content, no "Mekanlar" text.

- [ ] **Step 6: Create the placeholder discovery screen**

Create `apps/mobile/src/screens/DiscoveryScreen.tsx`:

```tsx
import { Text, View } from "react-native";

export default function DiscoveryScreen() {
  return (
    <View>
      <Text>Mekanlar</Text>
    </View>
  );
}
```

- [ ] **Step 7: Create the root navigator**

Create `apps/mobile/src/navigation/RootNavigator.tsx`:

```tsx
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DiscoveryScreen from "../screens/DiscoveryScreen";

export type RootStackParamList = {
  Discovery: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Discovery">
        <Stack.Screen name="Discovery" component={DiscoveryScreen} options={{ title: "GurmeGo" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 8: Wire `App.tsx`**

Replace `apps/mobile/App.tsx` with:

```tsx
import RootNavigator from "./src/navigation/RootNavigator";

export default function App() {
  return <RootNavigator />;
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm --filter @gurmego/mobile test`
Expected: PASS

- [ ] **Step 10: Manual verification (Expo Go)**

Run: `pnpm --filter @gurmego/mobile start`, scan the QR code with Expo Go (iOS or Android) or press
`i`/`a` for a simulator/emulator. Confirm the app opens showing "GurmeGo" in the header and
"Mekanlar" in the body, with no red-box errors.

- [ ] **Step 11: Commit**

```bash
git add apps/mobile pnpm-workspace.yaml
git commit -m "feat(mobile): scaffold Expo app with root navigator"
```

---

### Task 2: Environment config — `EXPO_PUBLIC_*` variables

**Files:**
- Create: `apps/mobile/.env.local.example`
- Create: `apps/mobile/src/lib/env.ts`
- Test: `apps/mobile/src/lib/env.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `API_BASE_URL: string`, `SUPABASE_URL: string`, `SUPABASE_ANON_KEY: string` — named
  exports from `src/lib/env.ts`, consumed by Task 3 (Supabase client) and Task 4 (API client).

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/lib/env.spec.ts`:

```ts
describe("env", () => {
  it("throws a clear error when EXPO_PUBLIC_API_BASE_URL is missing", () => {
    const original = process.env.EXPO_PUBLIC_API_BASE_URL;
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    jest.resetModules();
    expect(() => require("./env")).toThrow(/EXPO_PUBLIC_API_BASE_URL is required/);
    process.env.EXPO_PUBLIC_API_BASE_URL = original;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gurmego/mobile test src/lib/env.spec.ts`
Expected: FAIL — `./env` module does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/src/lib/env.ts`:

```ts
// Expo inlines any env var prefixed EXPO_PUBLIC_ at build time (no extra config needed, SDK 49+).
// Fails fast at import time with a clear message rather than letting a missing value surface as
// a cryptic "Network request failed" deep inside a fetch call later.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required (set it in apps/mobile/.env.local, see .env.local.example)`);
  }
  return value;
}

export const API_BASE_URL = requireEnv("EXPO_PUBLIC_API_BASE_URL");
export const SUPABASE_URL = requireEnv("EXPO_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = requireEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gurmego/mobile test src/lib/env.spec.ts`
Expected: PASS

- [ ] **Step 5: Create the example env file**

Create `apps/mobile/.env.local.example`:

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:3001/v1
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/env.ts apps/mobile/src/lib/env.spec.ts apps/mobile/.env.local.example
git commit -m "feat(mobile): add EXPO_PUBLIC_* env config with fail-fast validation"
```

---

### Task 3: Supabase client + auth context

**Files:**
- Create: `apps/mobile/src/lib/supabase.ts`
- Create: `apps/mobile/src/lib/auth-context.tsx`
- Test: `apps/mobile/src/lib/auth-context.spec.tsx`

**Interfaces:**
- Consumes: `SUPABASE_URL`, `SUPABASE_ANON_KEY` from Task 2's `src/lib/env.ts`.
- Produces: `AuthProvider` (component, wraps children), `useAuth()` hook returning
  `{ user: User | null; session: Session | null; loading: boolean; signIn(email, password):
  Promise<{error: string | null}>; signUp(email, password): Promise<{error: string | null}>;
  signOut(): Promise<{error: string | null}> }` — consumed by every screen from Task 5 onward that
  needs the current user/token (favorites, report attribution, account screens).

- [ ] **Step 1: Install Supabase + secure storage dependencies**

```bash
pnpm --filter @gurmego/mobile add @supabase/supabase-js expo-secure-store react-native-url-polyfill
```

- [ ] **Step 2: Create the Supabase client**

Create `apps/mobile/src/lib/supabase.ts`:

```ts
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

// expo-secure-store persists the session in the OS keychain (iOS Keychain / Android Keystore) --
// the native equivalent of apps/web's default localStorage-backed session persistence. Supabase's
// client calls getItem/setItem/removeItem; SecureStore's API matches that shape directly.
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 3: Write the failing test**

Create `apps/mobile/src/lib/auth-context.spec.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { AuthProvider, useAuth } from "./auth-context";
import { supabase } from "./supabase";

jest.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <Text>loading</Text>;
  return <Text>{user ? `signed-in:${user.id}` : "signed-out"}</Text>;
}

describe("AuthProvider", () => {
  it("exposes the current session's user once getSession resolves", async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { access_token: "tok", user: { id: "u1" } } },
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("signed-in:u1")).toBeTruthy());
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @gurmego/mobile test src/lib/auth-context.spec.tsx`
Expected: FAIL — `./auth-context` module does not exist yet.

- [ ] **Step 5: Write the implementation**

Create `apps/mobile/src/lib/auth-context.tsx` (same shape as `apps/web/src/lib/auth-context.tsx`,
no web-specific `"use client"` directive needed):

```tsx
import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let stateChangeReceived = false;
    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => {
        if (cancelled) return;
        if (!stateChangeReceived) {
          setSession(data.session);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event: string, newSession: Session | null) => {
      stateChangeReceived = true;
      setSession(newSession);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    signUp: async (email, password) => {
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error?.message ?? null };
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      return { error: error?.message ?? null };
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @gurmego/mobile test src/lib/auth-context.spec.tsx`
Expected: PASS

- [ ] **Step 7: Wrap the app in `AuthProvider`**

Edit `apps/mobile/App.tsx`:

```tsx
import RootNavigator from "./src/navigation/RootNavigator";
import { AuthProvider } from "./src/lib/auth-context";

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
```

- [ ] **Step 8: Run the full test suite to confirm no regression**

Run: `pnpm --filter @gurmego/mobile test`
Expected: PASS (both `App.spec.tsx` and `auth-context.spec.tsx`)

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/lib/supabase.ts apps/mobile/src/lib/auth-context.tsx apps/mobile/src/lib/auth-context.spec.tsx apps/mobile/App.tsx apps/mobile/package.json
git commit -m "feat(mobile): add Supabase client and auth context"
```

---

### Task 4: API client layer

**Files:**
- Create: `apps/mobile/src/lib/api.ts`
- Test: `apps/mobile/src/lib/api.spec.ts`

**Interfaces:**
- Consumes: `API_BASE_URL` from Task 2's `src/lib/env.ts`; `session.access_token` from Task 3's
  `useAuth()`; zod schemas from `@gurmego/shared` (`VenueSchema`, `VenueDetailSchema`,
  `DistrictSchema`, `FavoriteListSchema`, `FavoriteSchema`).
- Produces: `ApiValidationError` (class), `getVenues(query, coords?)`, `getVenueBySlug(slug)`,
  `getDistricts()`, `getFavoriteLists(token)`, `createFavoriteList(token, name)`,
  `addFavoriteVenue(token, listId, venueId)`, `reportVenue(venueId, reason)`,
  `locationHeaders(coords?)` — same names/signatures as `apps/web/src/lib/api.ts`, consumed by
  Tasks 5-9's screens.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/lib/api.spec.ts`:

```ts
import { getVenues, ApiValidationError } from "./api";

const originalFetch = global.fetch;

describe("getVenues", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns validated venue list data on a well-formed response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "550e8400-e29b-41d4-a716-446655440000",
            name: "Test Cafe",
            slug: "test-cafe",
            category: "cafe",
            priceRange: "MID",
            isBoutique: true,
            editorialNote: null,
            googleRating: null,
            googleRatingCount: null,
          },
        ],
        meta: { next_cursor: null, has_more: false },
      }),
    }) as jest.Mock;

    const result = await getVenues({ districtId: "550e8400-e29b-41d4-a716-446655440001" });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe("Test Cafe");
  });

  it("throws ApiValidationError when the response does not match the schema", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "not-a-uuid" }], meta: { next_cursor: null, has_more: false } }),
    }) as jest.Mock;

    await expect(getVenues({})).rejects.toThrow(ApiValidationError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gurmego/mobile test src/lib/api.spec.ts`
Expected: FAIL — `./api` module does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/src/lib/api.ts` (same schemas/logic as `apps/web/src/lib/api.ts`, but using
plain `fetch` with a manual `Authorization` header instead of `packages/api-client`'s
`createApiClient` — avoids depending on that package's unvalidated response typing, per design
doc §3):

```ts
import { VenueSchema, VenueDetailSchema, DistrictSchema, FavoriteListSchema, FavoriteSchema, type VenueDetail, type District } from "@gurmego/shared";
import { z } from "zod";
import { API_BASE_URL } from "./env";

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
  const raw = await res.json();
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiValidationError(path, result.error.issues);
  return result.data;
}

// Same narrower projection as apps/web/src/lib/api.ts's VenueListItemSchema -- GET /venues does
// not return the full VenueSchema shape (see that file's own comment for the exact field-by-field
// reasoning; kept in sync here rather than shared, since apps/web isn't a dependency of apps/mobile).
const VenueListItemSchema = z.object({
  id: VenueSchema.shape.id,
  name: VenueSchema.shape.name,
  slug: VenueSchema.shape.slug,
  category: VenueSchema.shape.category,
  priceRange: VenueSchema.shape.priceRange,
  isBoutique: VenueSchema.shape.isBoutique,
  editorialNote: z.string().max(1000).nullable(),
  googleRating: z.number().min(0).max(5).nullable(),
  googleRatingCount: z.number().int().min(0).nullable(),
});
export type VenueListItem = z.infer<typeof VenueListItemSchema>;

const VenueListResponseSchema = z.object({
  data: z.array(VenueListItemSchema),
  meta: z.object({ next_cursor: z.string().nullable(), has_more: z.boolean() }),
});

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
  const raw = await res.json();
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
  const raw = await res.json();
  const result = FavoriteSchema.safeParse(raw);
  if (!result.success) throw new ApiValidationError(`/me/lists/${listId}/venues`, result.error.issues);
}

const ReportResponseSchema = z.object({ urgent: z.boolean() });

export async function reportVenue(venueId: string, reason: string) {
  const res = await fetch(`${API_BASE_URL}/venues/${venueId}/report`, {
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gurmego/mobile test src/lib/api.spec.ts`
Expected: PASS

- [ ] **Step 5: Add `@gurmego/shared` as a workspace dependency**

Edit `apps/mobile/package.json`'s `"dependencies"`:
```json
"@gurmego/shared": "workspace:*",
```
Run: `pnpm install` (from repo root, to link the workspace dependency)

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/api.ts apps/mobile/src/lib/api.spec.ts apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): add validated API client layer"
```

---

### Task 5: Discovery screen — venue list + district filter

**Files:**
- Modify: `apps/mobile/src/screens/DiscoveryScreen.tsx`
- Modify: `apps/mobile/src/navigation/RootNavigator.tsx` (add `VenueDetail` route so list items can
  navigate — screen itself built in Task 8, this task only reserves the route name)
- Test: `apps/mobile/src/screens/DiscoveryScreen.spec.tsx`

**Interfaces:**
- Consumes: `getVenues`, `getDistricts`, `VenueListItem` from Task 4's `src/lib/api.ts`.
- Produces: `RootStackParamList` gains a `VenueDetail: { slug: string }` route (Task 8 implements
  the screen component; this task only adds the route name to the type + navigator so `onPress`
  handlers here compile against it).

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/screens/DiscoveryScreen.spec.tsx`:

```tsx
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import DiscoveryScreen from "./DiscoveryScreen";
import { getVenues, getDistricts } from "../lib/api";

jest.mock("../lib/api", () => ({
  getVenues: jest.fn(),
  getDistricts: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

describe("DiscoveryScreen", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    (getDistricts as jest.Mock).mockResolvedValue([
      { id: "d1", cityId: "c1", name: "Kadıköy", slug: "kadikoy" },
    ]);
  });

  it("lists venues returned by getVenues and navigates to detail on press", async () => {
    (getVenues as jest.Mock).mockResolvedValue({
      data: [
        { id: "v1", name: "Test Cafe", slug: "test-cafe", category: "cafe", priceRange: "MID", isBoutique: true, editorialNote: null, googleRating: null, googleRatingCount: null },
      ],
      meta: { next_cursor: null, has_more: false },
    });

    render(<DiscoveryScreen />);

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy());
    fireEvent.press(screen.getByText("Test Cafe"));
    expect(mockNavigate).toHaveBeenCalledWith("VenueDetail", { slug: "test-cafe" });
  });

  it("filters by district when a district chip is pressed", async () => {
    (getVenues as jest.Mock).mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });

    render(<DiscoveryScreen />);

    await waitFor(() => expect(screen.getByText("Kadıköy")).toBeTruthy());
    fireEvent.press(screen.getByText("Kadıköy"));

    await waitFor(() =>
      expect(getVenues).toHaveBeenLastCalledWith(expect.objectContaining({ districtId: "d1" }), undefined),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gurmego/mobile test src/screens/DiscoveryScreen.spec.tsx`
Expected: FAIL — the placeholder screen has no venue list, no district chips.

- [ ] **Step 3: Write the implementation**

Replace `apps/mobile/src/screens/DiscoveryScreen.tsx`:

```tsx
import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getVenues, getDistricts, type VenueListItem } from "../lib/api";
import type { District } from "@gurmego/shared";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList, "Discovery">;

export default function DiscoveryScreen() {
  const navigation = useNavigation<Nav>();
  const [venues, setVenues] = useState<VenueListItem[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | undefined>(undefined);

  useEffect(() => {
    getDistricts().then(setDistricts).catch(() => setDistricts([]));
  }, []);

  useEffect(() => {
    const query: Record<string, string> = {};
    if (selectedDistrictId) query.districtId = selectedDistrictId;
    getVenues(query).then((res) => setVenues(res.data)).catch(() => setVenues([]));
  }, [selectedDistrictId]);

  return (
    <View>
      <FlatList
        horizontal
        data={districts}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelectedDistrictId(item.id)}>
            <Text>{item.name}</Text>
          </Pressable>
        )}
      />
      <FlatList
        data={venues}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate("VenueDetail", { slug: item.slug })}>
            <Text>{item.name}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 4: Add the `VenueDetail` route name to the navigator's param list**

Edit `apps/mobile/src/navigation/RootNavigator.tsx`, update the type and (temporarily, until
Task 8) point it at the same `DiscoveryScreen` component so the app still compiles and runs:

```tsx
export type RootStackParamList = {
  Discovery: undefined;
  VenueDetail: { slug: string };
};
```
And add a second `<Stack.Screen>` entry right after the `Discovery` one:
```tsx
<Stack.Screen name="VenueDetail" component={DiscoveryScreen} options={{ title: "Mekan" }} />
```
(Task 8 replaces `component={DiscoveryScreen}` here with the real `VenueDetailScreen`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @gurmego/mobile test src/screens/DiscoveryScreen.spec.tsx`
Expected: PASS

- [ ] **Step 6: Run the full test suite to confirm no regression**

Run: `pnpm --filter @gurmego/mobile test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/screens/DiscoveryScreen.tsx apps/mobile/src/screens/DiscoveryScreen.spec.tsx apps/mobile/src/navigation/RootNavigator.tsx
git commit -m "feat(mobile): discovery screen with district filter and venue list"
```

---

### Task 6: Category + price filters

**Files:**
- Modify: `apps/mobile/src/screens/DiscoveryScreen.tsx`
- Modify: `apps/mobile/src/screens/DiscoveryScreen.spec.tsx`

**Interfaces:**
- Consumes: `getVenues` (already produced by Task 4; this task only adds more query params to
  existing calls).
- Produces: nothing new for later tasks — this task only extends Task 5's screen.

- [ ] **Step 1: Write the failing test**

Add to `apps/mobile/src/screens/DiscoveryScreen.spec.tsx` (inside the existing `describe` block):

```tsx
  it("filters by price range when a price chip is pressed", async () => {
    (getVenues as jest.Mock).mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });

    render(<DiscoveryScreen />);

    await waitFor(() => expect(screen.getByText("₺₺")).toBeTruthy());
    fireEvent.press(screen.getByText("₺₺"));

    await waitFor(() =>
      expect(getVenues).toHaveBeenLastCalledWith(expect.objectContaining({ priceRange: "MID" }), undefined),
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gurmego/mobile test src/screens/DiscoveryScreen.spec.tsx`
Expected: FAIL — no price chips rendered yet.

- [ ] **Step 3: Add price filter chips to the implementation**

Edit `apps/mobile/src/screens/DiscoveryScreen.tsx` — add a `PRICE_RANGES` constant and a second
row of `Pressable` chips, and merge the selected price into the `getVenues` query:

```tsx
const PRICE_RANGES: { label: string; value: string }[] = [
  { label: "₺", value: "LOW" },
  { label: "₺₺", value: "MID" },
  { label: "₺₺₺", value: "HIGH" },
];
```

Add state:
```tsx
const [selectedPriceRange, setSelectedPriceRange] = useState<string | undefined>(undefined);
```

Update the venue-fetching effect's dependency array and query body:
```tsx
useEffect(() => {
  const query: Record<string, string> = {};
  if (selectedDistrictId) query.districtId = selectedDistrictId;
  if (selectedPriceRange) query.priceRange = selectedPriceRange;
  getVenues(query).then((res) => setVenues(res.data)).catch(() => setVenues([]));
}, [selectedDistrictId, selectedPriceRange]);
```

Add the price chip row (after the district `FlatList`, before the venues `FlatList`):
```tsx
<FlatList
  horizontal
  data={PRICE_RANGES}
  keyExtractor={(p) => p.value}
  renderItem={({ item }) => (
    <Pressable onPress={() => setSelectedPriceRange(item.value)}>
      <Text>{item.label}</Text>
    </Pressable>
  )}
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gurmego/mobile test src/screens/DiscoveryScreen.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/DiscoveryScreen.tsx apps/mobile/src/screens/DiscoveryScreen.spec.tsx
git commit -m "feat(mobile): add price range filter to discovery screen"
```

---

### Task 7: Native location permission + distance-based sort

**Files:**
- Create: `apps/mobile/src/lib/use-location.ts`
- Modify: `apps/mobile/src/screens/DiscoveryScreen.tsx`
- Test: `apps/mobile/src/lib/use-location.spec.ts`

**Interfaces:**
- Consumes: `locationHeaders`, `Coords` from Task 4's `src/lib/api.ts`.
- Produces: `useLocation(): Coords | null` — a hook, native counterpart of
  `apps/web/src/lib/use-geolocation.ts`'s `useGeolocation()`. This is the concrete implementation
  of the design doc's §3 "native location experience" claim (one of the two stated reasons for the
  pivot) — earlier tasks deliberately left it out of `DiscoveryScreen`'s query so this task's diff
  stays isolated and reviewable on its own.

- [ ] **Step 1: Install `expo-location`**

```bash
pnpm --filter @gurmego/mobile add expo-location
```

- [ ] **Step 2: Write the failing test**

Create `apps/mobile/src/lib/use-location.spec.ts`:

```ts
import { renderHook, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";
import { useLocation } from "./use-location";

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

describe("useLocation", () => {
  it("returns coords once permission is granted and a position is read", async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 40.99, longitude: 29.02 },
    });

    const { result } = renderHook(() => useLocation());

    await waitFor(() => expect(result.current).toEqual({ lat: 40.99, lng: 29.02 }));
  });

  it("returns null (never throws) when permission is denied", async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied" });

    const { result } = renderHook(() => useLocation());

    await waitFor(() => expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @gurmego/mobile test src/lib/use-location.spec.ts`
Expected: FAIL — `./use-location` module does not exist yet.

- [ ] **Step 4: Write the implementation**

Create `apps/mobile/src/lib/use-location.ts`:

```ts
import { useEffect, useState } from "react";
import * as Location from "expo-location";
import type { Coords } from "./api";

// Native counterpart of apps/web/src/lib/use-geolocation.ts's useGeolocation() -- same "silently
// fall back to null on denial/error, no error UI" contract, but going through Expo's real native
// permission prompt (iOS/Android system dialog) instead of the browser's geolocation API.
export function useLocation(): Coords | null {
  const [coords, setCoords] = useState<Coords | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const position = await Location.getCurrentPositionAsync({});
      if (cancelled) return;
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
    })().catch(() => {
      // Permission denied or position unavailable -- silently fall back, no error UI needed,
      // same contract as the web hook this mirrors.
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return coords;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @gurmego/mobile test src/lib/use-location.spec.ts`
Expected: PASS

- [ ] **Step 6: Wire the hook into `DiscoveryScreen`**

Edit `apps/mobile/src/screens/DiscoveryScreen.tsx` — import and call the hook, pass its result as
the second argument to `getVenues` (already accepts `coords?: Coords | null`, unused until now):

```tsx
import { useLocation } from "../lib/use-location";
```

Add inside the component body:
```tsx
const coords = useLocation();
```

Update the venue-fetching effect's dependency array and call:
```tsx
useEffect(() => {
  const query: Record<string, string> = {};
  if (selectedDistrictId) query.districtId = selectedDistrictId;
  if (selectedPriceRange) query.priceRange = selectedPriceRange;
  getVenues(query, coords).then((res) => setVenues(res.data)).catch(() => setVenues([]));
}, [selectedDistrictId, selectedPriceRange, coords]);
```

- [ ] **Step 7: Add the required permission strings to `app.json`**

Edit `apps/mobile/app.json` — add under `"expo"`:
```json
"ios": {
  "infoPlistProperties": {
    "NSLocationWhenInUseUsageDescription": "GurmeGo, yakınındaki mekanları göstermek için konumunu kullanır."
  }
},
"android": {
  "permissions": ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"]
},
```
(Merge into any existing `"ios"`/`"android"` keys rather than duplicating them if the scaffold
already created some.)

- [ ] **Step 8: Run the full test suite to confirm no regression**

Run: `pnpm --filter @gurmego/mobile test`
Expected: PASS

- [ ] **Step 9: Manual verification (Expo Go / simulator — REQUIRED, permission prompts cannot be
  driven by Jest)**

Run: `pnpm --filter @gurmego/mobile start`. Confirm the OS permission dialog appears on first
launch, and that denying it does not crash the app or block the venue list from loading (it just
loads without distance-based sorting).

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/src/lib/use-location.ts apps/mobile/src/lib/use-location.spec.ts apps/mobile/src/screens/DiscoveryScreen.tsx apps/mobile/app.json apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): add native location permission and distance-based venue sort"
```

---

### Task 8: Venue detail screen + map

**Files:**
- Create: `apps/mobile/src/screens/VenueDetailScreen.tsx`
- Modify: `apps/mobile/src/navigation/RootNavigator.tsx` (point `VenueDetail` route at the real
  screen)
- Test: `apps/mobile/src/screens/VenueDetailScreen.spec.tsx`

**Interfaces:**
- Consumes: `getVenueBySlug` from Task 4's `src/lib/api.ts`; `RootStackParamList` from Task 5.
- Produces: nothing new for later tasks (Tasks 9-11, 13 add buttons INTO this screen, see their
  own Files/Interfaces sections).

- [ ] **Step 1: Install `react-native-maps`**

```bash
pnpm --filter @gurmego/mobile add react-native-maps
```

- [ ] **Step 2: Write the failing test**

Create `apps/mobile/src/screens/VenueDetailScreen.spec.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react-native";
import VenueDetailScreen from "./VenueDetailScreen";
import { getVenueBySlug } from "../lib/api";

jest.mock("../lib/api", () => ({ getVenueBySlug: jest.fn() }));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useRoute: () => ({ params: { slug: "test-cafe" } }),
}));
jest.mock("react-native-maps", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: View, Marker: View };
});

describe("VenueDetailScreen", () => {
  it("fetches and shows the venue's name, price range, and editorial note", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue({
      id: "v1", slug: "test-cafe", name: "Test Cafe", category: "cafe", cuisineType: null,
      priceRange: "MID", signatureItems: [], transportNote: null, openingHours: {},
      editorialNote: "Sakin bir köşe.", isBoutique: true, verifiedAt: "2026-01-01T00:00:00.000Z",
      source: "MANUAL", googleRating: null, googleRatingCount: null, googlePlaceId: null,
      district: { name: "Kadıköy", slug: "kadikoy" }, lat: 40.99, lng: 29.02, address: null, photos: [],
    });

    render(<VenueDetailScreen />);

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy());
    expect(screen.getByText("Sakin bir köşe.")).toBeTruthy();
    expect(getVenueBySlug).toHaveBeenCalledWith("test-cafe");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @gurmego/mobile test src/screens/VenueDetailScreen.spec.tsx`
Expected: FAIL — `./VenueDetailScreen` module does not exist yet.

- [ ] **Step 4: Write the implementation**

Create `apps/mobile/src/screens/VenueDetailScreen.tsx`:

```tsx
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import MapView, { Marker } from "react-native-maps";
import { getVenueBySlug } from "../lib/api";
import type { VenueDetail } from "@gurmego/shared";
import type { RootStackParamList } from "../navigation/RootNavigator";

type VenueDetailRoute = RouteProp<RootStackParamList, "VenueDetail">;

export default function VenueDetailScreen() {
  const route = useRoute<VenueDetailRoute>();
  const [venue, setVenue] = useState<VenueDetail | null>(null);

  useEffect(() => {
    getVenueBySlug(route.params.slug).then(setVenue).catch(() => setVenue(null));
  }, [route.params.slug]);

  if (!venue) return null;

  return (
    <ScrollView>
      <Text>{venue.name}</Text>
      <Text>{venue.priceRange}</Text>
      {venue.editorialNote && <Text>{venue.editorialNote}</Text>}
      <View style={{ height: 200 }}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={{ latitude: venue.lat, longitude: venue.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
        >
          <Marker coordinate={{ latitude: venue.lat, longitude: venue.lng }} title={venue.name} />
        </MapView>
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 5: Point the navigator at the real screen**

Edit `apps/mobile/src/navigation/RootNavigator.tsx` — replace the `VenueDetail` screen's
`component={DiscoveryScreen}` with the real import:

```tsx
import VenueDetailScreen from "../screens/VenueDetailScreen";
```
```tsx
<Stack.Screen name="VenueDetail" component={VenueDetailScreen} options={{ title: "Mekan" }} />
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @gurmego/mobile test src/screens/VenueDetailScreen.spec.tsx`
Expected: PASS

- [ ] **Step 7: Run the full test suite to confirm no regression**

Run: `pnpm --filter @gurmego/mobile test`
Expected: PASS

- [ ] **Step 8: Manual verification (Expo Go / simulator)**

Run: `pnpm --filter @gurmego/mobile start`. Navigate Discovery → tap a venue → confirm the detail
screen shows the map with a marker at the venue's location, no red-box errors. `react-native-maps`
requires a native rebuild outside Expo Go on some SDK versions — if the map doesn't render in Expo
Go, run `npx expo run:ios` / `npx expo run:android` instead and note this in the task's PR/commit
description.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/screens/VenueDetailScreen.tsx apps/mobile/src/screens/VenueDetailScreen.spec.tsx apps/mobile/src/navigation/RootNavigator.tsx apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): venue detail screen with react-native-maps"
```

---

### Task 9: "Get directions" deep link

**Files:**
- Create: `apps/mobile/src/lib/directions.ts`
- Modify: `apps/mobile/src/screens/VenueDetailScreen.tsx`
- Test: `apps/mobile/src/lib/directions.spec.ts`

**Interfaces:**
- Consumes: nothing new (pure function).
- Produces: `directionsUrl(venueName: string, districtName: string): string` — a plain string
  builder, same as `apps/web/src/lib/directions.ts`; consumed only inside this task's own screen
  change.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/lib/directions.spec.ts`:

```ts
import { directionsUrl } from "./directions";

describe("directionsUrl", () => {
  it("builds a Google Maps text-search deep link from venue name and district", () => {
    const url = directionsUrl("Test Cafe", "Kadıköy");
    expect(url).toBe("https://www.google.com/maps/dir/?api=1&destination=Test%20Cafe%20Kad%C4%B1k%C3%B6y");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gurmego/mobile test src/lib/directions.spec.ts`
Expected: FAIL — `./directions` module does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/src/lib/directions.ts` (identical logic to `apps/web/src/lib/directions.ts` —
see that file's own comment for why a name+district text search is used instead of lat/lng):

```ts
export function directionsUrl(venueName: string, districtName: string): string {
  const query = encodeURIComponent(`${venueName} ${districtName}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gurmego/mobile test src/lib/directions.spec.ts`
Expected: PASS

- [ ] **Step 5: Add the "Get directions" button to the venue detail screen**

Edit `apps/mobile/src/screens/VenueDetailScreen.tsx` — import `Linking` from `react-native` and
`directionsUrl`, add a `Pressable`:

```tsx
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { directionsUrl } from "../lib/directions";
```

Add after the `MapView` block:
```tsx
<Pressable onPress={() => Linking.openURL(directionsUrl(venue.name, venue.district.name))}>
  <Text>Buraya nasıl giderim</Text>
</Pressable>
```

- [ ] **Step 6: Run the full test suite to confirm no regression**

Run: `pnpm --filter @gurmego/mobile test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/lib/directions.ts apps/mobile/src/lib/directions.spec.ts apps/mobile/src/screens/VenueDetailScreen.tsx
git commit -m "feat(mobile): add get-directions deep link to venue detail screen"
```

---

### Task 10: Share button

**Files:**
- Modify: `apps/mobile/src/screens/VenueDetailScreen.tsx`
- Modify: `apps/mobile/src/screens/VenueDetailScreen.spec.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

Add to `apps/mobile/src/screens/VenueDetailScreen.spec.tsx`, inside the existing `describe` block
(and add `jest.mock("react-native", ...)` is NOT needed — mock only `Share.share` via
`jest.spyOn`):

```tsx
  it("calls the native Share sheet with the venue name when the share button is pressed", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue({
      id: "v1", slug: "test-cafe", name: "Test Cafe", category: "cafe", cuisineType: null,
      priceRange: "MID", signatureItems: [], transportNote: null, openingHours: {},
      editorialNote: null, isBoutique: true, verifiedAt: "2026-01-01T00:00:00.000Z",
      source: "MANUAL", googleRating: null, googleRatingCount: null, googlePlaceId: null,
      district: { name: "Kadıköy", slug: "kadikoy" }, lat: 40.99, lng: 29.02, address: null, photos: [],
    });
    const { Share } = require("react-native");
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction });

    render(<VenueDetailScreen />);

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy());
    fireEvent.press(screen.getByText("Paylaş"));

    expect(shareSpy).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Test Cafe") }));
  });
```

Also add `fireEvent` to this spec file's existing import line (`import { render, screen, waitFor,
fireEvent } from "@testing-library/react-native";`).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gurmego/mobile test src/screens/VenueDetailScreen.spec.tsx`
Expected: FAIL — no "Paylaş" button rendered yet.

- [ ] **Step 3: Add the share button to the implementation**

Edit `apps/mobile/src/screens/VenueDetailScreen.tsx` — import `Share` from `react-native`:

```tsx
import { Linking, Pressable, ScrollView, Share, Text, View } from "react-native";
```

Add after the "Buraya nasıl giderim" button:
```tsx
<Pressable
  onPress={() =>
    Share.share({
      message: `${venue.name} — GurmeGo'da keşfet: https://gurmego.com/mekan/${venue.slug}`,
    })
  }
>
  <Text>Paylaş</Text>
</Pressable>
```

Note: the share URL uses a placeholder `gurmego.com` domain — this must be replaced with the real
production domain once Plan 4e's Adım 4 (Cloudflare DNS) is complete; tracked there, not here.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gurmego/mobile test src/screens/VenueDetailScreen.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/VenueDetailScreen.tsx apps/mobile/src/screens/VenueDetailScreen.spec.tsx
git commit -m "feat(mobile): add native share button to venue detail screen"
```

---

### Task 11: "Report wrong info" form

**Files:**
- Create: `apps/mobile/src/components/ReportForm.tsx`
- Modify: `apps/mobile/src/screens/VenueDetailScreen.tsx`
- Test: `apps/mobile/src/components/ReportForm.spec.tsx`

**Interfaces:**
- Consumes: `reportVenue` from Task 4's `src/lib/api.ts`.
- Produces: `ReportForm` (default export, props `{ venueId: string }`) — mounted by
  `VenueDetailScreen` in this task's Step 5.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/components/ReportForm.spec.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import ReportForm from "./ReportForm";
import { reportVenue } from "../lib/api";

jest.mock("../lib/api", () => ({ reportVenue: jest.fn() }));

describe("ReportForm", () => {
  it("submits the typed reason and shows a thank-you message on success", async () => {
    (reportVenue as jest.Mock).mockResolvedValue({ urgent: false });

    render(<ReportForm venueId="v1" />);

    fireEvent.changeText(screen.getByPlaceholderText("Örn. fiyat aralığı güncel değil"), "Fiyat yanlış");
    fireEvent.press(screen.getByText("Gönder"));

    await waitFor(() => expect(reportVenue).toHaveBeenCalledWith("v1", "Fiyat yanlış"));
    await waitFor(() => expect(screen.getByText(/kürasyon ekibine iletildi/)).toBeTruthy());
  });

  it("shows an error message when the submission fails", async () => {
    (reportVenue as jest.Mock).mockRejectedValue(new Error("network error"));

    render(<ReportForm venueId="v1" />);

    fireEvent.changeText(screen.getByPlaceholderText("Örn. fiyat aralığı güncel değil"), "Fiyat yanlış");
    fireEvent.press(screen.getByText("Gönder"));

    await waitFor(() => expect(screen.getByText(/Bildirim gönderilemedi/)).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gurmego/mobile test src/components/ReportForm.spec.tsx`
Expected: FAIL — `./ReportForm` module does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/src/components/ReportForm.tsx`:

```tsx
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { reportVenue } from "../lib/api";

export default function ReportForm({ venueId }: { venueId: string }) {
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await reportVenue(venueId, reason);
      setSubmitted(true);
    } catch {
      setError("Bildirim gönderilemedi, lütfen tekrar dene.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <View>
        <Text>Teşekkürler, bildirimin kürasyon ekibine iletildi.</Text>
      </View>
    );
  }

  return (
    <View>
      <Text>Bilgi yanlış mı?</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="Örn. fiyat aralığı güncel değil"
        multiline
      />
      {error && <Text>{error}</Text>}
      <Pressable onPress={handleSubmit} disabled={submitting}>
        <Text>{submitting ? "Gönderiliyor…" : "Gönder"}</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gurmego/mobile test src/components/ReportForm.spec.tsx`
Expected: PASS

- [ ] **Step 5: Mount `ReportForm` in the venue detail screen**

Edit `apps/mobile/src/screens/VenueDetailScreen.tsx` — import and render it:

```tsx
import ReportForm from "../components/ReportForm";
```

Add at the end of the `<ScrollView>`, after the share button:
```tsx
<ReportForm venueId={venue.id} />
```

- [ ] **Step 6: Run the full test suite to confirm no regression**

Run: `pnpm --filter @gurmego/mobile test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/components/ReportForm.tsx apps/mobile/src/components/ReportForm.spec.tsx apps/mobile/src/screens/VenueDetailScreen.tsx
git commit -m "feat(mobile): add report-wrong-info form to venue detail screen"
```

---

### Task 12: Login / register screen

**Files:**
- Create: `apps/mobile/src/screens/AuthScreen.tsx`
- Modify: `apps/mobile/src/navigation/RootNavigator.tsx`
- Test: `apps/mobile/src/screens/AuthScreen.spec.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`signIn`, `signUp`) from Task 3's `src/lib/auth-context.tsx`.
- Produces: `RootStackParamList` gains an `Auth: undefined` route — consumed by Task 13's
  favorite-button "sign in first" redirect.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/screens/AuthScreen.spec.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import AuthScreen from "./AuthScreen";
import { useAuth } from "../lib/auth-context";

jest.mock("../lib/auth-context", () => ({ useAuth: jest.fn() }));

describe("AuthScreen", () => {
  it("calls signIn with the typed email and password", async () => {
    const signIn = jest.fn().mockResolvedValue({ error: null });
    (useAuth as jest.Mock).mockReturnValue({ signIn, signUp: jest.fn() });

    render(<AuthScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("E-posta"), "test@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Şifre"), "sifre123");
    fireEvent.press(screen.getByText("Giriş yap"));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith("test@example.com", "sifre123"));
  });

  it("shows the error message returned by signIn on failure", async () => {
    const signIn = jest.fn().mockResolvedValue({ error: "Invalid credentials" });
    (useAuth as jest.Mock).mockReturnValue({ signIn, signUp: jest.fn() });

    render(<AuthScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("E-posta"), "test@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Şifre"), "wrong");
    fireEvent.press(screen.getByText("Giriş yap"));

    await waitFor(() => expect(screen.getByText("Invalid credentials")).toBeTruthy());
  });

  it("switches to register mode and calls signUp with the typed email and password", async () => {
    const signUp = jest.fn().mockResolvedValue({ error: null });
    (useAuth as jest.Mock).mockReturnValue({ signIn: jest.fn(), signUp });

    render(<AuthScreen />);

    fireEvent.press(screen.getByText("Hesabın yok mu? Kayıt ol"));
    fireEvent.changeText(screen.getByPlaceholderText("E-posta"), "new@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Şifre"), "yenisifre123");
    fireEvent.press(screen.getByText("Kayıt ol"));

    await waitFor(() => expect(signUp).toHaveBeenCalledWith("new@example.com", "yenisifre123"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gurmego/mobile test src/screens/AuthScreen.spec.tsx`
Expected: FAIL — `./AuthScreen` module does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/src/screens/AuthScreen.tsx`:

```tsx
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "../lib/auth-context";

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    const result = mode === "signIn" ? await signIn(email, password) : await signUp(email, password);
    if (result.error) setError(result.error);
  }

  return (
    <View>
      <TextInput value={email} onChangeText={setEmail} placeholder="E-posta" autoCapitalize="none" />
      <TextInput value={password} onChangeText={setPassword} placeholder="Şifre" secureTextEntry />
      {error && <Text>{error}</Text>}
      <Pressable onPress={handleSubmit}>
        <Text>{mode === "signIn" ? "Giriş yap" : "Kayıt ol"}</Text>
      </Pressable>
      <Pressable onPress={() => setMode(mode === "signIn" ? "signUp" : "signIn")}>
        <Text>{mode === "signIn" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gurmego/mobile test src/screens/AuthScreen.spec.tsx`
Expected: PASS

- [ ] **Step 5: Register the `Auth` route**

Edit `apps/mobile/src/navigation/RootNavigator.tsx`:

```tsx
export type RootStackParamList = {
  Discovery: undefined;
  VenueDetail: { slug: string };
  Auth: undefined;
};
```
```tsx
import AuthScreen from "../screens/AuthScreen";
```
```tsx
<Stack.Screen name="Auth" component={AuthScreen} options={{ title: "Giriş yap" }} />
```

- [ ] **Step 6: Run the full test suite to confirm no regression**

Run: `pnpm --filter @gurmego/mobile test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/screens/AuthScreen.tsx apps/mobile/src/screens/AuthScreen.spec.tsx apps/mobile/src/navigation/RootNavigator.tsx
git commit -m "feat(mobile): add sign-in/register screen"
```

---

### Task 13: Favorite button

**Files:**
- Create: `apps/mobile/src/components/FavoriteButton.tsx`
- Modify: `apps/mobile/src/screens/VenueDetailScreen.tsx`
- Test: `apps/mobile/src/components/FavoriteButton.spec.tsx`

**Interfaces:**
- Consumes: `useAuth()` from Task 3; `getFavoriteLists`, `createFavoriteList`, `addFavoriteVenue`
  from Task 4; `RootStackParamList` (`Auth` route) from Task 12.
- Produces: `FavoriteButton` (default export, props `{ venueId: string }`) — mounted by
  `VenueDetailScreen` in this task's Step 5.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/components/FavoriteButton.spec.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import FavoriteButton from "./FavoriteButton";
import { useAuth } from "../lib/auth-context";
import { getFavoriteLists, createFavoriteList, addFavoriteVenue } from "../lib/api";

jest.mock("../lib/auth-context", () => ({ useAuth: jest.fn() }));
jest.mock("../lib/api", () => ({
  getFavoriteLists: jest.fn(),
  createFavoriteList: jest.fn(),
  addFavoriteVenue: jest.fn(),
}));
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

describe("FavoriteButton", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    (getFavoriteLists as jest.Mock).mockReset();
    (createFavoriteList as jest.Mock).mockReset();
    (addFavoriteVenue as jest.Mock).mockReset();
  });

  it("navigates to Auth instead of favoriting when the user is signed out", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, session: null });

    render(<FavoriteButton venueId="v1" />);
    fireEvent.press(screen.getByText("Favorilere ekle"));

    expect(mockNavigate).toHaveBeenCalledWith("Auth");
    expect(getFavoriteLists).not.toHaveBeenCalled();
  });

  it("creates a default list and adds the venue when the signed-in user has no lists yet", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "u1" }, session: { access_token: "tok" } });
    (getFavoriteLists as jest.Mock).mockResolvedValueOnce([]); // initial "already favorited" check
    (getFavoriteLists as jest.Mock).mockResolvedValueOnce([]); // handleClick's own fetch
    (createFavoriteList as jest.Mock).mockResolvedValue({ id: "list1", userId: "u1", name: "Favorilerim", createdAt: "2026-01-01T00:00:00.000Z", favorites: [] });
    (addFavoriteVenue as jest.Mock).mockResolvedValue(undefined);

    render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByText("Favorilere ekle")).toBeTruthy());
    fireEvent.press(screen.getByText("Favorilere ekle"));

    await waitFor(() => expect(addFavoriteVenue).toHaveBeenCalledWith("tok", "list1", "v1"));
    await waitFor(() => expect(screen.getByText("Favorilerde")).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gurmego/mobile test src/components/FavoriteButton.spec.tsx`
Expected: FAIL — `./FavoriteButton` module does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/src/components/FavoriteButton.tsx` (same request-generation-counter pattern as
`apps/web/src/components/favorite-button.tsx` — see that file's comments for why two separate
refs, not one, guard `added` vs. `pending`):

```tsx
import { useEffect, useRef, useState } from "react";
import { Pressable, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/auth-context";
import { getFavoriteLists, createFavoriteList, addFavoriteVenue } from "../lib/api";
import type { RootStackParamList } from "../navigation/RootNavigator";

const DEFAULT_LIST_NAME = "Favorilerim";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function FavoriteButton({ venueId }: { venueId: string }) {
  const { user, session } = useAuth();
  const navigation = useNavigation<Nav>();
  const [added, setAdded] = useState(false);
  const [pending, setPending] = useState(false);
  const latestClickRequest = useRef(0);
  const latestPendingRequest = useRef(0);

  useEffect(() => {
    latestClickRequest.current += 1;
    latestPendingRequest.current += 1;
    setPending(false);
    if (!user || !session?.access_token) {
      setAdded(false);
      return;
    }
    let cancelled = false;
    setAdded(false);
    getFavoriteLists(session.access_token)
      .then((lists) => {
        if (cancelled) return;
        const isFavorited = lists.some((list) => list.favorites.some((fav) => fav.venueId === venueId));
        if (isFavorited) setAdded(true);
      })
      .catch(() => {
        // Initial "already favorited" check failed -- leave `added` as false, favoriting still
        // works via handleClick's own flow.
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, session?.access_token, venueId]);

  async function handleClick() {
    if (!user) {
      navigation.navigate("Auth");
      return;
    }
    if (!session?.access_token) return;
    const requestId = ++latestClickRequest.current;
    const pendingRequestId = ++latestPendingRequest.current;
    setPending(true);
    try {
      const lists = await getFavoriteLists(session.access_token);
      const list = lists[0] ?? (await createFavoriteList(session.access_token, DEFAULT_LIST_NAME));
      await addFavoriteVenue(session.access_token, list.id, venueId);
      if (requestId === latestClickRequest.current) setAdded(true);
    } catch {
      // Swallow -- no error-display UI here, button re-enables via `finally` so the user can retry.
    } finally {
      if (pendingRequestId === latestPendingRequest.current) setPending(false);
    }
  }

  return (
    <Pressable onPress={handleClick} disabled={pending}>
      <Text>{added ? "Favorilerde" : "Favorilere ekle"}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gurmego/mobile test src/components/FavoriteButton.spec.tsx`
Expected: PASS

- [ ] **Step 5: Mount `FavoriteButton` in the venue detail screen**

Edit `apps/mobile/src/screens/VenueDetailScreen.tsx` — import and render it, right after the
"Buraya nasıl giderim" button:

```tsx
import FavoriteButton from "../components/FavoriteButton";
```
```tsx
<FavoriteButton venueId={venue.id} />
```

- [ ] **Step 6: Run the full test suite to confirm no regression**

Run: `pnpm --filter @gurmego/mobile test`
Expected: PASS

- [ ] **Step 7: Manual verification (Expo Go / simulator)**

Run: `pnpm --filter @gurmego/mobile start`. With a real local Supabase + API running (see
`docs/STATE.md` for local ports), sign in via the Auth screen, navigate to a venue, tap "Favorilere
ekle", confirm it flips to "Favorilerde" and the item shows up via `GET /me/lists` (can check with
`curl` against the local API using the same token).

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/components/FavoriteButton.tsx apps/mobile/src/components/FavoriteButton.spec.tsx apps/mobile/src/screens/VenueDetailScreen.tsx
git commit -m "feat(mobile): add favorite button to venue detail screen"
```

---

### Task 14: Final whole-app review pass

**Files:** none created — this task is verification only.

**Interfaces:** none.

- [ ] **Step 1: Run the full test suite one more time**

Run: `pnpm --filter @gurmego/mobile test`
Expected: PASS, all suites from Tasks 1-12.

- [ ] **Step 2: Run typecheck**

Add a `"typecheck": "tsc --noEmit"` script to `apps/mobile/package.json` if not already present
(the Expo TypeScript template usually includes a `tsconfig.json` already). Run:
`pnpm --filter @gurmego/mobile typecheck`
Expected: PASS, no type errors.

- [ ] **Step 3: Manual end-to-end walkthrough (real device or simulator)**

Run: `pnpm --filter @gurmego/mobile start`. With local Supabase + API running, walk through: open
app → see venue list → filter by district → filter by price → tap a venue → see detail with map →
tap "Buraya nasıl giderim" (opens Maps) → tap "Paylaş" (opens native share sheet) → submit a
"bilgi yanlış" report → sign in → favorite the venue → confirm "Favorilerde" persists across app
restart (token persisted in SecureStore).

- [ ] **Step 4: Cross-model review**

**REQUIRED, per project convention — do not skip.** Run the `cross-model-review` skill (Codex)
against the full `apps/mobile` diff before considering this plan done. Fix any BLOCKER/MAJOR
findings and re-review until TEMİZ, exactly as Task 26/27 did for the web/admin apps.
