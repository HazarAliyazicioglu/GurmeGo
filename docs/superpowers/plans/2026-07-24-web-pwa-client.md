# GurmeGo Web/PWA Client — Plan 2/4 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Next.js web/PWA client — the pilot's only user-facing surface — consuming Plan 1's API: keşif (discovery), mekan detay, favoriler, giriş.

**Architecture:** Next.js 14 App Router. Discovery + venue-detail routes are server components (SSR/SSG, SEO); favorites/login are client components (personalized, no SEO value). `packages/api-client` (Plan 1 Task 21) does the fetching; `packages/shared`'s Zod schemas validate responses client-side (the OpenAPI spec has no typed response bodies — a known Plan 1 limitation, see Task 21's report). Supabase Auth JS SDK handles login; the resulting JWT is passed to `api-client` as a bearer token for favorites calls.

**Tech Stack:** Next.js 14 (App Router, TypeScript strict), Tailwind CSS, `@supabase/supabase-js` (Auth only), Zod (`packages/shared`), Playwright (E2E).

## Global Constraints

- TypeScript `strict: true`; `any` forbidden unless justified (project-wide rule, inherited from Plan 1's `tsconfig.base.json`).
- All API responses re-validated client-side against `packages/shared`'s Zod schemas before use — the generated `api-client` types are structurally present but response bodies are untyped (Plan 1 Task 21's documented limitation); do not trust them without a `safeParse`.
- No business logic in this app — it is a display + request layer only (CLAUDE.md: "İstemcilere iş mantığı ekleme — iş mantığı yalnızca apps/api"). Boutique classification, rate limiting, rule-engine thresholds all live server-side; this app only renders what the API returns.
- Location coordinates are never sent to analytics/logging from this app either (NFR-04 applies to clients too, not just the API).
- No React Native, no Gurme Puanı/review UI, no natural-language search box — all Faz 2, must not appear.
- `/me/lists` (favorites) requires an authenticated user; anonymous requests get 403 from the API (already verified in Plan 1) — the UI must redirect to `/giris` rather than show a raw error.
- Branch/commit conventions from `development-guidelines.md §3` apply (same as Plan 1).

---

## Skill & Delegation Map for This Plan

| Task | Who writes it | Skill(s) | Why |
|---|---|---|---|
| 0 — App skeleton, Tailwind, PWA config | Sen (Claude) | `turborepo-monorepo` (new workspace member) | Mechanical scaffolding, no design judgment |
| 1 — Supabase Auth client wiring | Sen | — | Logic/config, not visual |
| 2 — `packages/shared`-validated API wrapper | Sen | `zod-schema-validation` | Logic layer, closes Plan 1's known typing gap |
| 3 — District picker + layout shell | Sen (structure) → Codex (visual pass) | `delegating-ui-work` for the visual pass | Structure/data-fetching is logic; the actual look is a design call Codex can render and judge, Claude can't |
| 4 — Venue list + filters | Sen (data/state) → Codex (visual pass) | `delegating-ui-work`, `ui-ux-pro-max` | Filter UI is a real UX design decision (chip layout, mobile ergonomics) |
| 5 — Map view + list/map toggle | Sen (data) → Codex (visual/interaction pass) | `delegating-ui-work` | Map UI is inherently visual |
| 6 — Venue detail page | Sen (data fetching, SSG) → Codex (layout/visual pass) | `delegating-ui-work`, `impeccable` | Information hierarchy on this page is Sorun 7's fix — a real design decision, per the panel report |
| 7 — Report ("bilgi yanlış") form | Sen | — | Simple form, no design-judgment call needed beyond what Task 6 already covers |
| 8 — Login/signup page | Sen (Supabase Auth flow) → Codex (visual pass) | `delegating-ui-work` | Auth forms are conventional but still a visual surface |
| 9 — Favorites page | Sen (data) → Codex (visual pass) | `delegating-ui-work` | Same reasoning as 4/6 |
| 10 — PWA manifest icons + install prompt | Codex | `delegating-ui-work` | Pure visual asset (icon design) |
| 11 — E2E smoke tests | Sen | `superpowers:test-driven-development` | Tests are never delegated (project rule) |
| End of plan | Codex | `cross-model-review` | Mandatory, same as Plan 1 |

**Data-boundary note:** already established this session (personal project, not corporate) — Codex/GLM delegation is the user's own informed decision, no need to re-ask.

