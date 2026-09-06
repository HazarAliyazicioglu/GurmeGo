# GurmeGo Admin Panel — Plan 3/4 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deliberately minimal `apps/admin` — curation queue (approve/reject REPORT contributions) and CSV bulk import — after `idea-red-team` found the originally-scoped 6-page admin app disproportionate to actual pilot usage (1-2 people, 30-45 venues, 6 weeks). See `docs/superpowers/specs/2026-07-24-admin-panel-design.md`'s "Red-team sonrası kapsam daraltması" section for the full accept/reject record.

**Architecture:** Next.js 14, App Router, fully CSR (no SEO need — internal tool). Separate app from `apps/web`, own port (3003). Reuses Plan 2's proven patterns exactly where they transfer (Supabase Auth context, Zod-validated API wrapper, `packages/api-client`) and diverges only where the internal-tool nature demands it (role-gated access, no ISR/SSR).

**Tech Stack:** Next.js 14 (App Router, TypeScript strict, CSR-only), Tailwind CSS, `@supabase/supabase-js` (Auth), Zod (`packages/shared`), Vitest.

## Global Constraints

- TypeScript `strict: true`; `any` forbidden unless justified (project-wide rule).
- All API responses re-validated client-side against `packages/shared`'s Zod schemas before use — same rule as Plan 2, no exceptions.
- No business logic in this app — display + request layer only. Rule-engine (boutique classification), the urgent-report threshold, moderation logic all live server-side.
- Location coordinates never sent to analytics/logging from this app either (NFR-04 applies to clients too, not just the API) — relevant here because the CSV import UI handles lat/lng.
- `curator`/`admin` role required for every page in this app; a non-curator authenticated user (or unauthenticated) must see a clear "no access" state, never a raw 403 or a silently broken page.
- Branch/commit conventions from `development-guidelines.md §3` apply (Conventional Commits).
- Port convention: `apps/api` on `PORT=3001` locally, `apps/web` dev on `3002`, `apps/admin` dev on `3003`. `apps/api`'s CORS default origin list (already includes 3000/3001/3002 per Plan 2's fix) must be extended to include `3003`.

---

## Task 0: apps/admin Next.js scaffold

**Files:**
- Create: `apps/admin/{package.json, next.config.js, tsconfig.json, tailwind.config.ts, postcss.config.js, vitest.config.ts, vitest.setup.ts, src/app/layout.tsx, src/app/globals.css}`

**Interfaces:**
- Consumes: `packages/shared`, `packages/api-client` (workspace deps, same as `apps/web`)
- Produces: bootable, STANDALONE-compiling Next.js dev server (`next dev -p 3003`), `RootLayout` with no dependency on anything Task 1 creates, a working Vitest setup (jsdom + `@` alias + `@testing-library/jest-dom` matchers)

No PWA manifest here (internal tool, not installable) — this is the one deliberate divergence from Task 0's Plan-2 twin. Unlike the earlier draft of this task, `layout.tsx` does NOT import `AuthProvider` here — `plan-red-team` correctly flagged that importing a file Task 1 hasn't created yet contradicts this task's own "bootable dev server" claim, and it doesn't match how Plan 2 actually sequenced this (Plan 2's Task 0 shipped a standalone-compiling `layout.tsx`; Task 1 modified it to wrap `<AuthProvider>` in). Task 1 modifies `layout.tsx` to add the wrapper — see Task 1 below.

`vitest.config.ts`/`vitest.setup.ts` are included in THIS task (not discovered ad hoc in Task 1, as happened during Plan 2's actual execution) because Plan 2's real implementation history already proved they're needed: Vitest doesn't read `tsconfig.json` path aliases automatically (needs an explicit `resolve.alias`), and `esbuild.jsx: "automatic"` plus a setup file importing `@testing-library/jest-dom` are both required before any component test can run.

- [ ] **Step 1: Create `apps/admin/package.json`**

```json
{
  "name": "@gurmego/admin",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3003",
    "build": "next build",
    "start": "next start -p 3003",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@gurmego/shared": "workspace:*",
    "@gurmego/api-client": "workspace:*",
    "@supabase/supabase-js": "^2.45.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "@types/react": "^18.3.0",
    "@types/node": "^20.0.0",
    "vitest": "^1.6.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.5.0",
    "jsdom": "^24.1.0"
  }
}
```

- [ ] **Step 2: Create `apps/admin/next.config.js`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@gurmego/shared", "@gurmego/api-client"],
};
module.exports = nextConfig;
```

- [ ] **Step 3: Create `apps/admin/tsconfig.json`** — standard Next.js App Router config, `strict: true`, `paths: {"@/*": ["./src/*"]}` (mirror `apps/web/tsconfig.json` exactly, minus anything PWA-specific).

- [ ] **Step 4: Create `apps/admin/tailwind.config.ts`/`postcss.config.js`** — standard Tailwind setup scanning `./src/**/*.{ts,tsx}` (mirror `apps/web`'s configs).

- [ ] **Step 5: Create `apps/admin/src/app/globals.css`** — Tailwind directives only (`@tailwind base/components/utilities`), no custom design tokens yet (Task 4's Codex visual pass establishes the internal-tool visual language, deliberately distinct from `apps/web`'s "rehber" consumer identity per the design doc).

- [ ] **Step 6: Create `apps/admin/src/app/layout.tsx`** — minimal shell, no manifest/PWA metadata, NO auth dependency (standalone-compiling):

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GurmeGo — Kürasyon Paneli",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Create `apps/admin/vitest.config.ts`**

```typescript
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 8: Create `apps/admin/vitest.setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 9: Install and verify the dev server boots AND compiles standalone**

Run: `pnpm install && cd apps/admin && npx tsc --noEmit` — must be clean (proves Step 6's `layout.tsx` has no dangling import, unlike the earlier draft of this task).
Then: `pnpm --filter @gurmego/admin dev &` then `curl -s http://localhost:3003 | head -5` (expect a 404 body since no `page.tsx` exists yet — that's fine, proves the server boots), then stop the dev server.

- [ ] **Step 10: Commit**

```bash
git add apps/admin pnpm-lock.yaml
git commit -m "chore(admin): initialize Next.js app skeleton"
```

---

## Task 1: Supabase Auth client + role gate

**Files:**
- Create: `apps/admin/src/lib/supabase.ts`, `apps/admin/src/lib/auth-context.tsx`, `apps/admin/src/lib/auth-context.spec.tsx`, `apps/admin/.env.local.example`
- Create: `apps/admin/src/app/(protected)/layout.tsx`, `apps/admin/src/app/(protected)/layout.spec.tsx`, `apps/admin/src/app/erisim-yok/page.tsx`

**Interfaces:**
- Consumes: `@supabase/supabase-js`
- Produces: `useAuth()` hook (`{ user, session, loading, role, signIn, signOut }` — note the ADDED `role` field vs. Plan 2's `useAuth()`, since this app needs to know the role to gate access, not just whether a user is logged in), a `(protected)` route group layout that redirects to `/giris` if unauthenticated OR to `/erisim-yok` if authenticated but not `curator`/`admin`

- [ ] **Step 1: Create `apps/admin/src/lib/supabase.ts`** — identical to `apps/web/src/lib/supabase.ts` (same `createClient` call, same env var names `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`).

```typescript
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

- [ ] **Step 2: Create `apps/admin/.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key from `npx supabase status`>
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/v1
```

(Port convention established in Plan 2: `apps/api` on 3001 locally, `apps/admin` dev server on 3003 — set below in Task 0's already-committed `package.json`.)

- [ ] **Step 3: Write the failing test for role extraction**

`plan-red-team` found the original draft's test used a literal non-JWT string `"tok"` as `access_token`, and only asserted the role element existed in the DOM (not that it decoded to the right value) — meaning the test would pass even if `decodeRole` were deleted entirely. Fixed: build a real base64url-encoded JWT-shaped string with a `user_role` claim, and assert the actual decoded role text.

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth-context";

// Minimal helper to build a syntactically-real (unsigned) JWT for tests — base64url header.payload.signature.
// `decodeRole` only ever reads the payload, so the header/signature contents don't matter here.
function fakeJwt(claims: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "none" })}.${b64url(claims)}.sig`;
}

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: fakeJwt({ user_role: "curator" }),
            user: { id: "u1" },
          },
        },
      }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

