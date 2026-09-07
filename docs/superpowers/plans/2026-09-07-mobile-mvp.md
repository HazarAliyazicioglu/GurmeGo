# Mobile MVP (apps/mobile) Implementation Plan — v2 (post plan-red-team)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/mobile` (Expo + React Native), a native iOS/Android app with full feature
parity to `apps/web`'s (Plan 2) consumer feature set — venue discovery/filters (district +
category + price + native location-based sort), full venue detail with map, a Favorites tab
(browse lists, add, remove), "get directions", share, "report wrong info", and auth (sign-in +
register) — against `apps/api`, which gains exactly one new endpoint this plan needs
(`DELETE /v1/me/lists/:id/venues/:venueId`, Task 1) and is otherwise unchanged.

**v2 changes (plan-red-team, Codex, verdict YENİDEN BÖL — full report in git history at
`docs/superpowers/plans/` prior commit):** fixed the Task-1 package-rename-after-install ordering
bug; added a Jest env setup so tests don't depend on external environment; promoted
list/map/report response schemas into `packages/shared` (removes the web/mobile schema-duplication
drift risk); moved dependency installation before first use in every task; built the location hook
before wiring it into Discovery instead of retrofitting (removes the Task 5-vs-7 test conflict);
added the missing category filter, bottom-tab navigation, full venue-detail fields, and a real
Favorites screen with remove; added the backend `DELETE` endpoint needed for remove-favorite
parity (user decision — extends the "zero backend changes" claim from v1, see design doc §8 update).

**Architecture:** New pnpm workspace member, `apps/mobile`. `packages/shared`'s zod schemas are
the single source of truth for response shapes — both `apps/web` and `apps/mobile` import the SAME
schema definitions (Task 2 promotes the ones that used to live only in `apps/web/src/lib/api.ts`).
`packages/api-client` is NOT used at all (its generated response types are `never`-typed
placeholders, not runtime validation — see design doc §3); every request goes through a thin
`fetch` + zod-parse layer instead. Auth via Supabase (`@supabase/supabase-js` +
`expo-secure-store` for token persistence). Navigation: a native stack containing a bottom-tab
navigator (Discovery / Favoriler) plus two stack-level screens (VenueDetail, Auth) reachable from
either tab.

**Tech Stack:** Expo (managed workflow), TypeScript, `@supabase/supabase-js`,
`@react-navigation/native` + `@react-navigation/native-stack` + `@react-navigation/bottom-tabs`,
`react-native-maps`, `expo-location`, React Native's built-in `Share` API (NOT `expo-sharing`),
Jest + `@testing-library/react-native`.

**Spec:** [docs/superpowers/specs/2026-09-07-mobile-mvp-pivot-design.md](../specs/2026-09-07-mobile-mvp-pivot-design.md)

## Global Constraints

- TypeScript `strict: true`; `any` forbidden unless justified inline with a comment.
- All API responses validated with zod schemas from `packages/shared` — every response-shape
  schema lives there, not duplicated per-client. Never rely on `packages/api-client`'s generated
  response types as if they were runtime-validated (they are `never`-typed placeholders).
- No business logic in `apps/mobile` or `apps/web` — display + request layer only. Any rule
  (which list gets a new favorite, rate limits, etc.) lives in `apps/api`.
- User's device location coordinates are NEVER logged or sent to any analytics/logging call — only
  used as a request parameter (`X-User-Location` header; NFR-04).
- Branch naming `feat/...`; commits follow Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`).
- Every task's tests must actually run and pass before that task's commit — for `apps/api` tasks:
  `pnpm --filter @gurmego/api test`; for `apps/mobile` tasks: `pnpm --filter @gurmego/mobile test`;
  for the `apps/web` schema-import change: `pnpm --filter @gurmego/web test`.
- Real device/simulator manual verification (Expo Go, or `expo run:ios`/`run:android` where noted)
  is called out per task where relevant — this plan cannot fully verify native permission/deep-link
  behavior through Jest alone.
- **Out of scope (deferred, tracked elsewhere):** KVKK consent checkbox and account deletion
  (Plan 4d's own backend, not yet built); EAS Build/Submit and store account provisioning (Plan 4e).
  This plan produces working, tested app code; Plan 4e ships it.

---

### Task 1: Backend — `DELETE /v1/me/lists/:id/venues/:venueId`

**Files:**
- Modify: `apps/api/src/favorites/favorites.service.ts`
- Modify: `apps/api/src/favorites/favorites.controller.ts`
- Modify: `apps/api/src/favorites/favorites.service.spec.ts`
- Modify: `apps/api/src/favorites/favorites.controller.spec.ts`

**Interfaces:**
- Consumes: nothing new (existing `PrismaService`, existing `FavoriteList`/`Favorite` Prisma
  models — `@@unique([listId, venueId])` on `Favorite` already supports a composite-key delete).
- Produces: `FavoritesService.removeVenue(userId, listId, venueId): Promise<void>` (throws the
  same `LIST_NOT_FOUND`/`VENUE_NOT_FOUND`-shaped errors as `addVenue` on ownership mismatch) and
  the route `DELETE /me/lists/:id/venues/:venueId` — consumed by Task 6's mobile API client.

- [ ] **Step 1: Write the failing service test**

Add to `apps/api/src/favorites/favorites.service.spec.ts` (inside the existing `describe` block):

```ts
  it("removeVenue rejects when list does not belong to user", async () => {
    prisma.favoriteList.findUnique.mockResolvedValue({ id: "l1", userId: "someone-else" });
    await expect(service.removeVenue("user-1", "l1", "v1")).rejects.toThrow("Liste bulunamadı");
  });

  it("removeVenue deletes the composite-key row when the list belongs to the user", async () => {
    prisma.favoriteList.findUnique.mockResolvedValue({ id: "l1", userId: "u1" });
    prisma.favorite.delete.mockResolvedValue({ id: "f1" });

    await service.removeVenue("u1", "l1", "v1");

    expect(prisma.favorite.delete).toHaveBeenCalledWith({ where: { listId_venueId: { listId: "l1", venueId: "v1" } } });
  });
```

Check the top of that file for how `prisma` is currently constructed as a mock (it already mocks
`favoriteList.findUnique` etc. for the existing `addVenue` tests) and add `favorite: { delete:
jest.fn() }` alongside whatever `favorite` mock already exists there for `upsert`, matching the
same mock-shape convention already in the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gurmego/api test favorites.service.spec.ts`
Expected: FAIL — `removeVenue` is not a function on `FavoritesService` yet.

- [ ] **Step 3: Write the implementation**

Edit `apps/api/src/favorites/favorites.service.ts` — add after `addVenue`:

```ts
  async removeVenue(userId: string, listId: string, venueId: string) {
    const list = await this.prisma.favoriteList.findUnique({ where: { id: listId } });
    if (!list || list.userId !== userId) {
      const notFound = new NotFoundException({ error: { code: "LIST_NOT_FOUND", message: "Liste bulunamadı" } });
      notFound.message = "Liste bulunamadı";
      throw notFound;
    }
    await this.prisma.favorite.delete({ where: { listId_venueId: { listId, venueId } } });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gurmego/api test favorites.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Write the failing controller test**

Add to `apps/api/src/favorites/favorites.controller.spec.ts` — first add `removeVenue: jest.fn()`
to the `service` object's shape (both in its type annotation and in `beforeAll`'s construction,
and reset it in `beforeEach` alongside the other `service.*.mockReset()` calls), then add:

```ts
  it("allows an authenticated user to remove a venue from a list", async () => {
    const listId = "d290f1ee-6c54-4b01-90e6-d701748f0851";
    const venueId = "d290f1ee-6c54-4b01-90e6-d701748f0852";
    service.removeVenue.mockResolvedValue(undefined);

    const res = await app.inject({
      method: "DELETE",
      url: `/me/lists/${listId}/venues/${venueId}`,
      headers: { "x-test-role": "user" },
    });

    expect(res.statusCode).toBe(200);
    expect(service.removeVenue).toHaveBeenCalledWith("test-user", listId, venueId);
  });

  it("rejects a non-UUID venueId on the delete route with 400 before reaching the service", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/me/lists/d290f1ee-6c54-4b01-90e6-d701748f0851/venues/not-a-uuid",
      headers: { "x-test-role": "user" },
    });

    expect(res.statusCode).toBe(400);
    expect(service.removeVenue).not.toHaveBeenCalled();
  });
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter @gurmego/api test favorites.controller.spec.ts`
Expected: FAIL — no `DELETE` route registered yet.

- [ ] **Step 7: Write the controller route**

Edit `apps/api/src/favorites/favorites.controller.ts` — add `Delete` to the `@nestjs/common`
import list, and add after the existing `addVenue` method:

```ts
  @Delete(":id/venues/:venueId")
  removeVenue(
    @Req() req: AuthenticatedRequest,
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) listId: string,
    @Param("venueId", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) venueId: string,
  ) {
    return this.favorites.removeVenue(req.user!.id, listId, venueId);
  }
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter @gurmego/api test favorites.controller.spec.ts`
Expected: PASS

- [ ] **Step 9: Run the full API test suite to confirm no regression**

Run: `pnpm --filter @gurmego/api test`
Expected: PASS, all suites.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/favorites/favorites.service.ts apps/api/src/favorites/favorites.controller.ts apps/api/src/favorites/favorites.service.spec.ts apps/api/src/favorites/favorites.controller.spec.ts
git commit -m "feat(api): add DELETE /me/lists/:id/venues/:venueId to remove a favorite"
```

---

### Task 2: Promote list/map/report response schemas to `packages/shared`

**Files:**
- Modify: `packages/shared/src/schemas/venue.schema.ts`
- Modify: `packages/shared/src/schemas/report.schema.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/web/src/lib/api.ts`
- Test: `packages/shared/src/schemas/venue.schema.spec.ts` (already exists — extend it)

**Interfaces:**
- Consumes: nothing new.
- Produces: `VenueListItemSchema`, `VenueListResponseSchema`, `MapVenueSchema`,
  `MapVenueListSchema` (exported from `@gurmego/shared`, alongside the existing `VenueSchema` etc.)
  and `ReportResponseSchema` — consumed by Task 6's mobile API client AND by `apps/web/src/lib/api.ts`
  (updated in this same task, so there is exactly one definition of each, not two that can drift).

- [ ] **Step 1: Write the failing test**

