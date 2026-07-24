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
- Create: `apps/admin/{package.json, next.config.js, tsconfig.json, tailwind.config.ts, postcss.config.js, src/app/layout.tsx, src/app/globals.css}`

**Interfaces:**
- Consumes: `packages/shared`, `packages/api-client` (workspace deps, same as `apps/web`)
- Produces: bootable Next.js dev server (`next dev -p 3003`), `RootLayout`

No PWA manifest here (internal tool, not installable) — this is the one deliberate divergence from Task 0's Plan-2 twin.

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

- [ ] **Step 5: Create `apps/admin/src/app/globals.css`** — Tailwind directives only (`@tailwind base/components/utilities`), no custom design tokens yet (Task 3's Codex visual pass establishes the internal-tool visual language, deliberately distinct from `apps/web`'s "rehber" consumer identity per the design doc).

- [ ] **Step 6: Create `apps/admin/src/app/layout.tsx`** — minimal shell, no manifest/PWA metadata:

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

(References `@/lib/auth-context`, created in Task 1 — this file won't compile standalone until then; that's expected, matches Plan 2 Task 0's precedent.)

- [ ] **Step 7: Install and verify the dev server boots**

Run: `pnpm install && pnpm --filter @gurmego/admin dev &` then `curl -s http://localhost:3003 | head -5` (expect a 404 body since no `page.tsx` exists yet — that's fine, proves the server boots), then stop the dev server.

- [ ] **Step 8: Commit**

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

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth-context";

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: "tok",
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
  it("reads the role from the session JWT's user_role claim", async () => {
    // Supabase sessions carry custom claims on `session.user.app_metadata` or a decoded JWT field
    // depending on how the claim was set up — Plan 1's JwtAuthMiddleware reads `user_role` from the
    // decoded JWT (apps/api/src/auth/jwt-auth.middleware.ts). The browser-side Supabase session
    // object exposes the same claims via `session.user.user_metadata`/`app_metadata` OR by decoding
    // `session.access_token` (a JWT) directly — decode the access_token's payload here rather than
    // assuming a metadata field, since that's what actually carries `user_role` per Plan 1's own
    // JWT-issuing convention (Supabase custom access token hook, see docs/STATE.md's follow-up note
    // on this being unverified against a real Supabase project — this app's role-reading code must
    // therefore decode the JWT payload directly, matching the backend's own approach, not guess at
    // a metadata field name that may not be populated).
    render(<AuthProvider><RoleProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("role")).toBeInTheDocument());
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

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ProtectedLayout from "./layout";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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
    vi.resetModules();
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({ user: { id: "u1" }, role: null, loading: false }),
    }));
    const { default: Layout } = await import("./layout");
    render(<Layout><div>içerik</div></Layout>);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/erisim-yok"));
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `cd apps/admin && npx vitest run "src/app/(protected)/layout.spec.tsx"`
Expected: FAIL — module not found

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
Expected: PASS (2 tests)

- [ ] **Step 12: Commit**

```bash
git add apps/admin/src/lib apps/admin/.env.local.example "apps/admin/src/app/(protected)" apps/admin/src/app/erisim-yok
git commit -m "feat(admin): add Supabase Auth client with curator/admin role gate"
```

---

## Task 2: Fix CSV import to actually persist venues (apps/api)

**Files:**
- Modify: `apps/api/src/admin/venues/csv-import.service.ts`, `apps/api/src/admin/venues/csv-import.service.spec.ts`, `apps/api/src/admin/venues/admin-venues.controller.ts`
- Test: `apps/api/src/admin/venues/csv-import.service.spec.ts`

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
  franchiseFlag: z.coerce.boolean(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  openingHours: z.string().transform((s, ctx) => {
    try {
      return JSON.parse(s) as Record<string, string>;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "openingHours geçerli JSON olmalı" });
      return z.NEVER;
    }
  }),
});