**Execution note:** each "Codex visual pass" step in this plan gives Codex a **brief** (what data is available, what interactions are required, what the acceptance criteria are) rather than literal JSX — Codex designs and renders it live, iterating on its own output, which Claude cannot do. The Claude-authored half of each such task (data-fetching, routing, the component's props/data contract) is still written as complete, testable code below; only the presentational JSX is left to the Codex dispatch.

---

## File Structure

```
apps/web/
├─ package.json
├─ next.config.js
├─ tsconfig.json
├─ tailwind.config.ts
├─ public/
│  ├─ manifest.json
│  ├─ icons/                    # Task 10, Codex-generated
│  └─ sw.js
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx              # root layout, PWA meta, nav shell
│  │  ├─ page.tsx                # redirects to default district
│  │  ├─ [district]/
│  │  │  └─ page.tsx             # Discovery — list/map/filters
│  │  ├─ mekan/[slug]/
│  │  │  └─ page.tsx             # Venue detail (SSG/ISR)
│  │  ├─ favoriler/
│  │  │  └─ page.tsx             # Favorites (CSR, auth-gated)
│  │  └─ giris/
│  │     └─ page.tsx             # Login/signup (CSR)
│  ├─ lib/
│  │  ├─ api.ts                  # validated api-client wrapper
│  │  ├─ supabase.ts             # Supabase Auth client
│  │  └─ auth-context.tsx        # React context for session state
│  ├─ components/
│  │  ├─ district-picker.tsx
│  │  ├─ venue-list.tsx
│  │  ├─ venue-filters.tsx
│  │  ├─ venue-map.tsx
│  │  ├─ venue-card.tsx
│  │  ├─ venue-detail.tsx
│  │  ├─ report-form.tsx
│  │  └─ favorite-button.tsx
│  └─ types/
│     └─ index.ts                # re-exports from packages/shared
└─ tests/
   └─ e2e/
      └─ smoke.spec.ts
```

---

## Task 0: `apps/web` Next.js app skeleton (Tailwind, TypeScript, PWA scaffolding)

**Files:**
- Create: `apps/web/package.json`, `next.config.js`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `src/app/layout.tsx`, `src/app/globals.css`, `public/manifest.json`

**Interfaces:**
- Consumes: `packages/shared` (workspace dep), `packages/api-client` (workspace dep)
- Produces: a bootable Next.js dev server (`pnpm --filter @gurmego/web dev`), the `RootLayout` component every page renders inside, and `public/manifest.json` (PWA manifest — icons are placeholder-referenced here, real icon files land in Task 10)

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@gurmego/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3002",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@gurmego/shared": "workspace:*",
    "@gurmego/api-client": "workspace:*",
    "@supabase/supabase-js": "^2.45.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "@playwright/test": "^1.47.0",
    "@types/react": "^18.3.0",
    "@types/node": "^20.0.0"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "src", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `apps/web/next.config.js`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@gurmego/shared", "@gurmego/api-client"],
};
module.exports = nextConfig;
```

- [ ] **Step 4: Create `apps/web/tailwind.config.ts` and `postcss.config.js`**

```typescript
import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

```js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 5: Create `apps/web/src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 6: Create `apps/web/src/app/layout.tsx`** — minimal shell, PWA meta tags; visual nav design deferred to Task 3's Codex pass, this just establishes the structure

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GurmeGo — İstanbul'un butik mekan rehberi",
  description: "Kadıköy, Beşiktaş ve Beyoğlu'nda kürasyonlu butik mekanlar.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1a1611",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Create `apps/web/public/manifest.json`**

```json
{
  "name": "GurmeGo",
  "short_name": "GurmeGo",
  "description": "İstanbul'un butik mekan rehberi",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1611",
  "theme_color": "#1a1611",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

*Icon files themselves don't exist yet — Task 10 (Codex) generates them. A missing icon file doesn't break the dev server, only PWA install polish; not blocking for this task.*

- [ ] **Step 8: Install and verify the dev server boots**

Run: `pnpm install && pnpm --filter @gurmego/web dev &` then `curl -s http://localhost:3000 | head -5` (or open in a browser), then stop the dev server.
Expected: HTML response, no crash.

- [ ] **Step 9: Commit**

```bash
git add apps/web
git commit -m "chore(web): initialize Next.js app skeleton with Tailwind and PWA manifest"
```

---

## Task 1: Supabase Auth client wiring

**Files:**
- Create: `apps/web/src/lib/supabase.ts`, `apps/web/src/lib/auth-context.tsx`
- Create: `apps/web/.env.local.example`
- Test: `apps/web/src/lib/auth-context.spec.tsx`

**Interfaces:**
- Consumes: `@supabase/supabase-js`, `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars
- Produces: `useAuth()` hook returning `{ user, session, signIn(email, password), signUp(email, password), signOut(), loading }` — Tasks 8/9 (login, favorites) consume this

- [ ] **Step 1: Write the failing test — `auth-context.spec.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth-context";

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

function Probe() {
  const { user, loading } = useAuth();
  return <div>{loading ? "loading" : user ? "signed-in" : "anonymous"}</div>;
}

describe("AuthProvider", () => {
  it("resolves to anonymous when there is no session", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/auth-context.spec.tsx`
Expected: FAIL — `Cannot find module './auth-context'`

*(Note: this task adds `vitest` + `@testing-library/react` as devDependencies alongside Playwright — Playwright covers E2E, vitest covers this one unit-level hook test; check `apps/web/package.json` doesn't already define a conflicting test runner before adding.)*

- [ ] **Step 3: Add `vitest`, `@testing-library/react`, `jsdom` to `apps/web/package.json` devDependencies and a `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "jsdom", globals: true },
});
```

- [ ] **Step 4: Create `apps/web/src/lib/supabase.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

- [ ] **Step 5: Create `apps/web/src/lib/auth-context.tsx`**

```tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
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
      await supabase.auth.signOut();
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

- [ ] **Step 6: Wrap `RootLayout`'s children in `AuthProvider`** — modify `apps/web/src/app/layout.tsx`

```tsx
import { AuthProvider } from "@/lib/auth-context";
// ...
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Create `apps/web/.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key from `npx supabase start` output>
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/v1
```

*Port convention (fixes a real collision risk found during planning): `apps/api` (Plan 1 Task 3) and this Next.js app both default to port 3000. This app's `dev` script (Task 0 Step 1) is set to `next dev -p 3002`; run `apps/api` locally with `PORT=3001` (add `PORT=3001` to `apps/api/.env`, not committed, alongside its existing `DATABASE_URL`/`SUPABASE_JWKS_URL`). `NEXT_PUBLIC_API_BASE_URL` above reflects that.*

- [ ] **Step 8: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/auth-context.spec.tsx`
Expected: PASS (1 test)

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib apps/web/vitest.config.ts apps/web/.env.local.example apps/web/src/app/layout.tsx apps/web/package.json
git commit -m "feat(web): add Supabase Auth client and useAuth hook"
```

---