Add to `packages/shared/src/schemas/venue.schema.spec.ts` (check its existing imports/structure
first — add alongside whatever's already there):

```ts
import { VenueListItemSchema, VenueListResponseSchema, MapVenueSchema } from "./venue.schema";

describe("VenueListItemSchema", () => {
  it("accepts the narrower GET /venues list projection, including nullable editorial fields", () => {
    const result = VenueListItemSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Test Cafe",
      slug: "test-cafe",
      category: "cafe",
      priceRange: "MID",
      isBoutique: true,
      editorialNote: null,
      googleRating: null,
      googleRatingCount: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("VenueListResponseSchema", () => {
  it("accepts a paginated envelope with data + meta", () => {
    const result = VenueListResponseSchema.safeParse({
      data: [],
      meta: { next_cursor: null, has_more: false },
    });
    expect(result.success).toBe(true);
  });
});

describe("MapVenueSchema", () => {
  it("accepts the GET /venues/map projection", () => {
    const result = MapVenueSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Test Cafe",
      category: "cafe",
      lat: 40.99,
      lng: 29.02,
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gurmego/shared test venue.schema.spec.ts`
Expected: FAIL — `VenueListItemSchema` etc. are not exported from `./venue.schema` yet.

- [ ] **Step 3: Add the schemas to `packages/shared`**

Edit `packages/shared/src/schemas/venue.schema.ts` — add at the end of the file (the comments are
carried over verbatim from `apps/web/src/lib/api.ts`, which is where these were originally
defined and validated against real API responses):

```ts
// `GET /venues` (apps/api's `VenuesRepository.searchPublished`) SELECTs only
// `id, name, slug, category, priceRange, isBoutique, editorialNote, googleRating, googleRatingCount`
// (+ `distance_m` when lat/lng given, not surfaced to clients) — a narrower projection than
// `VenueSchema`, not merely "all fields optional". `id`/`name`/`slug`/`category`/`priceRange`/`isBoutique`
// are always present; `editorialNote`/`googleRating`/`googleRatingCount` are genuinely
// DB-nullable columns (raw SQL returns `null`, not `undefined`), so those stay `.nullable()` here.
export const VenueListItemSchema = z.object({
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

export const VenueListResponseSchema = z.object({
  data: z.array(VenueListItemSchema),
  meta: z.object({ next_cursor: z.string().nullable(), has_more: z.boolean() }),
});

// `GET /venues/map` (apps/api's `VenuesController.mapView` -> `VenuesRepository.findInBbox`)
// returns a plain array (no `data`/`meta` envelope) of `{ id, name, category, lat, lng }`.
export const MapVenueSchema = z.object({
  id: VenueSchema.shape.id,
  name: VenueSchema.shape.name,
  category: VenueSchema.shape.category,
  lat: z.number(),
  lng: z.number(),
});
export type MapVenue = z.infer<typeof MapVenueSchema>;

export const MapVenueListSchema = z.array(MapVenueSchema);
```

- [ ] **Step 4: Add `ReportResponseSchema` to `packages/shared`**

Edit `packages/shared/src/schemas/report.schema.ts` — check its existing content first (it likely
already has a request-side schema for the report submission body); add:

```ts
export const ReportResponseSchema = z.object({ urgent: z.boolean() });
```

- [ ] **Step 5: Export the new schemas from the package root**

Edit `packages/shared/src/index.ts` — add the new names to whatever's already re-exported from
`./schemas/venue.schema` and `./schemas/report.schema` (follow the existing export style in that
file — likely `export * from "./schemas/venue.schema"` already covers the new ones automatically
if that's the pattern; if it uses named re-exports instead, add the new names explicitly).

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @gurmego/shared test venue.schema.spec.ts`
Expected: PASS

- [ ] **Step 7: Update `apps/web/src/lib/api.ts` to import instead of redefine**

Edit `apps/web/src/lib/api.ts` — remove the local `VenueListItemSchema`, `VenueListResponseSchema`,
`MapVenueSchema`, `MapVenueListSchema` definitions (and their comments, now living in
`packages/shared`) and the local `ReportResponseSchema` definition; import all of them from
`@gurmego/shared` instead, alongside the existing `VenueSchema`/`VenueDetailSchema`/etc. import.
The exported `VenueListItem`/`MapVenue` types keep the same names (now re-exported from
`@gurmego/shared` rather than defined locally) — no call site elsewhere in `apps/web` needs to
change, since `import type { VenueListItem } from "./api"` still resolves (it's just re-exported).

- [ ] **Step 8: Run the web test suite to confirm no behavior change**

Run: `pnpm --filter @gurmego/web test api.spec.ts`
Expected: PASS — identical behavior, only the schema definitions' location changed.

- [ ] **Step 9: Run the full web and shared test suites**

Run: `pnpm --filter @gurmego/web test && pnpm --filter @gurmego/shared test`
Expected: PASS, all suites, no regressions.

- [ ] **Step 10: Commit**

```bash
git add packages/shared/src/schemas/venue.schema.ts packages/shared/src/schemas/report.schema.ts packages/shared/src/schemas/venue.schema.spec.ts packages/shared/src/index.ts apps/web/src/lib/api.ts
git commit -m "refactor(shared): promote venue list/map/report response schemas out of apps/web"
```

---

### Task 3: Workspace scaffold — `apps/mobile` project + monorepo wiring

**Files:**
- Create: `apps/mobile/` (via `npx create-expo-app@latest apps/mobile --template blank-typescript`,
  run from repo root)
- Modify: `apps/mobile/package.json`
- Create: `apps/mobile/App.tsx`
- Create: `apps/mobile/src/navigation/RootNavigator.tsx`
- Create: `apps/mobile/src/screens/DiscoveryScreen.tsx` (placeholder — real content in Task 9)
- Test: `apps/mobile/App.spec.tsx`

**Interfaces:**
- Consumes: nothing (first mobile task).
- Produces: `RootNavigator` (default export, no props). `DiscoveryScreen` (default export, no
  props) — Task 9 replaces its body but keeps the same export.

- [ ] **Step 1: Scaffold the Expo project**

```bash
npx create-expo-app@latest apps/mobile --template blank-typescript
```

- [ ] **Step 2: Set the package name FIRST, before any filtered install**

Edit `apps/mobile/package.json` immediately after scaffolding, BEFORE running any
`pnpm --filter @gurmego/mobile ...` command (v1 of this plan got this order backwards — every
filtered install below depends on this rename having already happened):

```json
"name": "@gurmego/mobile",
```
Add a `"test"` script:
```json
"test": "jest",
```
Add a `"typecheck"` script:
```json
"typecheck": "tsc --noEmit",
```

- [ ] **Step 3: Install navigation and testing dependencies**

```bash
pnpm --filter @gurmego/mobile add @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context
pnpm --filter @gurmego/mobile add -D jest jest-expo @testing-library/react-native @types/jest
```

- [ ] **Step 4: Add the Jest config block**

Edit `apps/mobile/package.json`, add:
```json
"jest": {
  "preset": "jest-expo",
  "setupFiles": ["<rootDir>/jest.setup.js"]
}
```
(`jest.setup.js` doesn't exist yet — Task 4 creates it. Adding the reference now, before it
exists, is intentional: Task 4 is the very next task and no test runs in between that would need
this config to already resolve.)

- [ ] **Step 5: Write the failing test**

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

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter @gurmego/mobile test`
Expected: FAIL — `App.tsx` still has the scaffold's default content.

- [ ] **Step 7: Create the placeholder discovery screen**

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

- [ ] **Step 8: Create the root navigator**

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

- [ ] **Step 9: Wire `App.tsx`**

Replace `apps/mobile/App.tsx`:

```tsx
import RootNavigator from "./src/navigation/RootNavigator";

export default function App() {
  return <RootNavigator />;
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `pnpm --filter @gurmego/mobile test`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add apps/mobile pnpm-workspace.yaml
git commit -m "feat(mobile): scaffold Expo app with root navigator"
```

---

### Task 4: Environment config — `EXPO_PUBLIC_*` variables + Jest env setup

**Files:**
- Create: `apps/mobile/.env.local.example`
- Create: `apps/mobile/src/lib/env.ts`
- Create: `apps/mobile/jest.setup.js`
- Test: `apps/mobile/src/lib/env.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `API_BASE_URL: string`, `SUPABASE_URL: string`, `SUPABASE_ANON_KEY: string` — named
  exports from `src/lib/env.ts`, consumed by Task 5 (Supabase client) and Task 6 (API client).
  `jest.setup.js` sets dummy values for these three `EXPO_PUBLIC_*` vars in `process.env` for
  EVERY test run in this package (referenced by Task 3's `package.json` Jest config) — so no later
  task's test suite (this plan's own or a real developer's) ever fails because of missing env vars
  in the test environment, only in a genuinely misconfigured real run.

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

  it("reads the value when it is present", () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "http://localhost:9999/v1";
    jest.resetModules();
    const { API_BASE_URL } = require("./env");
    expect(API_BASE_URL).toBe("http://localhost:9999/v1");
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

- [ ] **Step 5: Create the Jest env setup file**

Create `apps/mobile/jest.setup.js` (referenced by Task 3's `package.json` Jest config already —
this is the file that makes that reference resolve):

```js
// Dummy values so every test in this package can import anything that transitively reads
// EXPO_PUBLIC_* env vars (supabase.ts, api.ts) without needing a real .env.local. Tests that care
// about a SPECIFIC value (like env.spec.ts above) override process.env directly and call
// jest.resetModules() first.
process.env.EXPO_PUBLIC_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3001/v1";
process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54421";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key";
```

- [ ] **Step 6: Create the example env file**

Create `apps/mobile/.env.local.example`:

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:3001/v1
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```

- [ ] **Step 7: Run the full test suite to confirm the setup file doesn't break anything**

Run: `pnpm --filter @gurmego/mobile test`
Expected: PASS (both `App.spec.tsx` and `env.spec.ts`)

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/lib/env.ts apps/mobile/src/lib/env.spec.ts apps/mobile/jest.setup.js apps/mobile/.env.local.example apps/mobile/package.json
git commit -m "feat(mobile): add EXPO_PUBLIC_* env config with Jest env setup"
```

---

### Task 5: Supabase client + auth context

**Files:**
- Create: `apps/mobile/src/lib/supabase.ts`
- Create: `apps/mobile/src/lib/auth-context.tsx`
- Modify: `apps/mobile/App.tsx`
- Test: `apps/mobile/src/lib/auth-context.spec.tsx`

**Interfaces:**
- Consumes: `SUPABASE_URL`, `SUPABASE_ANON_KEY` from Task 4's `src/lib/env.ts`.
- Produces: `AuthProvider` (component, wraps children), `useAuth()` hook returning
  `{ user: User | null; session: Session | null; loading: boolean; signIn(email, password):
  Promise<{error: string | null}>; signUp(email, password): Promise<{error: string | null}>;
  signOut(): Promise<{error: string | null}> }` — consumed by Task 14 (Auth screen), Task 15
  (favorite button), and Task 16 (Favorites screen), the screens that need the current user/token.

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
// the native equivalent of apps/web's default localStorage-backed session persistence.
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

Create `apps/mobile/src/lib/auth-context.tsx`:

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
Expected: PASS (`App.spec.tsx` still passes because `jest.setup.js` from Task 4 provides the env
vars `supabase.ts` needs, and `App.spec.tsx` doesn't mock `auth-context`/`supabase` — it exercises
the real `AuthProvider` against the dummy Supabase project URL/key, which is fine: `getSession()`
against a fake URL will reject, `AuthProvider`'s own `.catch()` handles that by setting
`loading: false`, and the Discovery screen underneath doesn't depend on auth state to render).

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/lib/supabase.ts apps/mobile/src/lib/auth-context.tsx apps/mobile/src/lib/auth-context.spec.tsx apps/mobile/App.tsx apps/mobile/package.json
git commit -m "feat(mobile): add Supabase client and auth context"
```

---

### Task 6: API client layer

**Files:**
- Create: `apps/mobile/src/lib/api.ts`
- Test: `apps/mobile/src/lib/api.spec.ts`

**Interfaces:**
- Consumes: `API_BASE_URL` from Task 4's `src/lib/env.ts`; zod schemas from `@gurmego/shared`
  (`VenueSchema`, `VenueDetailSchema`, `DistrictSchema`, `FavoriteListSchema`, `FavoriteSchema`,
  `VenueListItemSchema`, `VenueListResponseSchema`, `ReportResponseSchema` — all promoted to
  `packages/shared` by Task 2, none redefined here).
- Produces: `ApiValidationError` (class), `Coords` (interface), `locationHeaders(coords?)`,
  `getVenues(query, coords?)`, `getVenueBySlug(slug)`, `getDistricts()`, `getFavoriteLists(token)`,
  `createFavoriteList(token, name)`, `addFavoriteVenue(token, listId, venueId)`,
  `removeFavoriteVenue(token, listId, venueId)`, `reportVenue(venueId, reason)` — consumed by
  Tasks 7-16's screens.

- [ ] **Step 1: Add `zod` and `@gurmego/shared` as dependencies BEFORE writing any code that
  imports them**

Edit `apps/mobile/package.json`'s `"dependencies"`:
```json
"@gurmego/shared": "workspace:*",
"zod": "^3.23.0",
```
Run: `pnpm install` (from repo root, to link the workspace dependency and install `zod`).

- [ ] **Step 2: Write the failing test**

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

  it("sends an X-User-Location header when coords are given", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], meta: { next_cursor: null, has_more: false } }),
    }) as jest.Mock;

    await getVenues({}, { lat: 40.99, lng: 29.02 });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ "X-User-Location": "40.99,29.02" }) }),
    );
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

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @gurmego/mobile test src/lib/api.spec.ts`
Expected: FAIL — `./api` module does not exist yet.

- [ ] **Step 4: Write the implementation**

Create `apps/mobile/src/lib/api.ts`:

```ts
import {
  VenueDetailSchema,
  DistrictSchema,
  FavoriteListSchema,
  FavoriteSchema,
  VenueListItemSchema,
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
  const raw = await res.json();
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
  const raw = await res.json();
  const result = ReportResponseSchema.safeParse(raw);
  if (!result.success) throw new ApiValidationError(`/venues/${venueId}/report`, result.error.issues);
  return result.data;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @gurmego/mobile test src/lib/api.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/api.ts apps/mobile/src/lib/api.spec.ts apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): add validated API client layer"