@Injectable()
export class CsvImportService {
  parseRows(csv: string) {
    const records: Record<string, string>[] = parse(csv, { columns: true, skip_empty_lines: true });
    const valid: z.infer<typeof CsvRowSchema>[] = [];
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

- [ ] **Step 5: Write the failing controller test for actual persistence**

Read `apps/api/src/admin/venues/admin-venues.controller.spec.ts` (if it exists) or `admin-venues.service.spec.ts` first to match this codebase's existing test conventions for `venuesRepository`/`prisma` mocking. Add a test asserting: given a valid CSV with one new-slug row and one already-existing-slug row, `importCsv` creates exactly the new one, skips the existing one, and the response has `{ created: 1, skipped: 1, errors: [] }`. Mock `venuesRepository.createWithLocation` and a district-slug-to-id lookup (check how `apps/api/prisma/seed.ts` resolves district slugs — likely a `prisma.district.findUnique({where: {slug}})` call — mirror that exact pattern in the new import logic rather than inventing a different lookup).

- [ ] **Step 6: Run test to verify it fails**

Run: `cd apps/api && npx jest admin-venues`
Expected: FAIL — persistence logic doesn't exist yet

- [ ] **Step 7: Update `apps/api/src/admin/venues/admin-venues.controller.ts`'s `importCsv`** to actually persist:

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

Add `importRows(rows: CsvRow[])` to `AdminVenuesService` (or a new method on `CsvImportService` — use your judgment on which file, but keep `AdminVenuesService.create`'s rule-engine/location logic as the single path venues get created through, don't duplicate it): for each row, look up `districtSlug` → `districtId` via `prisma.district.findUnique`; if the district doesn't exist, add a row-level error; if a venue with that `slug` already exists, increment `skipped`; otherwise call the existing `create()` method (reusing its `isBoutique` computation and `createWithLocation` call) with the row's fields mapped to `AdminVenueCreateInput` shape, and increment `created`. Wrap the whole batch in a way that one bad row doesn't abort the rest (per-row try/catch, matching `csv-import.service.ts`'s existing per-row error collection pattern).

- [ ] **Step 8: Run test to verify it passes**

Run: `cd apps/api && npx jest admin-venues csv-import`
Expected: PASS

- [ ] **Step 9: Run full apps/api suite to confirm zero regressions**

Run: `cd apps/api && npx tsc --noEmit && npx jest`
Expected: PASS (78+ tests — the existing 77 plus this task's additions)

- [ ] **Step 10: Commit**

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

```typescript
import { z } from "zod";

export const AdminQueueItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["REPORT"]), // only REPORT exists in MVP — suggestion/correction types are Faz 2
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

```typescript
import { describe, it, expect, vi } from "vitest";
import { getQueue, approveQueueItem, rejectQueueItem, importCsv, ApiValidationError } from "./api";

vi.mock("@gurmego/api-client", () => ({
  createApiClient: vi.fn(() => ({ get: vi.fn(), post: vi.fn() })),
}));

// (Full test suite mirrors apps/web/src/lib/api.spec.ts's pattern exactly: for each function, a
// success-path test with a realistic valid fixture, and a validation-failure test asserting
// ApiValidationError is thrown when the mocked response is malformed. importCsv's test mocks a
// FormData-accepting post — check how api-client's .post signature handles a File/FormData body
// vs. a JSON body; if createApiClient's .post always JSON.stringifies its body (per Plan 2's Task 2
// Step 0b implementation), importCsv will need its own fetch call bypassing the shared .post helper,
// similar to how apps/web/src/lib/api.ts's reportVenue uses a raw fetch instead of authedClient.post
// for a case that didn't fit the shared helper's assumptions — read that function for the precedent
// before deciding whether importCsv needs the same treatment.)
```

Write the actual RED/GREEN test code following the established `apps/web/src/lib/api.spec.ts` conventions — one describe block per function, `vi.hoisted()` for the mock functions, success + failure cases each.

- [ ] **Step 5: Run test to verify it fails**

Run: `cd apps/admin && npx vitest run src/lib/api.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 6: Create `apps/admin/src/lib/api.ts`**

```typescript
import { createApiClient } from "@gurmego/api-client";
import {
  AdminQueueListSchema,
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

export async function getQueue(
  token: string,
  filters: { type?: string; status?: string } = {},
): Promise<AdminQueueItem[]> {
  const client = createApiClient(API_BASE, () => token);
  const params = new URLSearchParams(filters as Record<string, string>).toString();
  const raw = await client.get<unknown>(`/admin/queue${params ? `?${params}` : ""}`);
  const result = AdminQueueListSchema.safeParse(raw);
  if (!result.success) throw new ApiValidationError("/admin/queue", result.error.issues);
  return result.data;
}

export async function approveQueueItem(token: string, id: string): Promise<void> {
  const client = createApiClient(API_BASE, () => token);
  await client.post<unknown>(`/admin/queue/${id}/approve`, {});
}

export async function rejectQueueItem(token: string, id: string): Promise<void> {
  const client = createApiClient(API_BASE, () => token);
  await client.post<unknown>(`/admin/queue/${id}/reject`, {});
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
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/schemas/admin-queue.schema.ts packages/shared/src/index.ts apps/admin/src/lib/api.ts apps/admin/src/lib/api.spec.ts
git commit -m "feat(admin): add Zod-validated API wrapper for queue and CSV import"
```

---

## Task 4: Kürasyon kuyruğu page

**Files:**
- Create: `apps/admin/src/app/(protected)/kuyruk/page.tsx`, `apps/admin/src/app/(protected)/kuyruk/page.spec.tsx`, `apps/admin/src/components/queue-item.tsx`

**Interfaces:**
- Consumes: `getQueue`, `approveQueueItem`, `rejectQueueItem` (Task 3), `useAuth` (Task 1)
- Produces: `/kuyruk` route (the app's index/landing page — set `apps/admin/src/app/(protected)/page.tsx` to redirect here, since this narrowed scope has no other natural landing page)

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

describe("KuyrukPage", () => {
  it("lists pending items and approves one on click", async () => {
    getQueue.mockResolvedValueOnce([
      { id: "q1", type: "REPORT", venueId: "v1", payload: { reason: "Fiyat yanlış" }, submittedBy: null,
        status: "PENDING", reviewedBy: null, reviewedAt: null, createdAt: "2026-01-01T00:00:00.000Z",
        venue: { name: "Test Cafe", slug: "test-cafe" }, urgent: false },
    ]).mockResolvedValueOnce([]); // refetch after approve returns empty (item now APPROVED, filtered out)

    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));
    await waitFor(() => expect(approveQueueItem).toHaveBeenCalledWith("tok", "q1"));
    await waitFor(() => expect(getQueue).toHaveBeenCalledTimes(2)); // initial + refetch after mutation
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
      <button onClick={() => onApprove(item.id)}>Onayla</button>
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
Expected: PASS (1 test)

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
- Produces: `/import` route — file picker + row-level result table

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ImportPage from "./page";

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ session: { access_token: "tok" }, role: "curator", loading: false, user: { id: "u1" } }),
}));
const importCsv = vi.fn();
vi.mock("@/lib/api", () => ({ importCsv: (...args: unknown[]) => importCsv(...args) }));