function RoleProbe() {
  const { role, loading } = useAuth();
  if (loading) return <span>yükleniyor</span>;
  return <span data-testid="role">{role ?? "yok"}</span>;
}

describe("useAuth role extraction", () => {
  it("decodes the role from the session JWT's user_role claim", async () => {
    // Supabase sessions carry custom claims via the access_token JWT's payload, set up through a
    // Supabase custom access token hook — Plan 1's JwtAuthMiddleware reads `user_role` from the
    // decoded JWT the same way (apps/api/src/auth/jwt-auth.middleware.ts). Decoding the
    // access_token payload directly here (not a metadata field) matches that same convention —
    // whether the real Supabase project's hook is actually configured is a separate, already-logged
    // risk (docs/STATE.md), not something this test can verify; this test only proves the decode
    // logic itself is correct given a token shaped the way the backend expects.
    render(<AuthProvider><RoleProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("role")).toHaveTextContent("curator"));
  });

  it("returns null role when the JWT has no user_role claim", async () => {
    const { supabase } = await import("./supabase");
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: { access_token: fakeJwt({}), user: { id: "u1" } } },
    } as never);
    render(<AuthProvider><RoleProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("role")).toHaveTextContent("yok"));
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd apps/admin && npx vitest run src/lib/auth-context.spec.tsx`
Expected: FAIL — module not found

- [ ] **Step 5: Create `apps/admin/src/lib/auth-context.tsx`**

```tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type Role = "curator" | "admin" | null;

function decodeRole(accessToken: string): Role {
  // Decode the JWT payload (base64url, no verification needed client-side — this is display-only
  // gating, the backend's RolesGuard is the actual security boundary, this just avoids showing a
  // non-curator user a broken page before their first API call 403s).
  try {
    const payload = JSON.parse(atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const role = payload.user_role;
    return role === "curator" || role === "admin" ? role : null;
  } catch {
    return null;
  }
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: Role;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stateChangeReceived = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!stateChangeReceived) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      stateChangeReceived = true;
      setSession(newSession);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    role: session?.access_token ? decodeRole(session.access_token) : null,
    loading,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
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

Note this already includes the `getSession`/`onAuthStateChange` race fix and the `signOut` error-surfacing established during Plan 2 Task 1's review — do not reintroduce either bug.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/admin && npx vitest run src/lib/auth-context.spec.tsx`
Expected: PASS (1 test)

- [ ] **Step 7: Write the failing test for the protected-layout role gate**

`plan-red-team` found the original draft imported `ProtectedLayout` statically at the top of the file, which evaluates (and pulls in the REAL, unmocked `@/lib/auth-context`) before either test's `vi.doMock` call ever runs — the static import was dead code shadowed by the dynamic ones, but its presence meant the module graph was resolved once against the real dependency first. Fixed: no static import of `./layout` anywhere in this file, only the per-test dynamic pattern.

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  push.mockClear();
  vi.resetModules();
});

describe("ProtectedLayout", () => {
  it("redirects to /giris when unauthenticated", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({ user: null, role: null, loading: false }),
    }));
    const { default: Layout } = await import("./layout");
    render(<Layout><div>içerik</div></Layout>);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/giris"));
  });

  it("redirects to /erisim-yok when authenticated but not curator/admin", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({ user: { id: "u1" }, role: null, loading: false }),
    }));
    const { default: Layout } = await import("./layout");
    render(<Layout><div>içerik</div></Layout>);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/erisim-yok"));
  });

  it("renders children without redirecting when authenticated as curator", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({ user: { id: "u1" }, role: "curator", loading: false }),
    }));
    const { default: Layout } = await import("./layout");
    const { findByText } = render(<Layout><div>içerik</div></Layout>);
    await findByText("içerik");
    expect(push).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `cd apps/admin && npx vitest run "src/app/(protected)/layout.spec.tsx"`
Expected: FAIL — module not found (3 tests, all failing)

- [ ] **Step 9: Create `apps/admin/src/app/(protected)/layout.tsx`**

```tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/giris");
      return;
    }
    if (!role) {
      router.push("/erisim-yok");
    }
  }, [user, role, loading, router]);

  if (loading || !user || !role) return null;
  return <>{children}</>;
}
```

- [ ] **Step 10: Create `apps/admin/src/app/erisim-yok/page.tsx`** — plain, unstyled message (Codex visual pass in a later task covers this too):

```tsx
export default function ErisimYokPage() {
  return (
    <main data-testid="erisim-yok-page">
      <h1>Bu hesabın kürasyon paneline erişim yetkisi yok</h1>
      <p>Erişim için bir admin&apos;den curator rolü istemen gerekiyor.</p>
    </main>
  );
}
```

- [ ] **Step 11: Run test to verify it passes**

Run: `cd apps/admin && npx vitest run "src/app/(protected)/layout.spec.tsx"`
Expected: PASS (3 tests)

- [ ] **Step 12: Modify `apps/admin/src/app/layout.tsx` (created standalone in Task 0) to wrap children in `<AuthProvider>`**, now that `@/lib/auth-context` exists:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "GurmeGo — Kürasyon Paneli",
};

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

Run `cd apps/admin && npx tsc --noEmit` to confirm this compiles now that the import target exists.

- [ ] **Step 13: Commit**

```bash
git add apps/admin/src/lib apps/admin/.env.local.example apps/admin/src/app/layout.tsx "apps/admin/src/app/(protected)" apps/admin/src/app/erisim-yok
git commit -m "feat(admin): add Supabase Auth client with curator/admin role gate"
```

---

## Task 2: Fix CSV import to actually persist venues (apps/api)