```

---

### Task 7: Native location hook

**Files:**
- Create: `apps/mobile/src/lib/use-location.ts`
- Test: `apps/mobile/src/lib/use-location.spec.ts`

**Interfaces:**
- Consumes: `Coords` (type) from Task 6's `src/lib/api.ts`.
- Produces: `useLocation(): Coords | null` — a hook, native counterpart of
  `apps/web/src/lib/use-geolocation.ts`'s `useGeolocation()`. Built and fully tested here, in
  isolation, BEFORE Task 9 wires it into the Discovery screen — so Task 9 writes the screen's
  location-aware tests once, correctly, instead of retrofitting an earlier version.

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
// fall back to null on denial/error, no error UI" contract, but through Expo's real native
// permission prompt instead of the browser's geolocation API.
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
      // Permission denied or position unavailable -- silently fall back, same contract as the
      // web hook this mirrors.
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

- [ ] **Step 6: Add the required permission strings to `app.json`**

Edit `apps/mobile/app.json` — merge under `"expo"` (add to any existing `"ios"`/`"android"` keys
rather than duplicating them if the scaffold already created some):

```json
"ios": {
  "infoPlist": {
    "NSLocationWhenInUseUsageDescription": "GurmeGo, yakınındaki mekanları göstermek için konumunu kullanır."
  }
},
"android": {
  "permissions": ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"]
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/lib/use-location.ts apps/mobile/src/lib/use-location.spec.ts apps/mobile/app.json apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): add native location permission hook"
```

---

### Task 8: Bottom-tab navigation shell

**Files:**
- Create: `apps/mobile/src/navigation/TabNavigator.tsx`
- Create: `apps/mobile/src/screens/FavoritesScreen.tsx` (placeholder — real content in Task 16)
- Modify: `apps/mobile/src/navigation/RootNavigator.tsx`
- Test: `apps/mobile/src/navigation/TabNavigator.spec.tsx`

**Interfaces:**
- Consumes: `DiscoveryScreen` (Task 3), a new placeholder `FavoritesScreen` (this task).
- Produces: `RootStackParamList` becomes `{ Tabs: undefined; VenueDetail: { slug: string }; Auth:
  undefined }` — the bottom tabs (`Discovery`, `Favoriler`) live INSIDE the `Tabs` screen, so
  `VenueDetail` and `Auth` are reachable via `navigation.navigate(...)` from either tab without
  being duplicated per tab. `TabParamList` (`{ Discovery: undefined; Favoriler: undefined }`) is
  exported for `TabNavigator`'s own internal use; screens navigating to `VenueDetail`/`Auth` type
  their navigation prop against `RootStackParamList` directly (React Navigation resolves an
  unrecognized route name up to the parent navigator at runtime; typing every nested screen with
  the full `CompositeNavigationProp` boilerplate is intentionally skipped here as unnecessary
  ceremony for an app this size).

- [ ] **Step 1: Install `@react-navigation/bottom-tabs`**

Already installed in Task 3 Step 3 (`@react-navigation/bottom-tabs` was added alongside the stack
navigator) — no new install needed here.

- [ ] **Step 2: Create the placeholder Favorites screen**

Create `apps/mobile/src/screens/FavoritesScreen.tsx`:

```tsx
import { Text, View } from "react-native";