describe("ImportPage", () => {
  it("uploads a file and shows the created/skipped/error summary", async () => {
    importCsv.mockResolvedValue({ created: 2, skipped: 1, errors: [{ row: 4, message: "priceRange geçersiz" }] });
    render(<ImportPage />);

    const file = new File(["name,slug\nTest,test"], "venues.csv", { type: "text/csv" });
    const input = screen.getByLabelText(/csv dosyası/i);
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));

    await waitFor(() => expect(importCsv).toHaveBeenCalledWith("tok", file));
    await waitFor(() => expect(screen.getByText(/2.*oluşturuldu/i)).toBeInTheDocument());
    expect(screen.getByText(/priceRange geçersiz/i)).toBeInTheDocument();
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

  async function handleUpload() {
    if (!session?.access_token || !file) return;
    setUploading(true);
    const res = await importCsv(session.access_token, file);
    setResult(res);
    setUploading(false);
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
Expected: PASS (1 test)

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

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GirisPage from "./page";

const signIn = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ signIn }) }));

describe("GirisPage", () => {
  it("calls signIn with email/password on submit", async () => {
    render(<GirisPage />);
    fireEvent.change(screen.getByLabelText(/e-posta/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/şifre/i), { target: { value: "sifre123" } });
    fireEvent.click(screen.getByRole("button", { name: /giriş/i }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith("a@b.com", "sifre123"));
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
import { useAuth } from "@/lib/auth-context";

export default function GirisPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await signIn(email, password);
    setError(error);
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
Expected: PASS (1 test)

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

- [ ] **Step 3: Manual smoke check against the real local stack** — bring up Supabase + `apps/api` (PORT=3001) + `apps/admin` (dev, port 3003), log in with a real `curator`-role account (or manually set the role via Supabase dashboard on a test account first, since this plan deliberately has no role-assignment UI), confirm `/kuyruk` loads real queue data and `/import` actually creates a venue from a real CSV upload against the local DB — this is the plan's equivalent of Plan 1/2's "verify against real DB/HTTP" discipline. Document the outcome in the task report; if Docker/Supabase isn't available in the execution environment, note that as a BLOCKED-equivalent finding for the controller to resolve (same escalation path as Plan 2 Task 11).

- [ ] **Step 4: Mandatory cross-model review (no code produced)** — this task itself is the plan's `cross-model-review` step, run identically to Plan 1 Task 24 / Plan 2's final whole-branch review: generate a full-plan diff package from this plan's first commit to `HEAD`, dispatch the `code-reviewer` agent (which internally delegates to Codex) for a whole-branch review scoped to this plan's Global Constraints, process any findings before considering Plan 3 complete.

---

## Red-team bulguları — reddedilenler

(Populated during `plan-red-team`, not before — see that skill's Adım 4 for the required format.)