**Files:**
- Modify: `apps/api/src/admin/venues/csv-import.service.ts`, `apps/api/src/admin/venues/csv-import.service.spec.ts`, `apps/api/src/admin/venues/admin-venues.controller.ts`, `apps/api/src/admin/venues/admin-venues.service.ts`, `apps/api/src/admin/venues/admin-venues.service.spec.ts`
- Test: `apps/api/src/admin/venues/csv-import.service.spec.ts`, `apps/api/src/admin/venues/admin-venues.service.spec.ts`

`plan-red-team` flagged the original draft's Files section for omitting `admin-venues.service.ts`/its spec even though Step 7 (below) modifies that exact file — fixed above.

**Interfaces:**
- Consumes: `VenuesRepository.createWithLocation` (Plan 1), `AdminVenueCreateSchema` (`packages/shared`, needs `slug`, `districtId`, `openingHours`, `lat`, `lng`, `franchiseFlag` — none of which the current `CsvRowSchema` collects)
- Produces: `POST /admin/import` now actually creates venues (idempotent on `slug` — re-importing the same CSV skips rows whose slug already exists, matching Plan 1's seed script convention) and returns `{ created: number, skipped: number, errors: {row, message}[] }`

**Why this is in scope:** `idea-red-team`'s NO-GO explicitly named CSV import as the one concrete near-term need justifying this plan's existence. The current endpoint only validates CSV structure and discards the parsed rows — verified by reading `admin-venues.controller.ts:37-44`, which calls `this.csvImport.parseRows(...)` and returns its result directly, with `venuesRepository.createWithLocation` never invoked anywhere in the CSV-import code path. Without this fix, Task 5 (the import page) would have nothing real to build against.

- [ ] **Step 1: Write the failing test for expanded CSV row validation**

```typescript
import { describe, it, expect } from "vitest";
import { CsvImportService } from "./csv-import.service";

describe("CsvImportService.parseRows", () => {
  it("requires slug, openingHours JSON, lat, lng, and franchiseFlag columns", () => {
    const service = new CsvImportService();
    const csv = `name,slug,districtSlug,category,priceRange,branchCount,franchiseFlag,lat,lng,openingHours
Test Cafe,test-cafe,kadikoy,cafe,MODERATE,1,false,40.99,29.02,"{""mon_fri"":""09:00-18:00""}"`;
    const { valid, errors } = service.parseRows(csv);
    expect(errors).toEqual([]);
    expect(valid).toEqual([
      {
        name: "Test Cafe",
        slug: "test-cafe",
        districtSlug: "kadikoy",
        category: "cafe",
        priceRange: "MODERATE",
        branchCount: 1,
        franchiseFlag: false,
        lat: 40.99,
        lng: 29.02,
        openingHours: { mon_fri: "09:00-18:00" },
      },
    ]);
  });

  it("reports a row-level error for malformed openingHours JSON", () => {
    const service = new CsvImportService();
    const csv = `name,slug,districtSlug,category,priceRange,branchCount,franchiseFlag,lat,lng,openingHours
Test Cafe,test-cafe,kadikoy,cafe,MODERATE,1,false,40.99,29.02,not-json`;
    const { valid, errors } = service.parseRows(csv);
    expect(valid).toEqual([]);
    expect(errors).toEqual([{ row: 1, message: expect.stringContaining("openingHours") }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest csv-import.service.spec.ts`
Expected: FAIL — `franchiseFlag`/`lat`/`lng`/`slug`/`openingHours` not in `CsvRowSchema`, current fixture shape mismatches

- [ ] **Step 3: Update `apps/api/src/admin/venues/csv-import.service.ts`**

`plan-red-team` verified (against the actual Zod version in this repo) that `z.coerce.boolean()` turns the STRING `"false"` into `true` — `Boolean("false")` is `true` in JavaScript, since any non-empty string is truthy, and `z.coerce.boolean()` is exactly `Boolean(input)`. The plan's own test in the previous draft asserted `franchiseFlag: false` from a CSV cell containing the text `false`, which the previous draft's own proposed implementation could never have produced. Fixed below: an explicit `"true"`/`"false"` string check instead of `z.coerce.boolean()`. Also fixed: `openingHours` is now validated as a genuine `Record<string, string>` (flat string-to-string map), not just "whatever `JSON.parse` returns" — a CSV cell containing a JSON array or nested object would previously have passed through unvalidated and broken `AdminVenueCreateSchema`'s expectation downstream.

```typescript
import { Injectable } from "@nestjs/common";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { PRICE_RANGE_VALUES } from "@gurmego/shared";

const CsvRowSchema = z.object({
  name: z.string().min(1, "name zorunlu"),
  slug: z.string().min(1, "slug zorunlu"),
  districtSlug: z.string().min(1),
  category: z.string().min(1),
  priceRange: z.enum(PRICE_RANGE_VALUES),
  branchCount: z.coerce.number().int().min(1),
  franchiseFlag: z.enum(["true", "false"], { errorMap: () => ({ message: "franchiseFlag 'true' veya 'false' olmalı" }) }).transform((v) => v === "true"),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  openingHours: z.string().transform((s, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(s);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "openingHours geçerli JSON olmalı" });
      return z.NEVER;
    }
    const shape = z.record(z.string(), z.string()).safeParse(parsed);
    if (!shape.success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "openingHours düz bir { gün: saat } string haritası olmalı" });
      return z.NEVER;
    }
    return shape.data;
  }),
});

export type CsvRow = z.infer<typeof CsvRowSchema>;

@Injectable()
export class CsvImportService {
  parseRows(csv: string) {
    const records: Record<string, string>[] = parse(csv, { columns: true, skip_empty_lines: true });
    const valid: CsvRow[] = [];
    const errors: { row: number; message: string }[] = [];

    records.forEach((record, index) => {
      const result = CsvRowSchema.safeParse(record);
      if (result.success) {
        valid.push(result.data);
      } else {
        errors.push({ row: index + 1, message: result.error.issues.map((i) => i.message).join(", ") });
      }
    });

    return { valid, errors };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest csv-import.service.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing test for `AdminVenuesService.importRows`**

`plan-red-team` found the previous draft left this method's implementation to "use your judgment", which the plan's own "No Placeholders" discipline forbids for the exact logic this task exists to deliver. Full code given below instead.

Read `apps/api/src/admin/venues/admin-venues.service.spec.ts` first to match this codebase's existing `PrismaService`/`VenuesRepository`/`BoutiqueService` mocking conventions.

```typescript
// Add to admin-venues.service.spec.ts, alongside the existing create()/update()/revert() describe blocks
describe("importRows", () => {
  it("creates new-slug rows, skips existing-slug rows, and reports district-not-found as a row error", async () => {
    const rows = [
      { name: "New Cafe", slug: "new-cafe", districtSlug: "kadikoy", category: "cafe", priceRange: "MODERATE" as const,
        branchCount: 1, franchiseFlag: false, lat: 40.99, lng: 29.02, openingHours: { mon_fri: "09:00-18:00" } },
      { name: "Existing Cafe", slug: "existing-cafe", districtSlug: "kadikoy", category: "cafe", priceRange: "MODERATE" as const,
        branchCount: 1, franchiseFlag: false, lat: 40.98, lng: 29.03, openingHours: { mon_fri: "09:00-18:00" } },
      { name: "Bad District", slug: "bad-district-venue", districtSlug: "nowhere", category: "cafe", priceRange: "MODERATE" as const,
        branchCount: 1, franchiseFlag: false, lat: 40.9, lng: 29.0, openingHours: { mon_fri: "09:00-18:00" } },
    ];
    prismaMock.district.findUnique.mockImplementation(({ where: { slug } }: { where: { slug: string } }) =>
      slug === "kadikoy" ? Promise.resolve({ id: "d1", slug: "kadikoy" }) : Promise.resolve(null),
    );
    prismaMock.venue.findUnique
      .mockResolvedValueOnce(null) // new-cafe: doesn't exist yet
      .mockResolvedValueOnce({ id: "v-existing" }); // existing-cafe: already exists

    const result = await service.importRows(rows);

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.rowErrors).toEqual([{ row: 3, message: expect.stringContaining("ilçe") }]);
    expect(venuesRepositoryMock.createWithLocation).toHaveBeenCalledTimes(1);
    expect(venuesRepositoryMock.createWithLocation).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "new-cafe", districtId: "d1", signatureItems: [] }),
    );
  });
});
```

(Adapt the exact mock variable names — `prismaMock`, `venuesRepositoryMock`, `service` — to whatever this codebase's existing `admin-venues.service.spec.ts` already calls them; do not introduce a second, differently-named mocking convention in the same file.)

- [ ] **Step 6: Run test to verify it fails**

Run: `cd apps/api && npx jest admin-venues.service.spec.ts`
Expected: FAIL — `importRows` not defined

- [ ] **Step 7: Add `importRows` to `apps/api/src/admin/venues/admin-venues.service.ts`**

```typescript
import type { CsvRow } from "./csv-import.service"; // export this type from csv-import.service.ts: `export type CsvRow = z.infer<typeof CsvRowSchema>;`