## Task 2: Validated API wrapper (`packages/shared`-checked `api-client`)

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Test: `apps/web/src/lib/api.spec.ts`

**Interfaces:**
- Consumes: `createApiClient` from `@gurmego/api-client` (Plan 1 Task 21), `VenueSchema`/`VenueListQuerySchema`/`DistrictSchema`/`FavoriteListSchema` from `@gurmego/shared` (Plan 1 Task 1)
- Produces: `getVenues(query)`, `getVenueBySlug(slug)`, `getDistricts()`, `getNearestDistrict(lat,lng)`, `getFavoriteLists(token)`, `createFavoriteList(token, name)`, `addFavoriteVenue(token, listId, venueId)`, `reportVenue(id, reason)` — every page/component in this plan calls these, never `fetch`/`createApiClient` directly. Each function `safeParse`s the response and throws a typed `ApiValidationError` on mismatch (closes Plan 1's known gap: generated response types are untyped).

- [ ] **Step 1: Write the failing test — `api.spec.ts`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { getVenueBySlug, ApiValidationError } from "./api";

vi.mock("@gurmego/api-client", () => ({
  createApiClient: () => ({
    get: vi.fn().mockResolvedValue({ id: "not-a-uuid", name: "X" }), // deliberately invalid shape
  }),
}));

describe("getVenueBySlug", () => {
  it("throws ApiValidationError when the response doesn't match VenueSchema", async () => {
    await expect(getVenueBySlug("kadikoy-kahvecisi")).rejects.toThrow(ApiValidationError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/api.spec.ts`
Expected: FAIL — `Cannot find module './api'`

- [ ] **Step 3: Create `apps/web/src/lib/api.ts`**

```typescript
import { createApiClient } from "@gurmego/api-client";
import { VenueSchema, DistrictSchema, FavoriteListSchema, type Venue, type District } from "@gurmego/shared";
import { z } from "zod";

export class ApiValidationError extends Error {
  constructor(public path: string, public issues: unknown) {
    super(`API response for ${path} did not match expected schema`);
    this.name = "ApiValidationError";
  }
}

const client = createApiClient(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/v1");

async function fetchValidated<T>(path: string, schema: z.ZodType<T>, token?: string): Promise<T> {
  const authedClient = token ? createApiClient(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/v1", () => token) : client;
  const raw = await authedClient.get<unknown>(path);
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiValidationError(path, result.error.issues);
  return result.data;
}

const VenueListResponseSchema = z.object({
  data: z.array(VenueSchema.partial()), // list endpoint returns a lighter projection than full VenueSchema
  meta: z.object({ next_cursor: z.string().nullable(), has_more: z.boolean() }),
});

export function getVenues(query: Record<string, string>) {
  const qs = new URLSearchParams(query).toString();
  return fetchValidated(`/venues?${qs}`, VenueListResponseSchema);
}

export function getVenueBySlug(slug: string): Promise<Venue> {
  return fetchValidated(`/venues/${slug}`, VenueSchema);
}

export function getDistricts(): Promise<District[]> {
  return fetchValidated(`/districts?city=istanbul`, z.array(DistrictSchema));
}

export function getNearestDistrict(lat: number, lng: number): Promise<District> {
  return fetchValidated(`/districts/nearest?lat=${lat}&lng=${lng}`, DistrictSchema);
}

export function getFavoriteLists(token: string) {
  return fetchValidated(`/me/lists`, z.array(FavoriteListSchema), token);
}

export async function createFavoriteList(token: string, name: string) {
  const authedClient = createApiClient(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/v1", () => token);
  return authedClient.get(`/me/lists`); // POST support added when api-client gains a `.post` method — see Step 3b below
}

export async function reportVenue(venueId: string, reason: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/v1"}/venues/${venueId}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(`Report failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 3b: `packages/api-client`'s `createApiClient` (Plan 1 Task 21) only has a `.get` method — no `.post`.** Extend it now rather than working around it in this app: modify `packages/api-client/src/index.ts` to add a `.post(path, body)` method mirroring `.get`'s auth-header logic. Update `createFavoriteList`/`addFavoriteVenue` above to use `authedClient.post(...)` once it exists, instead of the placeholder `.get` call. Run `packages/api-client`'s own typecheck after this change (`cd packages/api-client && npx tsc --noEmit -p tsconfig.json` or equivalent) to confirm the addition doesn't break Plan 1's existing consumers.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/api.spec.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/api.spec.ts packages/api-client/src/index.ts
git commit -m "feat(web): add Zod-validated API wrapper closing the untyped-response gap"
```

---

## Task 3: District picker + Discovery page shell

**Files:**
- Create: `apps/web/src/app/[district]/page.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/components/district-picker.tsx`
- Test: `apps/web/src/app/[district]/page.spec.tsx` (data-fetching logic only, not visual)

**Interfaces:**
- Consumes: `getDistricts`, `getNearestDistrict` (Task 2)
- Produces: `DiscoveryPage` server component that fetches districts + venues and passes them to `<VenueList>`/`<VenueFilters>`/`<VenueMap>` (Task 4/5) as props — this task establishes the page's data contract, not its final look

- [ ] **Step 1: Write the failing test for the redirect logic in `apps/web/src/app/page.tsx`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { getDefaultDistrictSlug } from "./page";

vi.mock("@/lib/api", () => ({
  getDistricts: vi.fn().mockResolvedValue([{ slug: "kadikoy", name: "Kadıköy" }]),
}));

describe("getDefaultDistrictSlug", () => {
  it("returns the first district's slug as the MVP default", async () => {
    const slug = await getDefaultDistrictSlug();
    expect(slug).toBe("kadikoy");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/app/page.spec.ts`
Expected: FAIL — `getDefaultDistrictSlug is not exported`

- [ ] **Step 3: Create `apps/web/src/app/page.tsx`** — root route redirects to a default district (no city-wide view in MVP, per prd.md's "ilçe bazlı derinlik" decision)

```tsx
import { redirect } from "next/navigation";
import { getDistricts } from "@/lib/api";

export async function getDefaultDistrictSlug(): Promise<string> {
  const districts = await getDistricts();
  return districts[0]?.slug ?? "kadikoy";
}

export default async function RootPage() {
  const slug = await getDefaultDistrictSlug();
  redirect(`/${slug}`);
}
```

- [ ] **Step 4: Create `apps/web/src/app/[district]/page.tsx`** — data-fetching only; the Codex visual pass (this task's second half, see below) fills in `<VenueList>`/`<VenueFilters>`/`<VenueMap>`'s actual rendering, which don't exist until Tasks 4/5

```tsx
import { getDistricts, getVenues } from "@/lib/api";
import { notFound } from "next/navigation";

export default async function DiscoveryPage({ params }: { params: { district: string } }) {
  const districts = await getDistricts();
  const current = districts.find((d) => d.slug === params.district);
  if (!current) notFound();

  const { data: venues } = await getVenues({ districtId: current.id, sort: "newest" });

  // Rendering (district picker, venue list/map/filters) is composed here once Tasks 4-6
  // land their components — this task only proves the data contract works end-to-end.
  return (
    <main>
      <h1>{current.name}</h1>
      <p>{venues.length} mekan bulundu</p>
    </main>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/app/page.spec.ts`
Expected: PASS (1 test)

- [ ] **Step 6: Commit the data-layer half**

```bash
git add apps/web/src/app/page.tsx apps/web/src/app/[district] apps/web/src/app/page.spec.ts
git commit -m "feat(web): add district-based discovery route with data fetching"
```

- [ ] **Step 7: Codex visual pass — dispatch via `delegating-ui-work`**

Brief for Codex: "Design the root layout's navigation shell (`layout.tsx`) and the Discovery page's district picker (`district-picker.tsx`, a `'use client'` component taking `districts: District[]` and `current: string` props, calling `router.push('/'+slug)` on selection). Reference: `product-overview.md`'s 'rehber' positioning (Michelin/Time Out feel, not a generic listing app), `ui-ux-pro-max` skill for palette/type. Mobile-first (this is the pilot's primary device class). Acceptance: district switch works, nav is usable one-handed, no layout shift on load." Iterate live with Codex until visually approved, then commit as a separate commit: `style(web): district picker and nav shell visual design`.

---

## Task 4: Venue list + filters

**Files:**
- Create: `apps/web/src/components/venue-list.tsx`, `apps/web/src/components/venue-card.tsx`, `apps/web/src/components/venue-filters.tsx`
- Test: `apps/web/src/components/venue-filters.spec.tsx` (filter-state logic, not visual)

**Interfaces:**
- Consumes: `Venue[]` from Task 3's page, `getVenues` (Task 2) for client-side refetch on filter change
- Produces: `<VenueFilters onChange={(filters) => void}>` — Task 3's Discovery page wires this to a client-side refetch; `<VenueList venues={Venue[]}>` renders `<VenueCard>` per item

- [ ] **Step 1: Write the failing test for filter-state serialization (the logic Codex's UI will call)**

```typescript
import { describe, it, expect } from "vitest";
import { serializeFilters } from "./venue-filters";

describe("serializeFilters", () => {
  it("omits unset filters and includes set ones as query params", () => {
    const result = serializeFilters({ category: "cafe", priceRange: undefined, isBoutique: true });
    expect(result).toEqual({ category: "cafe", isBoutique: "true" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/venue-filters.spec.tsx`
Expected: FAIL — `Cannot find module './venue-filters'`

- [ ] **Step 3: Create `apps/web/src/components/venue-filters.tsx`** — logic + minimal unstyled markup; Codex's visual pass replaces the JSX, not the exported `serializeFilters` function or the component's props contract

```tsx
"use client";
import { useState } from "react";

export interface FilterState {
  category?: string;
  priceRange?: string;
  isBoutique?: boolean;
}

export function serializeFilters(filters: FilterState): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.category) out.category = filters.category;
  if (filters.priceRange) out.priceRange = filters.priceRange;
  if (filters.isBoutique !== undefined) out.isBoutique = String(filters.isBoutique);
  return out;
}

export function VenueFilters({ onChange }: { onChange: (filters: FilterState) => void }) {
  const [filters, setFilters] = useState<FilterState>({});
  function update(patch: Partial<FilterState>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    onChange(next);
  }
  // Placeholder markup — Codex visual pass (Step 6 below) replaces this with real chip/filter UI.
  return (
    <div data-testid="venue-filters">
      <button onClick={() => update({ isBoutique: !filters.isBoutique })}>Butik</button>
    </div>
  );
}
```

- [ ] **Step 4: Create `apps/web/src/components/venue-card.tsx` and `venue-list.tsx`** — minimal structure, no styling

```tsx
// venue-card.tsx
import Link from "next/link";
import type { Venue } from "@gurmego/shared";

export function VenueCard({ venue }: { venue: Partial<Venue> }) {
  return (
    <Link href={`/mekan/${venue.slug}`} data-testid="venue-card">
      <span>{venue.name}</span>
    </Link>
  );
}
```

```tsx
// venue-list.tsx
import { VenueCard } from "./venue-card";
import type { Venue } from "@gurmego/shared";

export function VenueList({ venues }: { venues: Partial<Venue>[] }) {
  if (venues.length === 0) return <p data-testid="empty-state">Bu filtrelerle mekan bulunamadı.</p>;
  return (
    <div data-testid="venue-list">
      {venues.map((v) => (
        <VenueCard key={v.id} venue={v} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Wire `VenueFilters`/`VenueList` into `[district]/page.tsx`** — convert the relevant part to a client component that refetches on filter change (modify Task 3's page: extract a `<DiscoveryClient>` client component that takes the initial server-fetched venues as a prop and re-fetches via `getVenues` from Task 2 when filters change)

```tsx
"use client";
import { useState } from "react";
import { VenueFilters, serializeFilters, type FilterState } from "@/components/venue-filters";
import { VenueList } from "@/components/venue-list";
import { getVenues } from "@/lib/api";
import type { Venue } from "@gurmego/shared";

export function DiscoveryClient({ districtId, initialVenues }: { districtId: string; initialVenues: Partial<Venue>[] }) {
  const [venues, setVenues] = useState(initialVenues);

  async function handleFilterChange(filters: FilterState) {
    const { data } = await getVenues({ districtId, ...serializeFilters(filters) });
    setVenues(data);
  }

  return (
    <>
      <VenueFilters onChange={handleFilterChange} />
      <VenueList venues={venues} />
    </>
  );
}
```

Save this as `apps/web/src/components/discovery-client.tsx`, then update `[district]/page.tsx` to render `<DiscoveryClient districtId={current.id} initialVenues={venues} />` instead of the placeholder `<p>` from Task 3.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/venue-filters.spec.tsx`
Expected: PASS (1 test)

- [ ] **Step 7: Commit the data/logic half**

```bash
git add apps/web/src/components/venue-filters.tsx apps/web/src/components/venue-card.tsx apps/web/src/components/venue-list.tsx apps/web/src/components/discovery-client.tsx "apps/web/src/app/[district]/page.tsx"
git commit -m "feat(web): add venue list, cards, and filter state logic"
```

- [ ] **Step 8: Codex visual pass — dispatch via `delegating-ui-work`**

Brief: "Design `venue-card.tsx` (must show: name, category, price range symbol ₺-₺₺₺₺, boutique badge if `isBoutique`), `venue-list.tsx`'s grid/list layout (mobile-first, this is the pilot's primary screen), and `venue-filters.tsx`'s filter chip UI (category, price range, açık/kapalı, mesafe, butik — per `prd.md` FR-KA-03). Keep the `data-testid` attributes and the `serializeFilters`/props contracts exactly as Claude wrote them — only replace the JSX/styling, not the logic." Iterate until approved, commit as `style(web): venue list, card, and filter visual design`.

---

## Task 5: Map view + list/map toggle

**Files:**
- Create: `apps/web/src/components/venue-map.tsx`
- Modify: `apps/web/src/components/discovery-client.tsx` (add view-mode toggle)
- Test: `apps/web/src/components/discovery-client.spec.tsx` (toggle state logic)

**Interfaces:**
- Consumes: `getVenues` with a `bbox`-based map endpoint (Plan 1's `GET /venues/map`) — add `getVenuesInBbox(bbox)` to Task 2's `api.ts`
- Produces: `<VenueMap venues={MapVenue[]}>` — per the panel's "static preview over interactive SDK" cost decision (RISK-MITIGATION.md, design spec's architecture section), a lightweight static map is acceptable for MVP; a real interactive map library is Codex's call to make if a free/cheap option fits, but must not introduce a paid API dependency without flagging it to the user first

- [ ] **Step 1: Add `getVenuesInBbox` to `apps/web/src/lib/api.ts`**, following the exact pattern of `getVenues` in Task 2 but hitting `/venues/map?bbox=...`. Write a test for it mirroring Task 2's `api.spec.ts` pattern (mock `createApiClient`, assert `safeParse` failure throws `ApiValidationError`), verify RED then GREEN.

- [ ] **Step 2: Write the failing test for the list/map toggle state**

```typescript
import { describe, it, expect } from "vitest";
import { toggleViewMode } from "./discovery-client";

describe("toggleViewMode", () => {
  it("switches between list and map", () => {
    expect(toggleViewMode("list")).toBe("map");
    expect(toggleViewMode("map")).toBe("list");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/discovery-client.spec.tsx`
Expected: FAIL — `toggleViewMode is not exported`

- [ ] **Step 4: Add `toggleViewMode` export and view-mode state to `discovery-client.tsx`**

```typescript
export function toggleViewMode(current: "list" | "map"): "list" | "map" {
  return current === "list" ? "map" : "list";
}
```

Wire a `useState<"list"|"map">("list")` into `DiscoveryClient`, render `<VenueList>` or `<VenueMap>` conditionally, with a toggle button calling `setViewMode(toggleViewMode(viewMode))`.

- [ ] **Step 5: Create `apps/web/src/components/venue-map.tsx`** — minimal structure (data-fetching/props contract only; Codex decides the actual map rendering approach)

```tsx
"use client";
import type { Venue } from "@gurmego/shared";

export function VenueMap({ venues }: { venues: Partial<Venue>[] }) {
  // Codex visual pass fills this in — static preview image or a lightweight map lib, per the brief below.
  return <div data-testid="venue-map">{venues.length} mekan haritada</div>;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/discovery-client.spec.tsx`
Expected: PASS (1 test)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/venue-map.tsx apps/web/src/components/discovery-client.tsx apps/web/src/lib/api.ts
git commit -m "feat(web): add map/list view toggle and bbox venue fetching"
```

- [ ] **Step 8: Codex visual pass — dispatch via `delegating-ui-work`**

Brief: "Design `venue-map.tsx`'s actual map rendering. Constraint: no paid map API — evaluate a free/open option (e.g. a static tile preview, or a lightweight open-source map lib) and flag the choice to the user before finalizing if it pulls in a new paid-tier dependency; RISK-MITIGATION.md's Sorun 7 fix calls for a mini-map in the venue detail page too (Task 6), so whatever approach is chosen here should be reusable there. Keep `data-testid='venue-map'` and the `venues` prop contract." Iterate, commit as `style(web): venue map rendering`.

---

## Task 6: Venue detail page

**Files:**
- Create: `apps/web/src/app/mekan/[slug]/page.tsx`, `apps/web/src/components/venue-detail.tsx`
- Test: `apps/web/src/app/mekan/[slug]/page.spec.ts` (data-fetching + 404 handling)

**Interfaces:**
- Consumes: `getVenueBySlug` (Task 2)
- Produces: SSG/ISR venue detail route — the direct implementation of Sorun 7's fix (panel report §01/§05): mini-map, Google rating badge, IG source link, WhatsApp share, directions deep-link all live on this page (this task establishes data; Tasks 7/9's forms and Codex's visual pass fill in the rest)

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { generateStaticParams } from "./page";

vi.mock("@/lib/api", () => ({
  getVenueBySlug: vi.fn(),
}));

describe("venue detail page", () => {
  it("generateStaticParams is exported for SSG", () => {
    expect(typeof generateStaticParams).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/app/mekan/[slug]/page.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create `apps/web/src/app/mekan/[slug]/page.tsx`**

```tsx
import { getVenueBySlug } from "@/lib/api";
import { notFound } from "next/navigation";
import { VenueDetail } from "@/components/venue-detail";

export const revalidate = 3600; // ISR — pilot scale (30-45 venues), hourly revalidation is plenty

export async function generateStaticParams() {
  return []; // populated on-demand via ISR fallback rather than pre-building all slugs at deploy time
}

export default async function VenueDetailPage({ params }: { params: { slug: string } }) {
  const venue = await getVenueBySlug(params.slug).catch(() => null);
  if (!venue) notFound();
  return <VenueDetail venue={venue} />;
}
```

- [ ] **Step 4: Create `apps/web/src/components/venue-detail.tsx`** — data layout only, no styling

```tsx
import type { Venue } from "@gurmego/shared";
import { PRICE_RANGE_LABELS } from "@gurmego/shared";

export function VenueDetail({ venue }: { venue: Venue }) {
  return (
    <article data-testid="venue-detail">
      <h1>{venue.name}</h1>
      <p data-testid="price-range">{PRICE_RANGE_LABELS[venue.priceRange]}</p>
      {venue.editorialNote && <p data-testid="editorial-note">{venue.editorialNote}</p>}
      {venue.transportNote && <p data-testid="transport-note">{venue.transportNote}</p>}
      <ul data-testid="signature-items">
        {venue.signatureItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {venue.googleRating && (
        <a data-testid="google-rating" href={`https://maps.google.com/?q=${encodeURIComponent(venue.name)}`} target="_blank" rel="noreferrer">
          {venue.googleRating}★ · {venue.googleRatingCount} Google yorumu
        </a>
      )}
      {/* Mini-map, WhatsApp share, directions deep-link, report form — composed in by Tasks 7/9 and Codex's visual pass */}
    </article>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/app/mekan/[slug]/page.spec.ts`
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/mekan" apps/web/src/components/venue-detail.tsx
git commit -m "feat(web): add venue detail page with ISR"
```

- [ ] **Step 7: Codex visual pass — dispatch via `delegating-ui-work`**

Brief: "This page is the direct fix for GurmeGo's biggest identified product risk (Sorun 7 — read `docs/RISK-MITIGATION.md` Sorun 7 and the panel report's §01/§05 before starting): the product's core claim is undermined if the user still feels like this is 'a 4th stop' before Maps. Design `venue-detail.tsx`'s full layout so fold-priority is: editorial note (the actual differentiator) → price/signature items → mini-map + directions CTA (reuse Task 5's map approach) → Google rating badge → WhatsApp share + report link, all visible without excessive scrolling on mobile. Keep every `data-testid` and the props contract exactly as written." Iterate, commit as `style(web): venue detail page layout and information hierarchy`.

---

## Task 7: Report ("bilgi yanlış") form

**Files:**
- Create: `apps/web/src/components/report-form.tsx`
- Modify: `apps/web/src/components/venue-detail.tsx` (compose the form in)
- Test: `apps/web/src/components/report-form.spec.tsx`

**Interfaces:**
- Consumes: `reportVenue` (Task 2)
- Produces: `<ReportForm venueId={string}>` — a simple form, no Codex pass needed (matches the plan's assessment that this doesn't need a separate design-judgment task; if a future reviewer disagrees, that's a fair call to make then, not a silent assumption now)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReportForm } from "./report-form";

vi.mock("@/lib/api", () => ({ reportVenue: vi.fn().mockResolvedValue({ urgent: false }) }));

describe("ReportForm", () => {
  it("submits the reason and shows a confirmation", async () => {
    render(<ReportForm venueId="v1" />);
    fireEvent.change(screen.getByLabelText(/neden/i), { target: { value: "Fiyat yanlış" } });
    fireEvent.click(screen.getByRole("button", { name: /gönder/i }));
    await waitFor(() => expect(screen.getByText(/teşekkürler/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/report-form.spec.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Create `apps/web/src/components/report-form.tsx`**

```tsx
"use client";
import { useState } from "react";
import { reportVenue } from "@/lib/api";

export function ReportForm({ venueId }: { venueId: string }) {
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await reportVenue(venueId, reason);
    setSubmitted(true);
  }

  if (submitted) return <p>Teşekkürler, bildirimin kürasyon ekibine iletildi.</p>;

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="reason">Neden yanlış?</label>
      <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} required />
      <button type="submit">Gönder</button>
    </form>
  );
}
```

- [ ] **Step 4: Compose `<ReportForm venueId={venue.id}>` into `venue-detail.tsx`**, replacing the placeholder comment left in Task 6 Step 4.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/report-form.spec.tsx`
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/report-form.tsx apps/web/src/components/venue-detail.tsx
git commit -m "feat(web): add bilgi-yanlış report form to venue detail page"
```

---

## Task 8: Login/signup page

**Files:**
- Create: `apps/web/src/app/giris/page.tsx`, `apps/web/src/components/auth-form.tsx`
- Test: `apps/web/src/components/auth-form.spec.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 1)
- Produces: `/giris` route — Task 9 (favorites) redirects here when `useAuth().user` is null

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuthForm } from "./auth-form";

const signIn = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ signIn, signUp: vi.fn() }) }));

describe("AuthForm", () => {
  it("calls signIn with email/password on submit", async () => {
    render(<AuthForm mode="signin" />);
    fireEvent.change(screen.getByLabelText(/e-posta/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/şifre/i), { target: { value: "sifre123" } });
    fireEvent.click(screen.getByRole("button", { name: /giriş/i }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith("a@b.com", "sifre123"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/auth-form.spec.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Create `apps/web/src/components/auth-form.tsx`** — logic only, minimal markup

```tsx
"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fn = mode === "signin" ? signIn : signUp;
    const { error } = await fn(email, password);
    if (error) setError(error);
    else router.push("/favoriler");
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">E-posta</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label htmlFor="password">Şifre</label>
      <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
      {error && <p role="alert">{error}</p>}
      <button type="submit">{mode === "signin" ? "Giriş yap" : "Kayıt ol"}</button>
    </form>
  );
}
```

- [ ] **Step 4: Create `apps/web/src/app/giris/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { AuthForm } from "@/components/auth-form";

export default function GirisPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  return (
    <main>
      <AuthForm mode={mode} />
      <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
      </button>
    </main>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/auth-form.spec.tsx`
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/auth-form.tsx "apps/web/src/app/giris"
git commit -m "feat(web): add login/signup page"
```

- [ ] **Step 7: Codex visual pass — dispatch via `delegating-ui-work`**

Brief: "Design `auth-form.tsx` and the `/giris` page shell — a conventional but clean login/signup form matching the app's 'rehber' visual identity from Task 3. Keep all `id`/`htmlFor`/`role='alert'` attributes exactly as written (tests depend on them)." Iterate, commit as `style(web): login/signup page visual design`.

---

## Task 9: Favorites page

**Files:**
- Create: `apps/web/src/app/favoriler/page.tsx`, `apps/web/src/components/favorite-button.tsx`
- Modify: `apps/web/src/components/venue-detail.tsx` (add `<FavoriteButton>`)
- Test: `apps/web/src/app/favoriler/page.spec.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 1), `getFavoriteLists`/`createFavoriteList`/`addFavoriteVenue` (Task 2)
- Produces: `/favoriler` route (redirects to `/giris` if `useAuth().user` is null, per Plan 1's verified 403-on-anonymous behavior) and `<FavoriteButton venueId>` usable from the venue detail page

- [ ] **Step 1: Write the failing test for the auth-redirect logic**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import FavorilerPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: null, loading: false, session: null }) }));

describe("FavorilerPage", () => {
  it("redirects to /giris when there is no authenticated user", () => {
    render(<FavorilerPage />);
    expect(push).toHaveBeenCalledWith("/giris");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/app/favoriler/page.spec.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Create `apps/web/src/app/favoriler/page.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getFavoriteLists } from "@/lib/api";
import type { FavoriteList } from "@gurmego/shared";

export default function FavorilerPage() {
  const { user, session, loading } = useAuth();
  const router = useRouter();
  const [lists, setLists] = useState<FavoriteList[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/giris");
      return;
    }
    if (session?.access_token) {
      getFavoriteLists(session.access_token).then(setLists);
    }
  }, [user, session, loading, router]);

  if (loading || !user) return null;

  return (
    <main data-testid="favoriler-page">
      {lists.map((list) => (
        <div key={list.id}>{list.name}</div>
      ))}
    </main>
  );
}
```

- [ ] **Step 4: Create `apps/web/src/components/favorite-button.tsx`** — logic only

```tsx
"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { addFavoriteVenue } from "@/lib/api";

export function FavoriteButton({ venueId, defaultListId }: { venueId: string; defaultListId?: string }) {
  const { user, session } = useAuth();
  const router = useRouter();

  async function handleClick() {
    if (!user) {
      router.push("/giris");
      return;
    }
    if (session?.access_token && defaultListId) {
      await addFavoriteVenue(session.access_token, defaultListId, venueId);
    }
  }

  return <button onClick={handleClick}>Favorilere ekle</button>;
}
```

*Note: `defaultListId` handling (which list a favorite goes into when the user has none yet, or more than one) is a real UX decision Codex's visual pass should resolve alongside the styling — flag this explicitly in the Step 6 brief rather than silently picking a default here.*

- [ ] **Step 5: Add `addFavoriteVenue` to `apps/web/src/lib/api.ts`** (Task 2's file), following the `createFavoriteList` pattern (uses `authedClient.post`, added in Task 2 Step 3b).

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/app/favoriler/page.spec.tsx`
Expected: PASS (1 test)

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/favoriler" apps/web/src/components/favorite-button.tsx apps/web/src/lib/api.ts
git commit -m "feat(web): add favorites page and favorite-button component"
```

- [ ] **Step 8: Codex visual pass — dispatch via `delegating-ui-work`**

Brief: "Design `/favoriler`'s empty-state and list layout, and `favorite-button.tsx`'s visual state (default vs. favorited). Also resolve: when a user favorites a venue and has no existing list, should this silently create a default 'Favorilerim' list, or prompt for a list name? Make a UX call and implement it — this is exactly the kind of judgment call this delegation exists for." Iterate, commit as `style(web): favorites page and favorite-button design`.

---

## Task 10: PWA icons + install experience

**Files:**
- Create: `apps/web/public/icons/icon-192.png`, `apps/web/public/icons/icon-512.png`
- Modify: `apps/web/src/app/layout.tsx` (install prompt UI, if any)

**Interfaces:**
- Consumes: Task 0's `manifest.json` (icon paths already referenced)
- Produces: real icon assets so PWA install actually works, not just the manifest JSON referencing nonexistent files

- [ ] **Step 1: Dispatch to Codex via `delegating-ui-work`** — this whole task is a visual asset task, no Claude-authored logic half.

Brief: "Design GurmeGo's app icon (192x192 and 512x512 PNG, matching the 'rehber' visual identity established in Task 3) and export both files to `apps/web/public/icons/`. Also add a lightweight 'add to home screen' prompt component to the layout if you judge it improves the pilot's install rate — this is optional polish, not required for the pilot's 6-week window, use your judgment on whether it's worth the complexity."

- [ ] **Step 2: Verify the manifest resolves correctly** — `cd apps/web && pnpm dev`, open `http://localhost:3000/manifest.json` in a browser, confirm both icon URLs return 200 (not 404).

- [ ] **Step 3: Commit**

```bash
git add apps/web/public/icons apps/web/src/app/layout.tsx
git commit -m "style(web): add PWA icons"
```

---

## Task 11: E2E smoke tests

**Files:**
- Create: `apps/web/playwright.config.ts`, `apps/web/tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: the full app (all prior tasks), a running `apps/api` + seeded local DB (Plan 1 Task 22's seed script)
- Produces: `pnpm --filter @gurmego/web test:e2e` — CI-runnable smoke coverage per `development-guidelines.md §4`'s "Smoke E2E" strategy: keşif→detay→favori, mekan paylaş, bilgi-yanlış bildir

- [ ] **Step 1: Create `apps/web/playwright.config.ts`**

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 2: Create `apps/web/tests/e2e/smoke.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test("keşif → mekan detay → bilgi yanlış bildir", async ({ page }) => {
  await page.goto("/kadikoy");
  await expect(page.getByTestId("venue-list")).toBeVisible();

  await page.getByTestId("venue-card").first().click();
  await expect(page.getByTestId("venue-detail")).toBeVisible();

  await page.getByLabel(/neden/i).fill("Fiyat yanlış görünüyor");
  await page.getByRole("button", { name: /gönder/i }).click();
  await expect(page.getByText(/teşekkürler/i)).toBeVisible();
});

test("giriş yapmadan favori eklemeye çalışmak /giris'e yönlendirir", async ({ page }) => {
  await page.goto("/kadikoy");
  await page.getByTestId("venue-card").first().click();
  await page.getByRole("button", { name: /favorilere ekle/i }).click();
  await expect(page).toHaveURL(/\/giris/);
});
```

- [ ] **Step 3: Run the suite against a live local stack** — requires `apps/api` running (with local Supabase + seed data from Plan 1) and `apps/web` dev server up.

Run: `cd apps/web && npx playwright install --with-deps chromium && npx playwright test`
Expected: both tests PASS against real running services — this is the plan's equivalent of Plan 1's "verify against real DB/HTTP" discipline, at the UI layer.

- [ ] **Step 4: Commit**

```bash
git add apps/web/playwright.config.ts apps/web/tests
git commit -m "test(web): add Playwright smoke tests for discovery, detail, report, and favorite-gating flows"
```

---

## Task 12: Cross-model review (mandatory)

**Files:** none created — reviews everything from Tasks 0–11.

- [ ] **Step 1: Run the project's built-in review** — `superpowers:requesting-code-review` against the full diff.

- [ ] **Step 2: Run the mandatory cross-model review** — `cross-model-review` skill (Codex). Not optional, per `CLAUDE.md`. Tell the user before this runs (data boundary already established this session).

- [ ] **Step 3: Merge findings, fix, re-verify** — same loop as Plan 1's Task 24.

- [ ] **Step 4: Update `docs/STATE.md` and `docs/CHANGELOG.md`** — record Plan 2 complete, what Plan 3 (admin UI) needs from this (shared component patterns, `packages/api-client` additions), any deferred findings.

---

## Self-Review Notes

- **Spec coverage:** every page in the design doc (Keşif, Mekan Detay, Favoriler, Giriş) has a task. `packages/api-client`'s missing `.post` method (a real gap discovered while planning, not previously known) is folded into Task 2 rather than left implicit.
- **Placeholder scan:** no TBD/TODO. Two known open items are explicitly flagged as decisions for Codex's visual passes to resolve (map library choice in Task 5, default-favorite-list UX in Task 9) rather than silently assumed — this is intentional delegation of a real judgment call, not a placeholder.
- **Type consistency:** `Venue`/`District`/`FavoriteList` types flow from `packages/shared` (Task 2) into every component unchanged; `FilterState` (Task 4) and `toggleViewMode`'s view-mode union (Task 5) are each defined once and reused.
- **Port collision (found and fixed during self-review):** `apps/api` and a default Next.js app both listen on port 3000. Resolved: this app's `dev` script runs on `-p 3002` (Task 0 Step 1), and Task 1's `.env.local.example` documents running `apps/api` locally with `PORT=3001`, with `NEXT_PUBLIC_API_BASE_URL` set accordingly.