export default function FavoritesScreen() {
  return (
    <View>
      <Text>Favorilerim</Text>
    </View>
  );
}
```

- [ ] **Step 3: Write the failing test**

Create `apps/mobile/src/navigation/TabNavigator.spec.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import TabNavigator from "./TabNavigator";

describe("TabNavigator", () => {
  it("shows the Discovery tab's content by default", () => {
    render(
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>,
    );
    expect(screen.getByText("Mekanlar")).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @gurmego/mobile test src/navigation/TabNavigator.spec.tsx`
Expected: FAIL — `./TabNavigator` module does not exist yet.

- [ ] **Step 5: Write the implementation**

Create `apps/mobile/src/navigation/TabNavigator.tsx`:

```tsx
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import DiscoveryScreen from "../screens/DiscoveryScreen";
import FavoritesScreen from "../screens/FavoritesScreen";

export type TabParamList = {
  Discovery: undefined;
  Favoriler: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export default function TabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Discovery" component={DiscoveryScreen} options={{ title: "Mekanlar" }} />
      <Tab.Screen name="Favoriler" component={FavoritesScreen} options={{ title: "Favoriler" }} />
    </Tab.Navigator>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @gurmego/mobile test src/navigation/TabNavigator.spec.tsx`
Expected: PASS

- [ ] **Step 7: Wire `TabNavigator` into `RootNavigator`, add `VenueDetail`/`Auth` stack screens**

Replace `apps/mobile/src/navigation/RootNavigator.tsx`:

```tsx
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TabNavigator from "./TabNavigator";

export type RootStackParamList = {
  Tabs: undefined;
  VenueDetail: { slug: string };
  Auth: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

(`VenueDetail` and `Auth` are added to the type now, but their `<Stack.Screen>` entries are added
by Task 10 and Task 14 respectively, which own those screens — adding an entry for a component
that doesn't exist yet would break compilation.)

- [ ] **Step 8: Update `App.spec.tsx`'s assertion — the app now boots into the Tabs screen, not a
  bare stack**

`App.spec.tsx` (from Task 3) already asserts `getByText("Mekanlar")`, which still holds true (the
Discovery tab's placeholder text is unchanged) — no edit needed here, just re-run it to confirm:

Run: `pnpm --filter @gurmego/mobile test`
Expected: PASS, all suites (`App.spec.tsx`, `TabNavigator.spec.tsx`, and everything from Tasks 4-7).

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/navigation/TabNavigator.tsx apps/mobile/src/navigation/RootNavigator.tsx apps/mobile/src/screens/FavoritesScreen.tsx apps/mobile/src/navigation/TabNavigator.spec.tsx
git commit -m "feat(mobile): add bottom-tab navigation shell (Discovery / Favoriler)"
```

---

### Task 9: Discovery screen — district + category + price filters + location-based sort

**Files:**
- Modify: `apps/mobile/src/screens/DiscoveryScreen.tsx`
- Modify: `apps/mobile/src/navigation/RootNavigator.tsx` (add the `VenueDetail` route's TYPE now,
  pointed at a temporary stand-in — Task 10 supplies the real component)
- Test: `apps/mobile/src/screens/DiscoveryScreen.spec.tsx`

**Interfaces:**
- Consumes: `getVenues`, `getDistricts`, `VenueListItem` from Task 6's `src/lib/api.ts`;
  `useLocation` from Task 7's `src/lib/use-location.ts`; `RootStackParamList` from Task 8.
- Produces: nothing new for later tasks (Task 10 implements the `VenueDetail` screen this one
  navigates to).

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/screens/DiscoveryScreen.spec.tsx`:

```tsx
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import DiscoveryScreen from "./DiscoveryScreen";
import { getVenues, getDistricts } from "../lib/api";
import { useLocation } from "../lib/use-location";

jest.mock("../lib/api", () => ({
  getVenues: jest.fn(),
  getDistricts: jest.fn(),
}));
jest.mock("../lib/use-location", () => ({ useLocation: jest.fn() }));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

describe("DiscoveryScreen", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    (useLocation as jest.Mock).mockReturnValue(null);
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
      expect(getVenues).toHaveBeenLastCalledWith(expect.objectContaining({ districtId: "d1" }), null),
    );
  });

  it("filters by category when a category chip is pressed", async () => {
    (getVenues as jest.Mock).mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });

    render(<DiscoveryScreen />);

    await waitFor(() => expect(screen.getByText("Kafe")).toBeTruthy());
    fireEvent.press(screen.getByText("Kafe"));

    await waitFor(() =>
      expect(getVenues).toHaveBeenLastCalledWith(expect.objectContaining({ category: "cafe" }), null),
    );
  });

  it("filters by price range when a price chip is pressed", async () => {
    (getVenues as jest.Mock).mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });

    render(<DiscoveryScreen />);

    await waitFor(() => expect(screen.getByText("₺₺")).toBeTruthy());
    fireEvent.press(screen.getByText("₺₺"));

    await waitFor(() =>
      expect(getVenues).toHaveBeenLastCalledWith(expect.objectContaining({ priceRange: "MID" }), null),
    );
  });

  it("passes the current coords from useLocation to getVenues", async () => {
    (useLocation as jest.Mock).mockReturnValue({ lat: 40.99, lng: 29.02 });
    (getVenues as jest.Mock).mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });

    render(<DiscoveryScreen />);

    await waitFor(() =>
      expect(getVenues).toHaveBeenLastCalledWith(expect.any(Object), { lat: 40.99, lng: 29.02 }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gurmego/mobile test src/screens/DiscoveryScreen.spec.tsx`
Expected: FAIL — the placeholder screen has no filters, no venue list.

- [ ] **Step 3: Write the implementation**

Replace `apps/mobile/src/screens/DiscoveryScreen.tsx`:

```tsx
import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getVenues, getDistricts, type VenueListItem } from "../lib/api";
import { useLocation } from "../lib/use-location";
import type { District } from "@gurmego/shared";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CATEGORIES: { label: string; value: string }[] = [
  { label: "Kafe", value: "cafe" },
  { label: "Restoran", value: "restaurant" },
  { label: "Bar", value: "bar" },
];

const PRICE_RANGES: { label: string; value: string }[] = [
  { label: "₺", value: "LOW" },
  { label: "₺₺", value: "MID" },
  { label: "₺₺₺", value: "HIGH" },
];

export default function DiscoveryScreen() {
  const navigation = useNavigation<Nav>();
  const coords = useLocation();
  const [venues, setVenues] = useState<VenueListItem[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedPriceRange, setSelectedPriceRange] = useState<string | undefined>(undefined);

  useEffect(() => {
    getDistricts().then(setDistricts).catch(() => setDistricts([]));
  }, []);

  useEffect(() => {
    const query: Record<string, string> = {};
    if (selectedDistrictId) query.districtId = selectedDistrictId;
    if (selectedCategory) query.category = selectedCategory;
    if (selectedPriceRange) query.priceRange = selectedPriceRange;
    getVenues(query, coords).then((res) => setVenues(res.data)).catch(() => setVenues([]));
  }, [selectedDistrictId, selectedCategory, selectedPriceRange, coords]);

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
        horizontal
        data={CATEGORIES}
        keyExtractor={(c) => c.value}
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelectedCategory(item.value)}>
            <Text>{item.label}</Text>
          </Pressable>
        )}
      />
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

- [ ] **Step 4: Add the `VenueDetail` route type (component supplied by Task 10)**

Edit `apps/mobile/src/navigation/RootNavigator.tsx` — this task only updates the TYPE and imports;
it does NOT add a `<Stack.Screen name="VenueDetail">` entry yet (that would reference a component
that doesn't exist until Task 10). Update just the type:

```tsx
export type RootStackParamList = {
  Tabs: undefined;
  VenueDetail: { slug: string };
  Auth: undefined;
};
```

(This is already the type from Task 8 Step 7 — no change needed here if Task 8 already wrote it
this way. This step exists as an explicit checkpoint: confirm the type includes `VenueDetail`
before writing code in Step 3 above that calls `navigation.navigate("VenueDetail", ...)`, which
needs that type to compile.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @gurmego/mobile test src/screens/DiscoveryScreen.spec.tsx`
Expected: PASS

- [ ] **Step 6: Run the full test suite to confirm no regression**

Run: `pnpm --filter @gurmego/mobile test`
Expected: PASS, all suites. Note: navigating to `VenueDetail` from this screen will not yet work
in a real running app (no screen registered for that route until Task 10) — this is expected and
fine for a mid-plan checkpoint; the test suite only exercises `navigation.navigate` as a mock call,
not real routing.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/screens/DiscoveryScreen.tsx apps/mobile/src/screens/DiscoveryScreen.spec.tsx apps/mobile/src/navigation/RootNavigator.tsx
git commit -m "feat(mobile): discovery screen with district/category/price filters and location sort"
```

---

### Task 10: Venue detail screen + map

**Files:**
- Create: `apps/mobile/src/screens/VenueDetailScreen.tsx`
- Modify: `apps/mobile/src/navigation/RootNavigator.tsx` (register the real `VenueDetail` screen)
- Test: `apps/mobile/src/screens/VenueDetailScreen.spec.tsx`

**Interfaces:**
- Consumes: `getVenueBySlug` from Task 6's `src/lib/api.ts`; `RootStackParamList` from Task 8/9.
- Produces: nothing new for later tasks (Tasks 11-13, 15 add buttons INTO this screen, see their
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

const FULL_VENUE = {
  id: "v1", slug: "test-cafe", name: "Test Cafe", category: "cafe", cuisineType: "İtalyan",
  priceRange: "MID", signatureItems: ["Flat white", "Cheesecake"], transportNote: "Metro Kadıköy'e 5 dk",
  openingHours: { mon: "09:00-22:00" }, editorialNote: "Sakin bir köşe.", isBoutique: true,
  verifiedAt: "2026-01-01T00:00:00.000Z", source: "MANUAL", googleRating: 4.5, googleRatingCount: 120,
  googlePlaceId: null, district: { name: "Kadıköy", slug: "kadikoy" }, lat: 40.99, lng: 29.02,
  address: "Moda Cd. No:1", photos: ["https://example.com/photo1.jpg"],
};

describe("VenueDetailScreen", () => {
  it("fetches and shows the venue's name, price range, and editorial note", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue(FULL_VENUE);

    render(<VenueDetailScreen />);

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy());
    expect(screen.getByText("Sakin bir köşe.")).toBeTruthy();
    expect(getVenueBySlug).toHaveBeenCalledWith("test-cafe");
  });

  it("shows cuisine type, transport note, and address when present", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue(FULL_VENUE);

    render(<VenueDetailScreen />);

    await waitFor(() => expect(screen.getByText("İtalyan")).toBeTruthy());
    expect(screen.getByText("Metro Kadıköy'e 5 dk")).toBeTruthy();
    expect(screen.getByText("Moda Cd. No:1")).toBeTruthy();
  });

  it("shows each signature item", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue(FULL_VENUE);

    render(<VenueDetailScreen />);

    await waitFor(() => expect(screen.getByText("Flat white")).toBeTruthy());
    expect(screen.getByText("Cheesecake")).toBeTruthy();
  });

  it("does not crash and omits optional fields when they are null", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue({
      ...FULL_VENUE, cuisineType: null, transportNote: null, editorialNote: null, address: null, photos: [],
    });

    render(<VenueDetailScreen />);

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy());
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
import { Image, ScrollView, Text, View } from "react-native";
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
      {venue.photos.length > 0 && (
        <Image source={{ uri: venue.photos[0] }} style={{ width: "100%", height: 200 }} />
      )}
      <Text>{venue.name}</Text>
      <Text>{venue.district.name}</Text>
      <Text>{venue.priceRange}</Text>
      {venue.cuisineType && <Text>{venue.cuisineType}</Text>}
      {venue.editorialNote && <Text>{venue.editorialNote}</Text>}
      {venue.transportNote && <Text>{venue.transportNote}</Text>}
      {venue.address && <Text>{venue.address}</Text>}
      {venue.signatureItems.length > 0 && (
        <View>
          {venue.signatureItems.map((item) => (
            <Text key={item}>{item}</Text>
          ))}
        </View>
      )}
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

- [ ] **Step 5: Register the real `VenueDetail` screen**

Edit `apps/mobile/src/navigation/RootNavigator.tsx`:

```tsx
import VenueDetailScreen from "../screens/VenueDetailScreen";
```
Add inside `<Stack.Navigator>`, after the `Tabs` screen:
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
screen shows the map with a marker, the photo (if the venue has one), and all text fields. If the
map doesn't render in Expo Go, run `npx expo run:ios` / `npx expo run:android` instead (some
`react-native-maps` versions need a native rebuild) — note this in the task's commit description
if it applies.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/screens/VenueDetailScreen.tsx apps/mobile/src/screens/VenueDetailScreen.spec.tsx apps/mobile/src/navigation/RootNavigator.tsx apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): venue detail screen with full fields and react-native-maps"
```

---

### Task 11: "Get directions" deep link

**Files:**
- Create: `apps/mobile/src/lib/directions.ts`
- Modify: `apps/mobile/src/screens/VenueDetailScreen.tsx`
- Test: `apps/mobile/src/lib/directions.spec.ts`

**Interfaces:**
- Consumes: nothing new (pure function).
- Produces: `directionsUrl(venueName: string, districtName: string): string` — same as
  `apps/web/src/lib/directions.ts`, consumed only inside this task's own screen change.

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

Create `apps/mobile/src/lib/directions.ts`:

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

Edit `apps/mobile/src/screens/VenueDetailScreen.tsx`:

```tsx
import { Image, Linking, Pressable, ScrollView, Text, View } from "react-native";
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

### Task 12: Share button

**Files:**
- Modify: `apps/mobile/src/screens/VenueDetailScreen.tsx`
- Modify: `apps/mobile/src/screens/VenueDetailScreen.spec.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

Add to `apps/mobile/src/screens/VenueDetailScreen.spec.tsx`, inside the existing `describe` block
(add `fireEvent` to the existing `@testing-library/react-native` import line first):

```tsx
  it("calls the native Share sheet with the venue name when the share button is pressed", async () => {
    (getVenueBySlug as jest.Mock).mockResolvedValue(FULL_VENUE);
    const { Share } = require("react-native");
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction });

    render(<VenueDetailScreen />);

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy());
    fireEvent.press(screen.getByText("Paylaş"));

    expect(shareSpy).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Test Cafe") }));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gurmego/mobile test src/screens/VenueDetailScreen.spec.tsx`
Expected: FAIL — no "Paylaş" button rendered yet.

- [ ] **Step 3: Add the share button to the implementation**

Edit `apps/mobile/src/screens/VenueDetailScreen.tsx`:

```tsx
import { Image, Linking, Pressable, ScrollView, Share, Text, View } from "react-native";
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

Note: the share URL uses a placeholder `gurmego.com` domain — replaced with the real production
domain once Plan 4e's Cloudflare DNS step is complete; tracked there, not here.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gurmego/mobile test src/screens/VenueDetailScreen.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/VenueDetailScreen.tsx apps/mobile/src/screens/VenueDetailScreen.spec.tsx
git commit -m "feat(mobile): add native share button to venue detail screen"
```

---

### Task 13: "Report wrong info" form

**Files:**
- Create: `apps/mobile/src/components/ReportForm.tsx`
- Modify: `apps/mobile/src/screens/VenueDetailScreen.tsx`
- Test: `apps/mobile/src/components/ReportForm.spec.tsx`

**Interfaces:**
- Consumes: `reportVenue` from Task 6's `src/lib/api.ts`.
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

Edit `apps/mobile/src/screens/VenueDetailScreen.tsx`:

```tsx
import ReportForm from "../components/ReportForm";
```

Add at the end of the `<ScrollView>`:
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

### Task 14: Login / register screen

**Files:**
- Create: `apps/mobile/src/screens/AuthScreen.tsx`
- Modify: `apps/mobile/src/navigation/RootNavigator.tsx`
- Test: `apps/mobile/src/screens/AuthScreen.spec.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`signIn`, `signUp`) from Task 5's `src/lib/auth-context.tsx`.
- Produces: the `Auth` route (already typed since Task 8; this task registers its component) —
  consumed by Task 15's favorite-button "sign in first" redirect.

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

- [ ] **Step 5: Register the `Auth` screen**

Edit `apps/mobile/src/navigation/RootNavigator.tsx`:

```tsx
import AuthScreen from "../screens/AuthScreen";
```
Add inside `<Stack.Navigator>`, after the `VenueDetail` screen:
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

### Task 15: Favorite button (add) on venue detail

**Files:**
- Create: `apps/mobile/src/components/FavoriteButton.tsx`
- Modify: `apps/mobile/src/screens/VenueDetailScreen.tsx`
- Test: `apps/mobile/src/components/FavoriteButton.spec.tsx`

**Interfaces:**
- Consumes: `useAuth()` from Task 5; `getFavoriteLists`, `createFavoriteList`, `addFavoriteVenue`
  from Task 6; `RootStackParamList` (`Auth` route) from Task 14.
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
`apps/web/src/components/favorite-button.tsx`):

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

Edit `apps/mobile/src/screens/VenueDetailScreen.tsx`:

```tsx
import FavoriteButton from "../components/FavoriteButton";
```
Add right after the "Buraya nasıl giderim" button:
```tsx
<FavoriteButton venueId={venue.id} />
```

- [ ] **Step 6: Run the full test suite to confirm no regression**

Run: `pnpm --filter @gurmego/mobile test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/components/FavoriteButton.tsx apps/mobile/src/components/FavoriteButton.spec.tsx apps/mobile/src/screens/VenueDetailScreen.tsx
git commit -m "feat(mobile): add favorite button to venue detail screen"
```

---

### Task 16: Favorites screen — browse lists + remove a venue

**Files:**
- Modify: `apps/mobile/src/screens/FavoritesScreen.tsx`
- Test: `apps/mobile/src/screens/FavoritesScreen.spec.tsx`

**Interfaces:**
- Consumes: `useAuth()` from Task 5; `getFavoriteLists`, `removeFavoriteVenue` from Task 6;
  `RootStackParamList` (`VenueDetail`, `Auth` routes) from Task 8/10/14.
- Produces: nothing new for later tasks (last screen-level task).

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/screens/FavoritesScreen.spec.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import FavoritesScreen from "./FavoritesScreen";
import { useAuth } from "../lib/auth-context";
import { getFavoriteLists, removeFavoriteVenue } from "../lib/api";

jest.mock("../lib/auth-context", () => ({ useAuth: jest.fn() }));
jest.mock("../lib/api", () => ({
  getFavoriteLists: jest.fn(),
  removeFavoriteVenue: jest.fn(),
}));
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (jest.requireActual("@react-navigation/native") as any).useFocusEffect,
}));

const ONE_LIST = [
  {
    id: "list1", userId: "u1", name: "Favorilerim", createdAt: "2026-01-01T00:00:00.000Z",
    favorites: [
      { id: "f1", venueId: "v1", venue: { id: "v1", name: "Test Cafe", slug: "test-cafe", category: "cafe", priceRange: "MID", isBoutique: true } },
    ],
  },
];

describe("FavoritesScreen", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    (getFavoriteLists as jest.Mock).mockReset();
    (removeFavoriteVenue as jest.Mock).mockReset();
  });

  it("prompts sign-in when the user is signed out, without calling the API", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, session: null });

    render(<FavoritesScreen />);

    expect(screen.getByText("Favorilerini görmek için giriş yap")).toBeTruthy();
    expect(getFavoriteLists).not.toHaveBeenCalled();
  });

  it("lists the signed-in user's favorited venues and navigates to detail on press", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "u1" }, session: { access_token: "tok" } });
    (getFavoriteLists as jest.Mock).mockResolvedValue(ONE_LIST);

    render(<FavoritesScreen />);

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy());
    fireEvent.press(screen.getByText("Test Cafe"));
    expect(mockNavigate).toHaveBeenCalledWith("VenueDetail", { slug: "test-cafe" });
  });

  it("removes a venue from its list when its remove button is pressed", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "u1" }, session: { access_token: "tok" } });
    (getFavoriteLists as jest.Mock)
      .mockResolvedValueOnce(ONE_LIST)
      .mockResolvedValueOnce([{ ...ONE_LIST[0], favorites: [] }]); // refetch after removal
    (removeFavoriteVenue as jest.Mock).mockResolvedValue(undefined);

    render(<FavoritesScreen />);

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy());
    fireEvent.press(screen.getByText("Kaldır"));

    await waitFor(() => expect(removeFavoriteVenue).toHaveBeenCalledWith("tok", "list1", "v1"));
    await waitFor(() => expect(screen.queryByText("Test Cafe")).toBeFalsy());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gurmego/mobile test src/screens/FavoritesScreen.spec.tsx`
Expected: FAIL — the placeholder screen has none of this.

- [ ] **Step 3: Write the implementation**

Replace `apps/mobile/src/screens/FavoritesScreen.tsx`:

```tsx
import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/auth-context";
import { getFavoriteLists, removeFavoriteVenue } from "../lib/api";
import type { FavoriteList } from "@gurmego/shared";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface FlatFavorite {
  listId: string;
  venueId: string;
  name: string;
  slug: string;
}

function flattenFavorites(lists: FavoriteList[]): FlatFavorite[] {
  return lists.flatMap((list) =>
    list.favorites.map((fav) => ({ listId: list.id, venueId: fav.venueId, name: fav.venue.name, slug: fav.venue.slug })),
  );
}

export default function FavoritesScreen() {
  const { user, session } = useAuth();
  const navigation = useNavigation<Nav>();
  const [favorites, setFavorites] = useState<FlatFavorite[]>([]);

  const refetch = useCallback(() => {
    if (!session?.access_token) return;
    getFavoriteLists(session.access_token).then((lists) => setFavorites(flattenFavorites(lists))).catch(() => setFavorites([]));
  }, [session?.access_token]);

  // Re-fetch every time this tab gains focus (e.g. after adding a favorite from VenueDetailScreen
  // and navigating back) -- a plain useEffect would only run once per mount, and this screen stays
  // mounted in the background while the Discovery tab is active.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  if (!user) {
    return (
      <View>
        <Text>Favorilerini görmek için giriş yap</Text>
      </View>
    );
  }

  async function handleRemove(listId: string, venueId: string) {
    if (!session?.access_token) return;
    await removeFavoriteVenue(session.access_token, listId, venueId).catch(() => {
      // Swallow -- no error-display UI here yet; the list simply won't update if this fails, and
      // the user can retry the same press.
    });
    refetch();
  }

  return (
    <FlatList
      data={favorites}
      keyExtractor={(item) => item.venueId}
      renderItem={({ item }) => (
        <View>
          <Pressable onPress={() => navigation.navigate("VenueDetail", { slug: item.slug })}>
            <Text>{item.name}</Text>
          </Pressable>
          <Pressable onPress={() => handleRemove(item.listId, item.venueId)}>
            <Text>Kaldır</Text>
          </Pressable>
        </View>
      )}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gurmego/mobile test src/screens/FavoritesScreen.spec.tsx`
Expected: PASS

- [ ] **Step 5: Run the full test suite to confirm no regression**

Run: `pnpm --filter @gurmego/mobile test`
Expected: PASS

- [ ] **Step 6: Manual verification (Expo Go / simulator)**

Run: `pnpm --filter @gurmego/mobile start`. With local Supabase + API running, sign in, favorite a
venue from its detail screen, switch to the Favoriler tab, confirm it appears, tap "Kaldır",
confirm it disappears and a subsequent `GET /me/lists` (via `curl` with the same token) confirms
the removal server-side.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/screens/FavoritesScreen.tsx apps/mobile/src/screens/FavoritesScreen.spec.tsx
git commit -m "feat(mobile): add favorites screen with browse and remove"
```

---

### Task 17: Final whole-app review pass

**Files:** none created — this task is verification only.

**Interfaces:** none.

- [ ] **Step 1: Run every affected package's test suite one more time**

Run:
```bash
pnpm --filter @gurmego/api test
pnpm --filter @gurmego/shared test
pnpm --filter @gurmego/web test
pnpm --filter @gurmego/mobile test
```
Expected: PASS, all suites from Tasks 1-16.

- [ ] **Step 2: Run typecheck for every affected package**

Run:
```bash
pnpm --filter @gurmego/api typecheck
pnpm --filter @gurmego/shared typecheck
pnpm --filter @gurmego/web typecheck
pnpm --filter @gurmego/mobile typecheck
```
Expected: PASS, no type errors.

- [ ] **Step 3: Manual end-to-end walkthrough (real device or simulator)**

Run: `pnpm --filter @gurmego/mobile start`. With local Supabase + API running, walk through: open
app → Discovery tab shows venue list → filter by district → filter by category → filter by price →
tap a venue → see full detail (photo, cuisine, transport note, address, signature items, map) →
tap "Buraya nasıl giderim" (opens Maps) → tap "Paylaş" (opens native share sheet) → submit a "bilgi
yanlış" report → sign in (or register a new account) → favorite the venue → switch to Favoriler tab
→ confirm it's listed → tap "Kaldır" → confirm it's removed → confirm the favorite state persists
across an app restart (token persisted in SecureStore).

- [ ] **Step 4: Cross-model review**

**REQUIRED, per project convention — do not skip.** Run the `cross-model-review` skill (Codex)
against the full diff (all of `apps/api`'s Task 1 change, `packages/shared`'s Task 2 change,
`apps/web`'s Task 2 change, and all of `apps/mobile`) before considering this plan done. Fix any
BLOCKER/MAJOR findings and re-review until TEMİZ, exactly as Task 26/27 did for the web/admin apps
— expect this to take more than one round, based on that precedent.

---

## Plan-red-team bulguları — reddedilenler

- **"Otomatik e2e olmaması, pivotun asıl gerekçesiyle çelişiyor":** kısmen kabul, kısmen ret.
  Kabul: bu gerçek bir risk, Task 10/16'nın manuel doğrulama adımları bunu kısmen telafi eder.
  Ret: bu planın kapsamına Detox/Maestro eklemek — proje küçük ekip, YAGNI kararı korunuyor; bu
  riskin gerçekleştiğinin erken sinyali ADR 005'in "erken uyarı sinyalleri"nde zaten izleniyor
  (kurulum/D7 oranları düşerse native izin/harita/lifecycle hataları şüphelenilecek ilk yer olur).
- **Google Maps production harita credential/config akışı (Android):** reddedilmedi ama bu plana
  eklenmedi — Plan 4e'nin (provisioning) kapsamı, çünkü gerçek bir Google Cloud API anahtarı
  gerektiriyor (para/hesap açma kararı). Bu plan `react-native-maps`'i Expo'nun varsayılan
  sağlayıcısıyla (iOS: Apple Maps, ek config yok) kurar; Android'in Google Maps API anahtarı
  ihtiyacı Plan 4e'ye not olarak düşülmeli.
- **Supabase email confirmation deep-link akışı:** reddedilmedi ama ertelendi — yerel Supabase
  varsayılan olarak email confirmation'ı kapalı tutar (bu proje boyunca hep böyleydi); gerçek prod
  Supabase projesinde bu açılırsa (Plan 4e kararı), deep-link/callback akışı ayrı bir task olarak
  o zaman eklenir. Şimdiden spekülatif bir akış kurmak YAGNI.