async importRows(rows: CsvRow[]): Promise<{ created: number; skipped: number; rowErrors: { row: number; message: string }[] }> {
  let created = 0;
  let skipped = 0;
  const rowErrors: { row: number; message: string }[] = [];

  for (const [index, row] of rows.entries()) {
    try {
      const district = await this.prisma.district.findUnique({ where: { slug: row.districtSlug } });
      if (!district) {
        rowErrors.push({ row: index + 1, message: `'${row.districtSlug}' slug'lı ilçe bulunamadı` });
        continue;
      }
      const existing = await this.prisma.venue.findUnique({ where: { slug: row.slug } });
      if (existing) {
        skipped++;
        continue;
      }
      // Explicit field mapping (not a raw type cast) — AdminVenueCreateSchema's `.default([])`/
      // `.optional()` fields only apply when the schema is actually run through `.parse()`; this
      // object is constructed directly and passed to `create()`, which takes the already-typed
      // `AdminVenueCreateInput` shape, so every field `create()` needs must be set explicitly here.
      await this.create({
        name: row.name,
        slug: row.slug,
        districtId: district.id,
        category: row.category,
        priceRange: row.priceRange,
        signatureItems: [],
        openingHours: row.openingHours,
        branchCount: row.branchCount,
        franchiseFlag: row.franchiseFlag,
        lat: row.lat,
        lng: row.lng,
      });
      created++;
    } catch (err) {
      rowErrors.push({ row: index + 1, message: err instanceof Error ? err.message : "Bilinmeyen hata" });
    }
  }

  return { created, skipped, rowErrors };
}
```

This reuses `create()` (already defined above in this file) as the single path venues get created through — `isBoutique` computation and `createWithLocation`'s raw-SQL insert are not duplicated.

- [ ] **Step 8: Update `apps/api/src/admin/venues/admin-venues.controller.ts`'s `importCsv`** to call it:

```typescript
@Post("import")
async importCsv(@Req() req: FastifyRequest) {
  const data = await req.file();
  if (!data) {
    throw new BadRequestException({ error: { code: "VALIDATION_ERROR", message: "file zorunlu" } });
  }
  const buffer = await data.toBuffer();
  const { valid, errors } = this.csvImport.parseRows(buffer.toString("utf-8"));
  const { created, skipped, rowErrors } = await this.venues.importRows(valid);
  return { created, skipped, errors: [...errors, ...rowErrors] };
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd apps/api && npx jest admin-venues csv-import`
Expected: PASS

- [ ] **Step 10: Run full apps/api suite to confirm zero regressions**

Run: `cd apps/api && npx tsc --noEmit && npx jest`
Expected: PASS (80+ tests — the existing 77 plus this task's additions)

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/admin/venues
git commit -m "fix(api): CSV import now actually persists venues instead of only validating"
```

---

## Task 3: Zod-validated API wrapper (kuyruk + import)

**Files:**
- Create: `apps/admin/src/lib/api.ts`, `apps/admin/src/lib/api.spec.ts`
- Create: `packages/shared/src/schemas/admin-queue.schema.ts` (new — no existing schema covers the queue-list response shape)
- Modify: `packages/shared/src/index.ts` (barrel export)

**Interfaces:**
- Consumes: `createApiClient` (`packages/api-client`, `.get`/`.post` — no `.put` needed, this narrowed scope has no update/roles UI), the real `AdminQueueService.list()`/Task 2's `importCsv` response shapes
- Produces: `getQueue(token, {type?, status?})`, `approveQueueItem(token, id)`, `rejectQueueItem(token, id)`, `importCsv(token, file: File)` — all `safeParse`-validated

- [ ] **Step 1: Add `AdminQueueItemSchema` to `packages/shared/src/schemas/admin-queue.schema.ts`** — built from the REAL `AdminQueueService.list()` return shape (verified: `{...ContributionQueue fields (id, type, venueId, payload, submittedBy, status, reviewedBy, reviewedAt, createdAt), venue: {name, slug} | null, urgent: boolean}`):

`plan-red-team` found a real, severe bug here: `AdminQueueService.list()` returns EVERY pending `ContributionQueue` type when called without an explicit `type` filter — including `EDIT`/`re_verify` rows the rule engine's 90-day staleness job creates automatically (`apps/api/src/rule-engine/re-verify.service.ts`). This narrowed plan only has UI for `REPORT`, so `AdminQueueItemSchema`'s `type: z.enum(["REPORT"])` is correct for what this app displays — but the previous draft's `getQueue` left `type` as an optional caller-supplied filter, meaning a single pending non-REPORT item anywhere in the real database would make `/kuyruk`'s ENTIRE response fail Zod validation and crash the one page this plan exists to deliver. Fixed below: `getQueue` no longer takes a `type` parameter at all — it always sends `type=REPORT` internally, structurally, not by caller convention.

```typescript
import { z } from "zod";

export const AdminQueueItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("REPORT"), // this app only ever queries type=REPORT (see getQueue in api.ts) — a
  // non-REPORT item reaching this schema would mean the query filter itself broke, not a shape we
  // need to tolerate rendering
  venueId: z.string().uuid().nullable(),
  payload: z.record(z.string(), z.unknown()),
  submittedBy: z.string().nullable(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  venue: z.object({ name: z.string(), slug: z.string() }).nullable(),
  urgent: z.boolean(),
});
export type AdminQueueItem = z.infer<typeof AdminQueueItemSchema>;

export const AdminQueueListSchema = z.array(AdminQueueItemSchema);

// approve()/reject() return the raw updated ContributionQueue row (no `venue`/`urgent` enrichment —
// those are computed only inside list()'s mapping step, verified against admin-queue.service.ts).
export const AdminQueueMutationResultSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("REPORT"),
  venueId: z.string().uuid().nullable(),
  payload: z.record(z.string(), z.unknown()),
  submittedBy: z.string().nullable(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const CsvImportResultSchema = z.object({
  created: z.number().int().min(0),
  skipped: z.number().int().min(0),
  errors: z.array(z.object({ row: z.number().int(), message: z.string() })),
});
export type CsvImportResult = z.infer<typeof CsvImportResultSchema>;
```

- [ ] **Step 2: Add the export to `packages/shared/src/index.ts`** (`export * from "./schemas/admin-queue.schema";`, matching the existing barrel pattern for other schema files).

- [ ] **Step 3: Run `cd packages/shared && npx tsc --noEmit && npx vitest run`** — confirm no regressions in the existing 3 tests.

- [ ] **Step 4: Write the failing test for `apps/admin/src/lib/api.ts`**

`importCsv` uses a raw `fetch`, not `createApiClient`'s `.post` — `.post` always `JSON.stringify`s its body and sets `Content-Type: application/json` (Plan 2 Task 2's implementation), which is wrong for a `FormData`/multipart body. This mirrors `apps/web/src/lib/api.ts`'s `reportVenue`, which uses a raw `fetch` for the same reason. `importCsv`'s test therefore mocks the global `fetch`, not `createApiClient`.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
vi.mock("@gurmego/api-client", () => ({ createApiClient: () => ({ get, post }) }));

import { getQueue, approveQueueItem, rejectQueueItem, importCsv, ApiValidationError } from "./api";

const VALID_ITEM = {
  id: "11111111-1111-1111-1111-111111111111",
  type: "REPORT",
  venueId: "22222222-2222-2222-2222-222222222222",
  payload: { reason: "Fiyat yanlış" },
  submittedBy: null,
  status: "PENDING",
  reviewedBy: null,
  reviewedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  venue: { name: "Test Cafe", slug: "test-cafe" },
  urgent: false,
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe("getQueue", () => {
  it("always requests type=REPORT and returns validated items", async () => {
    get.mockResolvedValue([VALID_ITEM]);
    const result = await getQueue("tok", { status: "PENDING" });
    expect(result).toEqual([VALID_ITEM]);
    expect(get).toHaveBeenCalledWith(expect.stringContaining("type=REPORT"));
    expect(get).toHaveBeenCalledWith(expect.stringContaining("status=PENDING"));
  });

  it("throws ApiValidationError when a non-REPORT item is returned", async () => {
    get.mockResolvedValue([{ ...VALID_ITEM, type: "EDIT" }]);
    await expect(getQueue("tok")).rejects.toThrow(ApiValidationError);
  });
});

describe("approveQueueItem / rejectQueueItem", () => {
  const MUTATION_RESULT = { ...VALID_ITEM, status: "APPROVED" };
  delete (MUTATION_RESULT as Partial<typeof MUTATION_RESULT>).venue;
  delete (MUTATION_RESULT as Partial<typeof MUTATION_RESULT>).urgent;

  it("approveQueueItem resolves on a valid mutation response", async () => {
    post.mockResolvedValue(MUTATION_RESULT);
    await expect(approveQueueItem("tok", VALID_ITEM.id)).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledWith(`/admin/queue/${VALID_ITEM.id}/approve`, {});
  });

  it("rejectQueueItem throws ApiValidationError on a malformed response", async () => {
    post.mockResolvedValue({ garbage: true });
    await expect(rejectQueueItem("tok", VALID_ITEM.id)).rejects.toThrow(ApiValidationError);
  });
});

describe("importCsv", () => {
  const file = new File(["name,slug\ntest,test"], "venues.csv", { type: "text/csv" });

  it("uploads via raw fetch (not the JSON-only .post) and returns the validated result", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ created: 2, skipped: 1, errors: [] }),
    }) as unknown as typeof fetch;
    const result = await importCsv("tok", file);
    expect(result).toEqual({ created: 2, skipped: 1, errors: [] });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers).not.toHaveProperty("Content-Type"); // never force JSON on a multipart body
  });

  it("throws a plain Error on a non-2xx HTTP response (not ApiValidationError — the request itself failed)", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    await expect(importCsv("tok", file)).rejects.toThrow("Import failed: 500");
  });

  it("throws ApiValidationError when the 2xx response body doesn't match CsvImportResultSchema", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nonsense: true }) }) as unknown as typeof fetch;
    await expect(importCsv("tok", file)).rejects.toThrow(ApiValidationError);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd apps/admin && npx vitest run src/lib/api.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 6: Create `apps/admin/src/lib/api.ts`**

```typescript
import { createApiClient } from "@gurmego/api-client";
import {
  AdminQueueListSchema,
  AdminQueueMutationResultSchema,
  CsvImportResultSchema,
  type AdminQueueItem,
  type CsvImportResult,
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

export async function importCsv(token: string, file: File): Promise<CsvImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/admin/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`Import failed: ${res.status}`);
  const raw = await res.json();
  const result = CsvImportResultSchema.safeParse(raw);
  if (!result.success) throw new ApiValidationError("/admin/import", result.error.issues);
  return result.data;
}
```

`importCsv` uses a raw `fetch` (not `createApiClient`'s `.post`) because a multipart `FormData` body must NOT be JSON-stringified or have a `Content-Type: application/json` header set — `.post`'s existing implementation does both (see Plan 2 Task 2's `.post` addition), so it's the wrong tool here, matching the precedent of `apps/web/src/lib/api.ts`'s `reportVenue` using a raw `fetch` for its own reason. Do not modify `packages/api-client`'s `.post` to special-case `FormData` — that couples an unrelated concern into a shared helper for one caller.

- [ ] **Step 7: Run test to verify it passes**

Run: `cd apps/admin && npx vitest run src/lib/api.spec.ts`
Expected: PASS (8 tests)

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/schemas/admin-queue.schema.ts packages/shared/src/index.ts apps/admin/src/lib/api.ts apps/admin/src/lib/api.spec.ts
git commit -m "feat(admin): add Zod-validated API wrapper for queue and CSV import"
```

---

## Task 4: Kürasyon kuyruğu page

**Files:**
- Create: `apps/admin/src/app/(protected)/kuyruk/page.tsx`, `apps/admin/src/app/(protected)/kuyruk/page.spec.tsx`, `apps/admin/src/components/queue-item.tsx`, `apps/admin/src/app/(protected)/page.tsx`

**Interfaces:**
- Consumes: `getQueue`, `approveQueueItem`, `rejectQueueItem` (Task 3), `useAuth` (Task 1)
- Produces: `/kuyruk` route (the app's index/landing page — `apps/admin/src/app/(protected)/page.tsx` redirects here, since this narrowed scope has no other natural landing page)

**Product-semantics note (`plan-red-team` flagged this as a missing task — it isn't one, it's an existing, already-logged, deliberately-deferred Plan 1 decision that this UI must not silently paper over):** the real `AdminQueueService.approve()` (Plan 1, already shipped and tested) applies NO correction to the venue when a REPORT is approved — it only bumps `verifiedAt` and creates a `VenueVersion` snapshot of the venue AS-IS. "Onayla" therefore means "acknowledged, this report has been reviewed," not "the underlying data has been fixed." This is `docs/STATE.md`'s already-recorded open product question ("REPORT onayı hiçbir düzeltme uygulamadan verifiedAt'i yeniliyor"), not something this narrowed plan is scoped to redesign — this plan deliberately has no manual-venue-edit UI (see the design doc's scope cuts), so a curator who needs to actually correct a venue's data after approving a report does so via Postman/Prisma Studio against the already-tested `PUT /admin/venues/:id`, same as every other cut feature. `QueueItem`'s copy (Step 3 below) makes this explicit rather than implying "Onayla" fixes anything.

- [ ] **Step 1: Write the failing test for the queue page's list-and-mutate logic**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import KuyrukPage from "./page";

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ session: { access_token: "tok" }, role: "curator", loading: false, user: { id: "u1" } }),
}));
const getQueue = vi.fn();
const approveQueueItem = vi.fn().mockResolvedValue(undefined);
const rejectQueueItem = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/api", () => ({
  getQueue: (...args: unknown[]) => getQueue(...args),
  approveQueueItem: (...args: unknown[]) => approveQueueItem(...args),
  rejectQueueItem: (...args: unknown[]) => rejectQueueItem(...args),
}));

const BASE_ITEM = {
  id: "q1", type: "REPORT" as const, venueId: "v1", payload: { reason: "Fiyat yanlış" }, submittedBy: null,
  status: "PENDING" as const, reviewedBy: null, reviewedAt: null, createdAt: "2026-01-01T00:00:00.000Z",
  venue: { name: "Test Cafe", slug: "test-cafe" }, urgent: false,
};

describe("KuyrukPage", () => {
  it("lists pending items and approves one on click", async () => {
    getQueue.mockResolvedValueOnce([BASE_ITEM]).mockResolvedValueOnce([]); // refetch after approve returns empty

    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));
    await waitFor(() => expect(approveQueueItem).toHaveBeenCalledWith("tok", "q1"));
    await waitFor(() => expect(getQueue).toHaveBeenCalledTimes(2)); // initial + refetch after mutation
  });

  it("rejects an item on click and refetches", async () => {
    getQueue.mockResolvedValueOnce([BASE_ITEM]).mockResolvedValueOnce([]);
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /reddet/i }));
    await waitFor(() => expect(rejectQueueItem).toHaveBeenCalledWith("tok", "q1"));
    await waitFor(() => expect(getQueue).toHaveBeenCalledTimes(2));
  });

  it("marks an urgent item's list entry so it can be visually distinguished", async () => {
    getQueue.mockResolvedValueOnce([{ ...BASE_ITEM, urgent: true }]);
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByTestId("queue-item")).toHaveAttribute("data-urgent", "true"));
  });

  it("shows a fallback label when the reported venue has been deleted (nullable venue)", async () => {
    getQueue.mockResolvedValueOnce([{ ...BASE_ITEM, venue: null }]);
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByText(/mekan silinmiş/i)).toBeInTheDocument());
  });

  it("shows the empty state when there are no pending reports", async () => {
    getQueue.mockResolvedValueOnce([]);
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/admin && npx vitest run "src/app/(protected)/kuyruk/page.spec.tsx"`
Expected: FAIL — module not found

- [ ] **Step 3: Create `apps/admin/src/components/queue-item.tsx`**

```tsx
"use client";
import type { AdminQueueItem } from "@gurmego/shared";

export function QueueItem({
  item,
  onApprove,
  onReject,
}: {
  item: AdminQueueItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const reason = typeof item.payload.reason === "string" ? item.payload.reason : "(neden belirtilmemiş)";
  return (
    <li data-testid="queue-item" data-urgent={item.urgent}>
      <p>{item.venue?.name ?? "(mekan silinmiş)"}</p>
      <p>{reason}</p>
      {/* "Onayla" yalnızca bildirimi incelenmiş olarak işaretler ve mekanın verified_at'ini yeniler —
          mekan verisini OTOMATİK DÜZELTMEZ. Veriyi düzeltmek gerekiyorsa Postman/Prisma Studio ile
          PUT /admin/venues/:id kullan (bu panelde manuel mekan düzenleme UI'ı yok, bilinçli bir kapsam
          kararı — bkz. design doc). */}
      <button onClick={() => onApprove(item.id)}>Onayla (yalnızca incelendi olarak işaretler)</button>
      <button onClick={() => onReject(item.id)}>Reddet</button>
    </li>
  );
}
```

- [ ] **Step 4: Create `apps/admin/src/app/(protected)/kuyruk/page.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getQueue, approveQueueItem, rejectQueueItem } from "@/lib/api";
import { QueueItem } from "@/components/queue-item";
import type { AdminQueueItem } from "@gurmego/shared";

export default function KuyrukPage() {
  const { session } = useAuth();
  const [items, setItems] = useState<AdminQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!session?.access_token) return;
    const data = await getQueue(session.access_token, { status: "PENDING" });
    setItems(data);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  async function handleApprove(id: string) {
    if (!session?.access_token) return;
    await approveQueueItem(session.access_token, id);
    await refetch();
  }

  async function handleReject(id: string) {
    if (!session?.access_token) return;
    await rejectQueueItem(session.access_token, id);
    await refetch();
  }

  if (loading) return null;

  return (
    <main data-testid="kuyruk-page">
      <h1>Kürasyon Kuyruğu</h1>
      {items.length === 0 ? (
        <p data-testid="empty-state">Bekleyen bildirim yok.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <QueueItem key={item.id} item={item} onApprove={handleApprove} onReject={handleReject} />
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Create `apps/admin/src/app/(protected)/page.tsx`** — redirect to `/kuyruk` (the app's only natural landing page in this narrowed scope):

```tsx
"use client";
import { redirect } from "next/navigation";

export default function ProtectedIndexPage() {
  redirect("/kuyruk");
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/admin && npx vitest run "src/app/(protected)/kuyruk/page.spec.tsx"`
Expected: PASS (5 tests)

- [ ] **Step 7: Commit the data/logic half**

```bash
git add "apps/admin/src/app/(protected)/kuyruk" "apps/admin/src/app/(protected)/page.tsx" apps/admin/src/components/queue-item.tsx
git commit -m "feat(admin): add curation queue page with approve/reject"
```

- [ ] **Step 8: Codex visual pass — dispatch via `delegating-ui-work`**

Brief: "Design `queue-item.tsx` and `kuyruk/page.tsx`'s layout. This is an INTERNAL TOOL, not the consumer-facing 'rehber' identity from the web app — aim for dense, functional, table/list-oriented, fast to scan (a curator processing several reports in a row is the target user, not a browsing consumer). Mark urgent items (`data-urgent='true'`) visually distinct (the backend's urgent-threshold logic means these need faster attention). Keep every `data-testid`/`data-urgent` attribute and the `onApprove`/`onReject` click contracts exactly as written — only replace JSX/styling." Iterate, commit as `style(admin): curation queue visual design`.

---

## Task 5: CSV import page

**Files:**
- Create: `apps/admin/src/app/(protected)/import/page.tsx`, `apps/admin/src/app/(protected)/import/page.spec.tsx`

**Interfaces:**
- Consumes: `importCsv` (Task 3), `useAuth` (Task 1)
- Produces: `/import` route — file picker + a per-row result list (not a `<table>` — `plan-red-team` correctly flagged the earlier draft's "table" claim as inaccurate against its own `<ul>` markup; corrected here)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ImportPage from "./page";

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ session: { access_token: "tok" }, role: "curator", loading: false, user: { id: "u1" } }),
}));
const importCsv = vi.fn();
vi.mock("@/lib/api", () => ({ importCsv: (...args: unknown[]) => importCsv(...args) }));

function selectFile() {
  const file = new File(["name,slug\nTest,test"], "venues.csv", { type: "text/csv" });
  fireEvent.change(screen.getByLabelText(/csv dosyası/i), { target: { files: [file] } });
  return file;
}

beforeEach(() => importCsv.mockReset());

describe("ImportPage", () => {
  it("uploads a file and shows the created/skipped/error summary", async () => {
    importCsv.mockResolvedValue({ created: 2, skipped: 1, errors: [{ row: 4, message: "priceRange geçersiz" }] });
    render(<ImportPage />);
    const file = selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));

    await waitFor(() => expect(importCsv).toHaveBeenCalledWith("tok", file));
    await waitFor(() => expect(screen.getByText(/2.*oluşturuldu/i)).toBeInTheDocument());
    expect(screen.getByText(/priceRange geçersiz/i)).toBeInTheDocument();
  });

  it("shows an error message and re-enables the upload button when the request fails (network error or HTTP failure)", async () => {
    importCsv.mockRejectedValue(new Error("Import failed: 500"));
    render(<ImportPage />);
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/yükleme başarısız/i));
    expect(screen.getByRole("button", { name: /yükle/i })).not.toBeDisabled();
  });

  it("disables the upload button while a request is in flight", async () => {
    let resolveImport: (value: unknown) => void = () => {};
    importCsv.mockReturnValue(new Promise((resolve) => { resolveImport = resolve; }));
    render(<ImportPage />);
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /yükle/i })).toBeDisabled());
    resolveImport({ created: 0, skipped: 0, errors: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/admin && npx vitest run "src/app/(protected)/import/page.spec.tsx"`
Expected: FAIL — module not found

- [ ] **Step 3: Create `apps/admin/src/app/(protected)/import/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { importCsv } from "@/lib/api";
import type { CsvImportResult } from "@gurmego/shared";

export default function ImportPage() {
  const { session } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!session?.access_token || !file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await importCsv(session.access_token, file);
      setResult(res);
    } catch {
      setError("Yükleme başarısız oldu. Dosyayı kontrol edip tekrar dene.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main data-testid="import-page">
      <h1>CSV Toplu Import</h1>
      <label htmlFor="csv-file">CSV dosyası</label>
      <input
        id="csv-file"
        type="file"
        accept=".csv"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button onClick={handleUpload} disabled={!file || uploading}>
        Yükle
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div data-testid="import-result">
          <p>{result.created} mekan oluşturuldu, {result.skipped} atlandı (zaten var)</p>
          {result.errors.length > 0 && (
            <ul>
              {result.errors.map((err) => (
                <li key={err.row}>Satır {err.row}: {err.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/admin && npx vitest run "src/app/(protected)/import/page.spec.tsx"`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit the data/logic half**

```bash
git add "apps/admin/src/app/(protected)/import"
git commit -m "feat(admin): add CSV import page"
```

- [ ] **Step 6: Codex visual pass — dispatch via `delegating-ui-work`**

Brief: "Design `import/page.tsx`'s layout — file picker, upload button, and the created/skipped/error result summary (the error list is the most important part visually, a curator needs to immediately spot which CSV rows failed and why). Same internal-tool, dense/functional visual language as the queue page (Task 4) — reuse whatever design tokens that pass established. Keep every `data-testid`/`htmlFor`/`id` attribute and the upload/result-rendering contract exactly as written." Iterate, commit as `style(admin): CSV import page visual design`.

---

## Task 6: Add a simple auth form + login page

**Files:**
- Create: `apps/admin/src/app/giris/page.tsx`, `apps/admin/src/app/giris/page.spec.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 1)
- Produces: `/giris` route — the `(protected)` layout (Task 1) redirects here when unauthenticated

No separate `<AuthForm>` component this time — a single-purpose, single-mode (sign-in only, no sign-up: curator accounts are provisioned by an admin via Supabase dashboard, not self-service, matching the narrowed scope's "no role-assignment UI" decision) inline form is proportionate here.

`plan-red-team` found the earlier draft's test only measured that `signIn` was called, never that a successful login actually takes the curator anywhere usable — with no post-login redirect, a curator would sign in and stay on `/giris` staring at the same form. Fixed: an explicit `router.push("/kuyruk")` on success, tested.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GirisPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const signIn = vi.fn();
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ signIn }) }));

beforeEach(() => {
  push.mockClear();
  signIn.mockReset();
});

describe("GirisPage", () => {
  it("calls signIn with email/password and redirects to /kuyruk on success", async () => {
    signIn.mockResolvedValue({ error: null });
    render(<GirisPage />);
    fireEvent.change(screen.getByLabelText(/e-posta/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/şifre/i), { target: { value: "sifre123" } });
    fireEvent.click(screen.getByRole("button", { name: /giriş/i }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith("a@b.com", "sifre123"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/kuyruk"));
  });

  it("shows the error and does NOT redirect when signIn fails", async () => {
    signIn.mockResolvedValue({ error: "Geçersiz kimlik bilgileri" });
    render(<GirisPage />);
    fireEvent.change(screen.getByLabelText(/e-posta/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/şifre/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /giriş/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Geçersiz kimlik bilgileri"));
    expect(push).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/admin && npx vitest run src/app/giris/page.spec.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Create `apps/admin/src/app/giris/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function GirisPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await signIn(email, password);
    if (error) {
      setError(error);
      return;
    }
    router.push("/kuyruk");
  }

  return (
    <main data-testid="giris-page">
      <h1>Kürasyon Paneli Girişi</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">E-posta</label>
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="password">Şifre</label>
        <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Giriş yap</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/admin && npx vitest run src/app/giris/page.spec.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/app/giris
git commit -m "feat(admin): add login page"
```

No Codex visual pass for this task — a single conventional login form doesn't need one (matches Plan 2's Task 7 precedent: simple forms without a separate design-judgment call).

---

## Task 7: CORS + port wiring, cross-model review

**Files:**
- Modify: `apps/api/src/main.ts` (CORS default origins)

**Interfaces:**
- Consumes: nothing new
- Produces: `apps/admin` (port 3003) can actually call `apps/api` (port 3001) in local dev without a CORS error

- [ ] **Step 1: Update `apps/api/src/main.ts`'s CORS default origin list** to include `http://localhost:3003` alongside the existing 3000/3001/3002 (same one-line, additive, low-risk change pattern as Plan 2's fix — verify with `cd apps/api && npx tsc --noEmit`, no test depends on the exact default string).

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/main.ts
git commit -m "fix(api): include localhost:3003 in default CORS origins for apps/admin"
```

- [ ] **Step 3: Manual smoke check against the real local stack** — bring up Supabase + `apps/api` (PORT=3001) + `apps/admin` (dev, port 3003). Local Supabase has been successfully brought up in this exact worktree before (Plan 2 Task 11's real, documented precedent — `docker info` working, `npx supabase start`, ports 54421-54429 per `apps/api/supabase/config.toml`) — attempt this for real, do not treat "requires Docker" as an automatic excuse to skip. Concretely verify, against the real running DB:
  1. Log in with a real `curator`-role test account (set the role manually via Supabase dashboard or a one-off SQL update first — this plan deliberately has no role-assignment UI).
  2. `/kuyruk` loads real (possibly empty) queue data without a Zod validation crash.
  3. Manually insert one PENDING `REPORT` row (SQL or via the already-tested public `POST /venues/:id/report` endpoint) and confirm it appears, then approve it and confirm it disappears from the pending list and `venue.verifiedAt` updated in the DB.
  4. `/import` uploads a real CSV, creates the venue in the DB (query it directly to confirm), and re-uploading the SAME CSV reports it as `skipped`, not created again (the idempotency claim Task 2 makes).

  Document the actual output of each of these four checks in the task report — pass/fail per item, not a single pass/fail for the whole step. If a genuine environment blocker prevents this (Docker truly unavailable, confirmed by actually running `docker info` and getting a real error), report that as BLOCKED with the exact error, same escalation path as Plan 2 Task 11 — but only after a real attempt, not as a default.

- [ ] **Step 4: Mandatory cross-model review (no code produced)** — this task itself is the plan's `cross-model-review` step, run identically to Plan 1 Task 24 / Plan 2's final whole-branch review: generate a full-plan diff package from this plan's first commit to `HEAD`, dispatch the `code-reviewer` agent (which internally delegates to Codex) for a whole-branch review scoped to this plan's Global Constraints, process any findings before considering Plan 3 complete.

---

## Red-team bulguları — kabul/ret kaydı

`plan-red-team` (Codex, yüksek güven, verdikt: YENİDEN BÖL) tüm bulguları koddan doğrulayarak
raporladı — kod dosyaları (admin-queue.service.ts, csv-import.service.ts, admin-venues.controller.ts,
admin-venue.schema.ts, jwt-auth.middleware.ts, roles.guard.ts) doğrudan okunarak. Bulguların TAMAMI
kabul edildi ve plana işlendi:

- **Sözleşme kırıkları** (Task 2'nin `{created,skipped,errors}` sözü verip veremeyeceği, `z.coerce.boolean()`
  hatası, `openingHours` gevşek doğrulama, `importRows`'un "use your judgment"a bırakılması): kabul,
  Task 2'de tam kod ile düzeltildi.
- **Queue type sızıntısı** (`AdminQueueService.list()` REPORT dışı tipleri de döndürüyor, tek bir
  pending EDIT/re_verify kaydı /kuyruk'u çökertir): kabul, `getQueue`'nun `type` parametresini
  kaldırıp yapısal olarak `type=REPORT` göndermesi şeklinde düzeltildi.
- **approve/reject response'unun doğrulanmaması** ("hepsi safeParse ile doğrular" iddiasıyla çelişki):
  kabul, `AdminQueueMutationResultSchema` eklendi.
- **Task 0'ın Task 1'e ait dosyayı import etmesi** (kendi "bootable" iddiasıyla çelişki): kabul,
  `AuthProvider` wiring'i Task 1'e taşındı (Plan 2'nin gerçek sıralamasıyla eşleşecek şekilde).
- **vitest.config.ts/setup eksikliği**: kabul, Task 0'a eklendi.
- **Task 2/4'ün Files bölümünde eksik dosyalar**: kabul, düzeltildi.
- **Zayıf testler** (rol testi gerçek JWT kullanmıyordu, protected-layout statik import, Task 4/5/6'da
  reddet/urgent/nullable-venue/HTTP-hata/post-login-redirect testleri yoktu): kabul, hepsine test
  eklendi.
- **Eksik task: REPORT approve semantiği**: kabul edildi AMA yeni bir task AÇILMADI — bu, Plan 1'in
  zaten şevkedilmiş, test edilmiş `approve()` davranışının (verifiedAt'i yeniler, veriyi düzeltmez)
  zaten `docs/STATE.md`'de kayıtlı, kasıtlı olarak ertelenmiş bir ürün sorusu olduğu tespit edildi.
  Task 4'e bir ürün-semantiği notu + `QueueItem`'ın buton metnine bir açıklama eklendi ("yalnızca
  incelendi olarak işaretler"), davranışın kendisi bu planın kapsamında değil.

**Reddedilen bulgu yok** — her bulgu ya doğrudan koda/plana işlendi ya da (approve semantiği gibi)
zaten bilinen, kasıtlı bir kapsam sınırı olarak açıkça belgelendi.

**CONFIDENCE (Codex):** GÜVEN yüksek. FİKRİMİ NE DEĞİŞTİRİR: gerçek HTTP/DB testiyle curator login →
yalnız REPORT queue → approve/reject'in tanımlı ürün etkisi → CSV'de "false" korunarak gerçek
persistence/idempotency akışının geçtiğine dair somut kanıt (Task 7 Step 3'ün dört maddesi tam
olarak bunu talep edecek şekilde güçlendirildi).
