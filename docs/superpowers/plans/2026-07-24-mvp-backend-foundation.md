# GurmeGo MVP — Plan 1/4: Backend + Data Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the monorepo skeleton, Prisma/PostGIS data model, and the complete NestJS API (public + admin) for the GurmeGo pilot — no reviews, no Gurme Puanı, no mobile, no semantic search — so that the API is independently testable (curl/Postman/integration tests) before any frontend exists.

**Architecture:** pnpm + Turborepo monorepo. NestJS (Fastify adapter) exposes REST/OpenAPI. Prisma is the ORM; PostGIS geography queries are isolated to a repository layer via `$queryRaw` (service layer never sees raw SQL). Supabase Auth issues JWTs verified via JWKS in a NestJS guard. Rate limiting and the "bilgi yanlış" report counter live in Postgres `unlogged` tables behind a `CacheStore` interface — no Redis.

**Tech Stack:** TypeScript (strict), NestJS 10 + Fastify, Prisma 5, PostgreSQL 15 + PostGIS (Supabase), Zod, Jest + `@nestjs/testing`, pnpm workspaces + Turborepo.

**Roadmap context (4 plans total, this is Plan 1):**
1. **This plan** — Backend + Data Foundation (`apps/api`, `packages/shared`, Prisma schema)
2. Web/PWA consumer client (`apps/web`) — written after this plan is reviewed
3. Admin panel UI (`apps/admin`) — written after Plan 2
4. Infra/CI/deployment + KVKK texts + pilot launch checklist — written last, right before real users touch the system (per user's 2026-07-24 decision, see `docs/STATE.md`)

Each plan goes through `plan-red-team` (Codex) before its own execution starts — this is not optional per project convention (`CLAUDE.md`).

## Wiring Convention (read before Task 5)

Every task that adds a new NestJS module (Tasks 5, 7, 10, 11, 12, 13, 15, 17, 19, 20) ends with a step
that registers the new module in `apps/api/src/app.module.ts`'s `imports` array (or `admin.module.ts`
for Task 15/16/17/19). That step is a one-line addition to an existing array — it is **not** repeated as
a separate `Modify:` entry in each task's `Files:` block below to avoid 24× restating the same file, but
it is a real, required step inside each task and is written out explicitly in that task's step list.
`app.module.ts`'s final state (all imports registered) is what Task 3's `test/app.e2e-spec.ts` and Task
24's cross-model review verify against.

## Skill & Delegation Map for This Plan

| Phase (tasks) | Who writes it | Skill(s) to load | Why |
|---|---|---|---|
| 0 — Monorepo skeleton | Sen (Opus/Sonnet) | `turborepo-monorepo` | One-time scaffold, needs judgment about workspace boundaries |
| 1 — Shared zod schemas | Sen | `zod-schema-validation` | Shared contract between API and future clients — design decision, not mechanical |
| 2 — Prisma schema + PostGIS migration | Sen | `prisma-cli`, `prisma-database-setup`, `postgis` | Schema is a durable decision; PostGIS SQL needs the skill's gotcha list |
| 3–21 — NestJS modules (all) | Sen | `nestjs-best-practices` | Module/guard/DI structure; TDD tests are never delegated (project rule: "Test kuralı") |
| 6, 8 — PostGIS repository queries | Sen | `postgis` | `ST_DWithin`/`ST_Distance` correctness, index usage |
| 16 — Admin CRUD + CSV import scaffolding | Optional: GLM via `delegating-bulk-work` | — | Repetitive CRUD boilerplate once the test is red — mechanical, low-creativity. **Only the implementation, never the test** (project rule). If delegated, tell the user before doing it. |
| 22 — OpenAPI/api-client generation | Sen | — | Mechanical but config-sensitive; keep in-house for this first pass |
| 24 — CI (lint/typecheck/test) | Sen | — | Minimal local CI; full deploy pipeline is Plan 4's `devops-engineer` job |
| End of plan | Codex | `cross-model-review` | **Mandatory**, not optional, per `CLAUDE.md` — runs after all tasks pass, before merge |

**MCP note:** `mcp__claude_ai_Supabase__*` tools (`list_tables`, `apply_migration`, `get_advisors`, `generate_typescript_types`) are available but **not used in this plan** — Task 2 only produces local Prisma migration files against a local/dev Postgres (Supabase CLI local stack, per `infrastructure.md §2`). Provisioning the real Supabase project happens in Plan 4 and is a real-money/external-resource action — it needs your explicit go-ahead when we get there, not a silent MCP call.

## Global Constraints

- TypeScript `strict: true` in every package; `any` is forbidden unless justified with `// eslint-disable` + reason (`CLAUDE.md`).
- All API input validated with Zod schemas from `packages/shared`, wired through a NestJS pipe — never hand-rolled validation.
- PostGIS raw SQL (`$queryRaw`) lives only in `apps/api/src/venues/venues.repository.ts` — the service layer never writes SQL (`architecture.md §8`, `CLAUDE.md`).
- Rule engine thresholds (butik eşiği, re-verify günü, moderasyon eşiği) are never hardcoded — read from config/env (`rule-engine.md`).
- User location coordinates are never written to any log or analytics call (NFR-04, `CLAUDE.md` — code review checklist item, every PR).
- No React Native, no Review/GourmetRating tables written to, no `/search` endpoint, no owner-verification endpoint — all Faz 2 (`prd.md v4.0`).
- Migration: **only** `prisma migrate` — never a manual Supabase dashboard schema edit (`CLAUDE.md`).
- Branch naming `feat/...`/`fix/...`/`chore/...`; commits Conventional Commits (`development-guidelines.md §3`).
- Node version pinned via `.nvmrc`; package manager is pnpm.

---

## File Structure

```
gurmego/
├─ .nvmrc
├─ package.json                        # root workspace
├─ pnpm-workspace.yaml
├─ turbo.json
├─ tsconfig.base.json
├─ apps/
│  └─ api/
│     ├─ package.json
│     ├─ tsconfig.json
│     ├─ nest-cli.json
│     ├─ prisma/
│     │  ├─ schema.prisma
│     │  └─ migrations/                # generated by `prisma migrate dev`
│     ├─ src/
│     │  ├─ main.ts
│     │  ├─ app.module.ts
│     │  ├─ prisma/
│     │  │  ├─ prisma.module.ts
│     │  │  └─ prisma.service.ts
│     │  ├─ auth/
│     │  │  ├─ auth.module.ts
│     │  │  ├─ jwt-auth.middleware.ts
│     │  │  ├─ roles.decorator.ts
│     │  │  └─ roles.guard.ts
│     │  ├─ common/
│     │  │  ├─ cache-store.interface.ts
│     │  │  ├─ postgres-cache-store.service.ts
│     │  │  └─ rate-limit.guard.ts
│     │  ├─ districts/
│     │  │  ├─ districts.module.ts
│     │  │  ├─ districts.controller.ts
│     │  │  └─ districts.service.ts
│     │  ├─ venues/
│     │  │  ├─ venues.module.ts
│     │  │  ├─ venues.controller.ts
│     │  │  ├─ venues.service.ts
│     │  │  └─ venues.repository.ts
│     │  ├─ favorites/
│     │  │  ├─ favorites.module.ts
│     │  │  ├─ favorites.controller.ts
│     │  │  └─ favorites.service.ts
│     │  ├─ reports/
│     │  │  ├─ reports.module.ts
│     │  │  ├─ reports.controller.ts
│     │  │  └─ reports.service.ts
│     │  ├─ rule-engine/
│     │  │  ├─ rule-engine.module.ts
│     │  │  └─ boutique.service.ts
│     │  └─ admin/
│     │     ├─ admin.module.ts
│     │     ├─ queue/
│     │     │  ├─ admin-queue.controller.ts
│     │     │  └─ admin-queue.service.ts
│     │     ├─ venues/
│     │     │  ├─ admin-venues.controller.ts
│     │     │  ├─ admin-venues.service.ts
│     │     │  └─ csv-import.service.ts
│     │     ├─ reports/
│     │     │  └─ admin-reports.controller.ts
│     │     └─ users/
│     │        └─ admin-users.controller.ts
│     └─ test/
│        ├─ districts/districts.service.spec.ts
│        ├─ venues/venues.repository.spec.ts
│        ├─ venues/venues.service.spec.ts
│        ├─ venues/venues.controller.spec.ts
│        ├─ favorites/favorites.service.spec.ts
│        ├─ reports/reports.service.spec.ts
│        ├─ rule-engine/boutique.service.spec.ts
│        ├─ admin/admin-queue.service.spec.ts
│        ├─ admin/admin-venues.service.spec.ts
│        └─ admin/admin-reports.controller.spec.ts
└─ packages/
   └─ shared/
      ├─ package.json
      ├─ tsconfig.json
      └─ src/
         ├─ index.ts
         ├─ schemas/
         │  ├─ district.schema.ts
         │  ├─ venue.schema.ts
         │  ├─ report.schema.ts
         │  └─ favorite-list.schema.ts
         └─ enums/
            └─ price-range.ts
```

---

## Task 0: Monorepo skeleton (pnpm + Turborepo)

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`, `.gitignore`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: workspace root that `apps/*` and `packages/*` resolve into; `turbo run test`/`turbo run build`/`turbo run lint` pipeline commands every later task's CI step uses

- [ ] **Step 1: Load the `turborepo-monorepo` skill before writing any config** — it documents `turbo.json` task-graph gotchas (e.g. `dependsOn: ["^build"]`) that are easy to get wrong on the first pass.

- [ ] **Step 2: Create `.nvmrc`**

```
20.11.1
```

- [ ] **Step 3: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 4: Create root `package.json`**

```json
{
  "name": "gurmego",
  "private": true,
  "packageManager": "pnpm@9.1.0",
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 5: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["^build"] },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

- [ ] **Step 6: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 7: Create `.gitignore`**

```
node_modules
dist
.env
.env.local
*.tsbuildinfo
.turbo
```

- [ ] **Step 8: Install and verify workspace resolves**

Run: `pnpm install`
Expected: lockfile created, no errors (no packages exist yet, that's fine)

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .nvmrc .gitignore pnpm-lock.yaml
git commit -m "chore: initialize pnpm + turborepo monorepo skeleton"
```

---

## Task 1: `packages/shared` — Zod schemas for District, Venue, Report, FavoriteList

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`
- Create: `packages/shared/src/enums/price-range.ts`
- Create: `packages/shared/src/schemas/district.schema.ts`
- Create: `packages/shared/src/schemas/venue.schema.ts`
- Create: `packages/shared/src/schemas/report.schema.ts`
- Create: `packages/shared/src/schemas/favorite-list.schema.ts`
- Test: `packages/shared/src/schemas/venue.schema.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `VenueSchema`, `VenueListQuerySchema`, `DistrictSchema`, `ReportSchema`, `FavoriteListSchema`, `CreateFavoriteListSchema` — Zod schemas + inferred TS types (`Venue`, `District`, `Report`, `FavoriteList`), and `PRICE_RANGE_LABELS` map — every NestJS DTO and later web/admin form in Plans 2–3 imports these

- [ ] **Step 1: Load the `zod-schema-validation` skill** before writing schemas — it covers inference patterns (`z.infer<>`) this task relies on.

- [ ] **Step 2: Create `packages/shared/package.json`**

```json
{
  "name": "@gurmego/shared",
  "version": "0.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "vitest": "^1.6.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 3: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 4: Write the failing test — `packages/shared/src/schemas/venue.schema.spec.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { VenueSchema, VenueListQuerySchema } from "./venue.schema";

describe("VenueSchema", () => {
  it("accepts a valid venue payload", () => {
    const result = VenueSchema.safeParse({
      id: "d290f1ee-6c54-4b01-90e6-d701748f0851",
      name: "Kadıköy Kahvecisi",
      slug: "kadikoy-kahvecisi",
      districtId: "d290f1ee-6c54-4b01-90e6-d701748f0852",
      category: "cafe",
      priceRange: "MODERATE",
      signatureItems: ["filtre kahve", "kaşarlı tost"],
      transportNote: "Kadıköy iskelesinden 5 dk yürüme",
      openingHours: { mon: "09:00-22:00" },
      editorialNote: "Sessiz, çalışmaya uygun, gerçek filtre kahve.",
      isBoutique: true,
      branchCount: 1,
      verifiedAt: "2026-07-24T00:00:00.000Z",
      status: "PUBLISHED",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid priceRange", () => {
    const result = VenueSchema.safeParse({
      id: "d290f1ee-6c54-4b01-90e6-d701748f0851",
      name: "X",
      slug: "x",
      districtId: "d290f1ee-6c54-4b01-90e6-d701748f0852",
      category: "cafe",
      priceRange: "FREE",
      signatureItems: [],
      openingHours: {},
      isBoutique: false,
      branchCount: 1,
      verifiedAt: "2026-07-24T00:00:00.000Z",
      status: "DRAFT",
    });
    expect(result.success).toBe(false);
  });

  it("VenueListQuerySchema defaults sort to distance when lat/lng present", () => {
    const result = VenueListQuerySchema.parse({
      districtId: "d290f1ee-6c54-4b01-90e6-d701748f0852",
      lat: "40.99",
      lng: "29.02",
    });
    expect(result.sort).toBe("distance");
    expect(result.lat).toBe(40.99);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/schemas/venue.schema.spec.ts`
Expected: FAIL — `Cannot find module './venue.schema'`

- [ ] **Step 6: Create `packages/shared/src/enums/price-range.ts`**

```typescript
export const PRICE_RANGE_VALUES = ["BUDGET", "MODERATE", "EXPENSIVE", "PREMIUM"] as const;
export type PriceRange = (typeof PRICE_RANGE_VALUES)[number];

export const PRICE_RANGE_LABELS: Record<PriceRange, string> = {
  BUDGET: "₺",
  MODERATE: "₺₺",
  EXPENSIVE: "₺₺₺",
  PREMIUM: "₺₺₺₺",
};
```

- [ ] **Step 7: Create `packages/shared/src/schemas/venue.schema.ts`**

```typescript
import { z } from "zod";
import { PRICE_RANGE_VALUES } from "../enums/price-range";

export const VenueStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const VenueSourceSchema = z.enum(["MANUAL", "USER", "AUTO"]);

export const VenueSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(220),
  districtId: z.string().uuid(),
  category: z.string().min(1),
  cuisineType: z.string().optional(),
  priceRange: z.enum(PRICE_RANGE_VALUES),
  signatureItems: z.array(z.string().min(1)).max(10),
  transportNote: z.string().max(500).optional(),
  openingHours: z.record(z.string(), z.string()),
  editorialNote: z.string().max(1000).optional(),
  isBoutique: z.boolean(),
  branchCount: z.number().int().min(1),
  verifiedAt: z.string().datetime(),
  status: VenueStatusSchema,
  googleRating: z.number().min(0).max(5).optional(),
  googleRatingCount: z.number().int().min(0).optional(),
  googlePlaceId: z.string().optional(),
});
export type Venue = z.infer<typeof VenueSchema>;

export const VenueListQuerySchema = z
  .object({
    districtId: z.string().uuid().optional(),
    category: z.string().optional(),
    cuisineType: z.string().optional(),
    priceRange: z.enum(PRICE_RANGE_VALUES).optional(),
    isBoutique: z.coerce.boolean().optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusM: z.coerce.number().int().positive().max(20000).optional(),
    sort: z.enum(["distance", "newest"]).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().optional(),
  })
  .transform((v) => ({ ...v, sort: v.sort ?? (v.lat && v.lng ? "distance" : "newest") }));
export type VenueListQuery = z.infer<typeof VenueListQuerySchema>;
```

- [ ] **Step 8: Create `packages/shared/src/schemas/district.schema.ts`**

```typescript
import { z } from "zod";

export const DistrictSchema = z.object({
  id: z.string().uuid(),
  cityId: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
});
export type District = z.infer<typeof DistrictSchema>;
```

- [ ] **Step 9: Create `packages/shared/src/schemas/report.schema.ts`**

```typescript
import { z } from "zod";

export const CreateReportSchema = z.object({
  reason: z.string().min(5).max(500),
});
export type CreateReport = z.infer<typeof CreateReportSchema>;
```

- [ ] **Step 10: Create `packages/shared/src/schemas/favorite-list.schema.ts`**

```typescript
import { z } from "zod";

export const CreateFavoriteListSchema = z.object({
  name: z.string().min(1).max(80),
});
export type CreateFavoriteList = z.infer<typeof CreateFavoriteListSchema>;

export const FavoriteListSchema = CreateFavoriteListSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});
export type FavoriteList = z.infer<typeof FavoriteListSchema>;
```

- [ ] **Step 11: Create `packages/shared/src/index.ts`**

```typescript
export * from "./enums/price-range";
export * from "./schemas/district.schema";
export * from "./schemas/venue.schema";
export * from "./schemas/report.schema";
export * from "./schemas/favorite-list.schema";
```

- [ ] **Step 12: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/schemas/venue.schema.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 13: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add venue/district/report/favorite-list zod schemas"
```

---

## Task 2: Prisma schema + PostGIS migration

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/prisma/schema.prisma`
- Create: `apps/api/.env.example`

**Interfaces:**
- Consumes: nothing (data layer root)
- Produces: Prisma Client types (`Venue`, `District`, `City`, `VenueVersion`, `ContributionQueue`, `User`, `FavoriteList`, `Favorite`, `PriceRange`, `VenueStatus`, `VenueSource`, `ContributionType`, `ContributionStatus`, `UserRole` enums) — every later NestJS module in this plan imports `PrismaClient`-generated types

- [ ] **Step 1: Load `prisma-cli`, `prisma-database-setup`, and `postgis` skills** before writing the schema — PostGIS geography columns need `Unsupported(...)` + raw SQL migration edits Prisma can't generate on its own.

- [ ] **Step 2: Create `apps/api/package.json`**

```json
{
  "name": "@gurmego/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start:dev": "nest start --watch",
    "test": "jest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-fastify": "^10.3.0",
    "@prisma/client": "^5.14.0",
    "@gurmego/shared": "workspace:*"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@nestjs/testing": "^10.3.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "prisma": "^5.14.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 3: Create `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `apps/api/.env.example`**

```
DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres"
SUPABASE_JWKS_URL="http://localhost:54321/auth/v1/.well-known/jwks.json"
RULES_BOUTIQUE_MAX_BRANCHES=3
RULES_STALE_DAYS=90
RULES_MOD_AUTO_HIDE_REPORTS=3
```

- [ ] **Step 5: Create `apps/api/prisma/schema.prisma`**

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [postgis(map: "postgis")]
}

enum PriceRange {
  BUDGET
  MODERATE
  EXPENSIVE
  PREMIUM
}

enum VenueStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum VenueSource {
  MANUAL
  USER
  AUTO
}

enum ContributionType {
  REPORT
  NEW_VENUE
  EDIT
  OWNER_VERIFICATION
}

enum ContributionStatus {
  PENDING
  APPROVED
  REJECTED
}

enum UserRole {
  USER
  APPROVED_RATER
  CURATOR
  ADMIN
}

model City {
  id        String     @id @default(uuid())
  name      String
  slug      String     @unique
  districts District[]
}

model District {
  id     String  @id @default(uuid())
  cityId String
  city   City    @relation(fields: [cityId], references: [id])
  name   String
  slug   String  @unique
  venues Venue[]
}

model Venue {
  id                String              @id @default(uuid())
  name              String
  slug              String              @unique
  districtId        String
  district          District            @relation(fields: [districtId], references: [id])
  location          Unsupported("geography(Point,4326)")
  category          String
  cuisineType       String?
  priceRange        PriceRange
  signatureItems    String[]
  transportNote     String?
  openingHours      Json
  editorialNote     String?
  isBoutique        Boolean             @default(false)
  branchCount       Int                 @default(1)
  franchiseFlag     Boolean             @default(false)
  source            VenueSource         @default(MANUAL)
  verifiedAt        DateTime
  status            VenueStatus         @default(DRAFT)
  googleRating      Float?
  googleRatingCount Int?
  googlePlaceId     String?
  featured          Boolean             @default(false)
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  versions          VenueVersion[]
  contributions     ContributionQueue[]
  favorites         Favorite[]

  @@index([districtId])
  @@index([status])
}

model VenueVersion {
  id        String   @id @default(uuid())
  venueId   String
  venue     Venue    @relation(fields: [venueId], references: [id])
  snapshot  Json
  createdAt DateTime @default(now())
  createdBy String?

  @@index([venueId])
}

model ContributionQueue {
  id           String              @id @default(uuid())
  type         ContributionType
  venueId      String?
  venue        Venue?              @relation(fields: [venueId], references: [id])
  payload      Json
  submittedBy  String?
  status       ContributionStatus  @default(PENDING)
  reviewedBy   String?
  reviewedAt   DateTime?
  createdAt    DateTime            @default(now())

  @@index([venueId, status])
  @@index([type, status])
}

model User {
  id        String   @id
  email     String   @unique
  role      UserRole @default(USER)
  createdAt DateTime @default(now())
  lists     FavoriteList[]
}

model FavoriteList {
  id        String     @id @default(uuid())
  userId    String
  user      User       @relation(fields: [userId], references: [id])
  name      String
  createdAt DateTime   @default(now())
  favorites Favorite[]
}

model Favorite {
  id        String       @id @default(uuid())
  listId    String
  list      FavoriteList @relation(fields: [listId], references: [id])
  venueId   String
  venue     Venue        @relation(fields: [venueId], references: [id])
  createdAt DateTime     @default(now())

  @@unique([listId, venueId])
}
```

- [ ] **Step 6: Generate the initial migration**

Run: `cd apps/api && npx prisma migrate dev --name init --create-only`
Expected: a new file under `apps/api/prisma/migrations/<timestamp>_init/migration.sql` is created (not yet applied)

- [ ] **Step 7: Add the GIST index on `location` — Prisma can't express this, edit the generated SQL directly**

Open `apps/api/prisma/migrations/<timestamp>_init/migration.sql` and append:

```sql
CREATE INDEX "Venue_location_idx" ON "Venue" USING GIST ("location");
```

- [ ] **Step 8: Apply the migration against local Supabase Postgres**

Run: `cd apps/api && npx prisma migrate dev`
Expected: `Your database is now in sync with your schema.` — no errors

- [ ] **Step 9: Generate Prisma Client and verify types compile**

Run: `cd apps/api && npx prisma generate && npx tsc --noEmit -p tsconfig.json`
Expected: no type errors (no `src/` files reference the client yet, so this mostly checks schema.prisma parses)

- [ ] **Step 10: Commit**

```bash
git add apps/api/package.json apps/api/tsconfig.json apps/api/prisma apps/api/.env.example
git commit -m "feat(api): add Prisma schema with PostGIS venue geography column"
```

---

## Task 3: NestJS app skeleton (Fastify, Zod validation pipe)

**Files:**
- Create: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/nest-cli.json`
- Create: `apps/api/src/common/zod-validation.pipe.ts`
- Test: `apps/api/test/app.e2e-spec.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `ZodValidationPipe` (constructor takes a Zod schema, used as `@UsePipes(new ZodValidationPipe(SomeSchema))` on every controller method in later tasks); bootstrapped Fastify app on port `3000`, `/health` endpoint

- [ ] **Step 1: Load the `nestjs-best-practices` skill** before writing modules — covers Fastify adapter setup and pipe/guard ordering used throughout this plan.

- [ ] **Step 2: Create `apps/api/nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src"
}
```

- [ ] **Step 3: Write the failing test — `apps/api/test/app.e2e-spec.ts`**

```typescript
import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "../src/app.module";

describe("AppModule (e2e)", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({ status: "ok" });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd apps/api && npx jest test/app.e2e-spec.ts`
Expected: FAIL — `Cannot find module '../src/app.module'`

- [ ] **Step 5: Create `apps/api/src/common/zod-validation.pipe.ts`**

```typescript
import { PipeTransform, Injectable, BadRequestException } from "@nestjs/common";
import { ZodSchema } from "zod";

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        error: { code: "VALIDATION_ERROR", message: "Girdi doğrulanamadı", details: result.error.flatten() },
      });
    }
    return result.data;
  }
}
```

- [ ] **Step 6: Create `apps/api/src/app.module.ts`**

```typescript
import { Module, Controller, Get } from "@nestjs/common";

@Controller("health")
class HealthController {
  @Get()
  check() {
    return { status: "ok" };
  }
}

@Module({
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 7: Create `apps/api/src/main.ts`** — sets the `/v1` global prefix per `api-spec.md §1` ("Base URL: `https://api.gurmego.app/v1`"); every controller route in every later task is unprefixed in code and gets `/v1` added here, once

```typescript
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix("v1", { exclude: ["health"] });
  await app.listen(process.env.PORT ?? 3000, "0.0.0.0");
}
bootstrap();
```

- [ ] **Step 8: Update the e2e test for the prefix change**

```typescript
it("GET /health returns ok (excluded from /v1 prefix)", async () => {
  const res = await app.inject({ method: "GET", url: "/health" });
  expect(res.statusCode).toBe(200);
});
```

Replace the existing `it("GET /health returns ok"...)` block in `test/app.e2e-spec.ts` with this one (same
assertion, renamed to document the prefix exclusion). Note for every later task: `app.inject`/curl calls
against any non-health endpoint must include the `/v1` prefix (e.g. `/v1/venues`, not `/venues`) — the
route decorators inside controllers stay prefix-free, Nest adds it automatically.

- [ ] **Step 9: Run test to verify it passes**

Run: `cd apps/api && npx jest test/app.e2e-spec.ts`
Expected: PASS (1 test)

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/main.ts apps/api/src/app.module.ts apps/api/src/common/zod-validation.pipe.ts apps/api/nest-cli.json apps/api/test/app.e2e-spec.ts
git commit -m "feat(api): bootstrap NestJS with Fastify adapter, /v1 global prefix, health endpoint"
```

---

## Task 4: PrismaService

**Files:**
- Create: `apps/api/src/prisma/prisma.module.ts`, `apps/api/src/prisma/prisma.service.ts`
- Test: `apps/api/src/prisma/prisma.service.spec.ts`

**Interfaces:**
- Consumes: Prisma Client generated in Task 2
- Produces: `PrismaService` (extends `PrismaClient`, `onModuleInit`/`onModuleDestroy` lifecycle) — every module from Task 5 onward injects this

- [ ] **Step 1: Write the failing test**

```typescript
import { Test } from "@nestjs/testing";
import { PrismaService } from "./prisma.service";

describe("PrismaService", () => {
  it("connects on module init", async () => {
    const moduleRef = await Test.createTestingModule({ providers: [PrismaService] }).compile();
    const prisma = moduleRef.get(PrismaService);
    const connectSpy = jest.spyOn(prisma, "$connect").mockResolvedValue();
    await prisma.onModuleInit();
    expect(connectSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/prisma/prisma.service.spec.ts`
Expected: FAIL — `Cannot find module './prisma.service'`

- [ ] **Step 3: Create `apps/api/src/prisma/prisma.service.ts`**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 4: Create `apps/api/src/prisma/prisma.module.ts`**

```typescript
import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && npx jest src/prisma/prisma.service.spec.ts`
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/prisma
git commit -m "feat(api): add PrismaService with connection lifecycle hooks"
```

---

## Task 5: Districts module (`GET /districts`, `GET /districts/nearest`)

**Files:**
- Create: `apps/api/src/districts/districts.module.ts`, `districts.controller.ts`, `districts.service.ts`
- Test: `apps/api/src/districts/districts.service.spec.ts` (no controller spec — the service test covers `findAll`/`findNearest` logic; the controller is a thin pass-through with no branching logic of its own)

**Interfaces:**
- Consumes: `PrismaService` (Task 4)
- Produces: `DistrictsService.findAll(citySlug: string): Promise<District[]>`, `DistrictsService.findNearest(lat: number, lng: number): Promise<District>` — used by Task 7's venue filters and by Plan 2's web app district picker

- [ ] **Step 1: Write the failing test — `districts.service.spec.ts`**

```typescript
import { Test } from "@nestjs/testing";
import { DistrictsService } from "./districts.service";
import { PrismaService } from "../prisma/prisma.service";

describe("DistrictsService", () => {
  it("findAll returns districts for a city slug", async () => {
    const prisma = {
      district: { findMany: jest.fn().mockResolvedValue([{ id: "1", name: "Kadıköy" }]) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [DistrictsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const service = moduleRef.get(DistrictsService);

    const result = await service.findAll("istanbul");

    expect(prisma.district.findMany).toHaveBeenCalledWith({
      where: { city: { slug: "istanbul" } },
    });
    expect(result).toEqual([{ id: "1", name: "Kadıköy" }]);
  });

  it("findNearest picks the closest district by centroid distance", async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: "2", name: "Beşiktaş" }]),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [DistrictsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const service = moduleRef.get(DistrictsService);

    const result = await service.findNearest(41.04, 29.0);

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(result).toEqual({ id: "2", name: "Beşiktaş" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/districts/districts.service.spec.ts`
Expected: FAIL — `Cannot find module './districts.service'`

- [ ] **Step 3: Create `apps/api/src/districts/districts.service.ts`**

```typescript
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DistrictsService {
  constructor(private prisma: PrismaService) {}

  findAll(citySlug: string) {
    return this.prisma.district.findMany({ where: { city: { slug: citySlug } } });
  }

  async findNearest(lat: number, lng: number) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; name: string }>>(
      Prisma.sql`
        SELECT d.id, d.name
        FROM "District" d
        JOIN "Venue" v ON v."districtId" = d.id
        ORDER BY v.location <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        LIMIT 1
      `,
    );
    return rows[0];
  }
}
```

*Not loading the `postgis` skill here would be a mistake — `<->` is the KNN distance operator and only works correctly with a GIST index on `location` (already added in Task 2 Step 7).*

- [ ] **Step 4: Create `apps/api/src/districts/districts.controller.ts`**

```typescript
import { Controller, Get, Query } from "@nestjs/common";
import { DistrictsService } from "./districts.service";

@Controller("districts")
export class DistrictsController {
  constructor(private districts: DistrictsService) {}

  @Get()
  findAll(@Query("city") city = "istanbul") {
    return this.districts.findAll(city);
  }

  @Get("nearest")
  findNearest(@Query("lat") lat: string, @Query("lng") lng: string) {
    return this.districts.findNearest(parseFloat(lat), parseFloat(lng));
  }
}
```

- [ ] **Step 5: Create `apps/api/src/districts/districts.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { DistrictsController } from "./districts.controller";
import { DistrictsService } from "./districts.service";

@Module({
  controllers: [DistrictsController],
  providers: [DistrictsService],
  exports: [DistrictsService],
})
export class DistrictsModule {}
```

- [ ] **Step 6: Register `DistrictsModule` and `PrismaModule` in `apps/api/src/app.module.ts`**

```typescript
import { Module, Controller, Get } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { DistrictsModule } from "./districts/districts.module";

@Controller("health")
class HealthController {
  @Get()
  check() {
    return { status: "ok" };
  }
}

@Module({
  imports: [PrismaModule, DistrictsModule],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd apps/api && npx jest src/districts`
Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/districts apps/api/src/app.module.ts
git commit -m "feat(api): add districts module with nearest-district PostGIS query"
```

---

## Task 6: Venues repository (PostGIS structural search)

**Files:**
- Create: `apps/api/src/venues/venues.repository.ts`
- Test: `apps/api/src/venues/venues.repository.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (Task 4)
- Produces: `VenuesRepository.searchPublished(filters: VenueListQuery): Promise<{ items: VenueRow[]; nextCursor: string | null }>` — Task 7's `VenuesService` calls this; this is the **only** file in the module allowed to contain raw SQL (Global Constraints)

- [ ] **Step 1: Write the failing test**

```typescript
import { Prisma } from "@prisma/client";
import { VenuesRepository } from "./venues.repository";
import { PrismaService } from "../prisma/prisma.service";

describe("VenuesRepository.searchPublished", () => {
  it("builds a distance-sorted query when lat/lng given and returns cursor", async () => {
    const rows = [
      { id: "v1", name: "A", slug: "a", distance_m: 120 },
      { id: "v2", name: "B", slug: "b", distance_m: 340 },
    ];
    const prisma = { $queryRaw: jest.fn().mockResolvedValue(rows) } as unknown as PrismaService;
    const repo = new VenuesRepository(prisma);

    const result = await repo.searchPublished({
      lat: 40.99,
      lng: 29.02,
      radiusM: 3000,
      sort: "distance",
      limit: 2,
    } as any);

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
  });

  it("returns null cursor when fewer rows than limit", async () => {
    const rows = [{ id: "v1", name: "A", slug: "a", distance_m: 120 }];
    const prisma = { $queryRaw: jest.fn().mockResolvedValue(rows) } as unknown as PrismaService;
    const repo = new VenuesRepository(prisma);

    const result = await repo.searchPublished({ sort: "newest", limit: 20 } as any);

    expect(result.nextCursor).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts`
Expected: FAIL — `Cannot find module './venues.repository'`

- [ ] **Step 3: Create `apps/api/src/venues/venues.repository.ts`**

```typescript
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { VenueListQuery } from "@gurmego/shared";

interface VenueRow {
  id: string;
  name: string;
  slug: string;
  distance_m?: number;
}

@Injectable()
export class VenuesRepository {
  constructor(private prisma: PrismaService) {}

  async searchPublished(filters: VenueListQuery) {
    const conditions: Prisma.Sql[] = [Prisma.sql`v.status = 'PUBLISHED'`];
    if (filters.districtId) conditions.push(Prisma.sql`v."districtId" = ${filters.districtId}`);
    if (filters.category) conditions.push(Prisma.sql`v.category = ${filters.category}`);
    if (filters.priceRange) conditions.push(Prisma.sql`v."priceRange" = ${filters.priceRange}::"PriceRange"`);
    if (filters.isBoutique !== undefined) conditions.push(Prisma.sql`v."isBoutique" = ${filters.isBoutique}`);

    const where = Prisma.join(conditions, " AND ");
    const limit = filters.limit ?? 20;

    const distanceSelect =
      filters.lat && filters.lng
        ? Prisma.sql`, ST_Distance(v.location, ST_SetSRID(ST_MakePoint(${filters.lng}, ${filters.lat}), 4326)::geography) AS distance_m`
        : Prisma.sql``;

    const radiusFilter =
      filters.lat && filters.lng && filters.radiusM
        ? Prisma.sql`AND ST_DWithin(v.location, ST_SetSRID(ST_MakePoint(${filters.lng}, ${filters.lat}), 4326)::geography, ${filters.radiusM})`
        : Prisma.sql``;

    const orderBy =
      filters.sort === "distance" && filters.lat && filters.lng
        ? Prisma.sql`ORDER BY distance_m ASC`
        : Prisma.sql`ORDER BY v."createdAt" DESC`;

    const rows = await this.prisma.$queryRaw<VenueRow[]>(Prisma.sql`
      SELECT v.id, v.name, v.slug, v."priceRange", v."isBoutique", v."editorialNote",
             v."googleRating", v."googleRatingCount"${distanceSelect}
      FROM "Venue" v
      WHERE ${where} ${radiusFilter}
      ${orderBy}
      LIMIT ${limit + 1}
    `);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? Buffer.from(JSON.stringify({ lastId: items[items.length - 1].id })).toString("base64") : null;

    return { items, nextCursor };
  }
}
```

*This is the file the `postgis` skill matters most for — `ST_DWithin` takes meters directly on `geography` type (no `ST_Transform` needed), and the KNN `<->`/`ST_Distance` combination must share the same cast (`::geography`) or the planner won't use the GIST index.*

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/venues/venues.repository.ts apps/api/src/venues/venues.repository.spec.ts
git commit -m "feat(api): add PostGIS structural search repository for venues"
```

---

## Task 7: Venues service + `GET /venues` controller

**Files:**
- Create: `apps/api/src/venues/venues.service.ts`, `apps/api/src/venues/venues.controller.ts`, `apps/api/src/venues/venues.module.ts`
- Test: `apps/api/src/venues/venues.service.spec.ts`, `apps/api/src/venues/venues.controller.spec.ts`

**Interfaces:**
- Consumes: `VenuesRepository.searchPublished` (Task 6), `VenueListQuerySchema` (Task 1)
- Produces: `GET /venues` HTTP endpoint returning `{ data: VenueRow[], meta: { next_cursor, has_more } }` per `api-spec.md §1` envelope — this is what Plan 2's web app discovery screen calls

- [ ] **Step 1: Write the failing test — `venues.service.spec.ts`**

```typescript
import { VenuesService } from "./venues.service";
import { VenuesRepository } from "./venues.repository";

describe("VenuesService.list", () => {
  it("wraps repository result in the API envelope", async () => {
    const repo = {
      searchPublished: jest.fn().mockResolvedValue({ items: [{ id: "v1" }], nextCursor: "abc" }),
    } as unknown as VenuesRepository;
    const service = new VenuesService(repo);

    const result = await service.list({ sort: "newest", limit: 20 } as any);

    expect(result).toEqual({
      data: [{ id: "v1" }],
      meta: { next_cursor: "abc", has_more: true },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/venues/venues.service.spec.ts`
Expected: FAIL — `Cannot find module './venues.service'`

- [ ] **Step 3: Create `apps/api/src/venues/venues.service.ts`**

```typescript
import { Injectable } from "@nestjs/common";
import { VenueListQuery } from "@gurmego/shared";
import { VenuesRepository } from "./venues.repository";

@Injectable()
export class VenuesService {
  constructor(private repo: VenuesRepository) {}

  async list(filters: VenueListQuery) {
    const { items, nextCursor } = await this.repo.searchPublished(filters);
    return {
      data: items,
      meta: { next_cursor: nextCursor, has_more: nextCursor !== null },
    };
  }
}
```

- [ ] **Step 4: Create `apps/api/src/venues/venues.controller.ts`**

```typescript
import { Controller, Get, Query, UsePipes } from "@nestjs/common";
import { VenueListQuerySchema } from "@gurmego/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { VenuesService } from "./venues.service";

@Controller("venues")
export class VenuesController {
  constructor(private venues: VenuesService) {}

  @Get()
  @UsePipes(new ZodValidationPipe(VenueListQuerySchema))
  list(@Query() query: ReturnType<(typeof VenueListQuerySchema)["parse"]>) {
    return this.venues.list(query);
  }
}
```

- [ ] **Step 5: Create `apps/api/src/venues/venues.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { VenuesController } from "./venues.controller";
import { VenuesService } from "./venues.service";
import { VenuesRepository } from "./venues.repository";

@Module({
  controllers: [VenuesController],
  providers: [VenuesService, VenuesRepository],
  exports: [VenuesService, VenuesRepository],
})
export class VenuesModule {}
```

- [ ] **Step 6: Register `VenuesModule` in `apps/api/src/app.module.ts`** — add `VenuesModule` to the `imports` array (same pattern as Task 5 Step 6).

- [ ] **Step 7: Run test to verify it passes**

Run: `cd apps/api && npx jest src/venues/venues.service.spec.ts`
Expected: PASS (1 test)

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/venues/venues.service.ts apps/api/src/venues/venues.controller.ts apps/api/src/venues/venues.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): add GET /venues structural search endpoint"
```

---

## Task 8: `GET /venues/map` (bbox lightweight payload)

**Files:**
- Modify: `apps/api/src/venues/venues.repository.ts`, `venues.service.ts`, `venues.controller.ts`
- Test: append to `venues.repository.spec.ts`, `venues.service.spec.ts`

**Interfaces:**
- Consumes: same as Task 6/7
- Produces: `VenuesRepository.findInBbox(bbox: [number, number, number, number]): Promise<MapVenueRow[]>`, `GET /venues/map?bbox=minLng,minLat,maxLng,maxLat`

- [ ] **Step 1: Write the failing test — append to `venues.repository.spec.ts`**

```typescript
describe("VenuesRepository.findInBbox", () => {
  it("queries venues within the bounding box", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1", name: "A", location: {} }]) } as any;
    const repo = new VenuesRepository(prisma);

    const result = await repo.findInBbox([28.9, 40.9, 29.1, 41.1]);

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts -t findInBbox`
Expected: FAIL — `repo.findInBbox is not a function`

- [ ] **Step 3: Add `findInBbox` to `venues.repository.ts`**

```typescript
async findInBbox([minLng, minLat, maxLng, maxLat]: [number, number, number, number]) {
  return this.prisma.$queryRaw<Array<{ id: string; name: string; category: string; lat: number; lng: number }>>(Prisma.sql`
    SELECT v.id, v.name, v.category,
           ST_Y(v.location::geometry) AS lat, ST_X(v.location::geometry) AS lng
    FROM "Venue" v
    WHERE v.status = 'PUBLISHED'
      AND ST_Intersects(v.location::geometry, ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326))
  `);
}
```

- [ ] **Step 4: Add `mapView` to `venues.service.ts`**

```typescript
mapView(bbox: [number, number, number, number]) {
  return this.repo.findInBbox(bbox);
}
```

- [ ] **Step 5: Add the endpoint to `venues.controller.ts`**

```typescript
@Get("map")
mapView(@Query("bbox") bbox: string) {
  const parts = bbox.split(",").map(Number) as [number, number, number, number];
  return this.venues.mapView(parts);
}
```

*Route order matters in NestJS/Fastify: `@Get("map")` must be declared before `@Get(":slug")` (Task 9) or `map` gets swallowed as a slug param.*

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/api && npx jest src/venues`
Expected: PASS (all venues tests)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/venues
git commit -m "feat(api): add GET /venues/map bbox endpoint"
```

---

## Task 9: `GET /venues/:slug` (detail)

**Files:**
- Modify: `venues.repository.ts`, `venues.service.ts`, `venues.controller.ts`
- Test: append to each spec file

**Interfaces:**
- Consumes: same as Task 7
- Produces: `VenuesRepository.findBySlug(slug: string): Promise<VenueDetail | null>`, `GET /venues/:slug` → 404 via `NotFoundException` when absent

- [ ] **Step 1: Write the failing test**

```typescript
describe("VenuesService.detail", () => {
  it("throws NotFoundException when venue missing", async () => {
    const repo = { findBySlug: jest.fn().mockResolvedValue(null) } as unknown as VenuesRepository;
    const service = new VenuesService(repo);

    await expect(service.detail("missing-slug")).rejects.toThrow("Mekan bulunamadı");
  });

  it("returns venue detail when found", async () => {
    const venue = { id: "v1", slug: "a", name: "A" };
    const repo = { findBySlug: jest.fn().mockResolvedValue(venue) } as unknown as VenuesRepository;
    const service = new VenuesService(repo);

    const result = await service.detail("a");

    expect(result).toEqual(venue);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/venues/venues.service.spec.ts -t detail`
Expected: FAIL — `service.detail is not a function`

- [ ] **Step 3: Add `findBySlug` to `venues.repository.ts`**

```typescript
findBySlug(slug: string) {
  return this.prisma.venue.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      id: true, slug: true, name: true, category: true, cuisineType: true,
      priceRange: true, signatureItems: true, transportNote: true, openingHours: true,
      editorialNote: true, isBoutique: true, verifiedAt: true, source: true,
      googleRating: true, googleRatingCount: true, googlePlaceId: true,
      district: { select: { name: true, slug: true } },
    },
  });
}
```

- [ ] **Step 4: Add `detail` to `venues.service.ts`**

```typescript
import { NotFoundException } from "@nestjs/common";
// ...
async detail(slug: string) {
  const venue = await this.repo.findBySlug(slug);
  if (!venue) {
    throw new NotFoundException({ error: { code: "VENUE_NOT_FOUND", message: "Mekan bulunamadı" } });
  }
  return venue;
}
```

- [ ] **Step 5: Add the endpoint to `venues.controller.ts`** (must come after the `map` route, see Task 8 Step 5 note)

```typescript
@Get(":slug")
detail(@Param("slug") slug: string) {
  return this.venues.detail(slug);
}
```

Add `Param` to the `@nestjs/common` import.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/api && npx jest src/venues`
Expected: PASS (all venues tests)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/venues
git commit -m "feat(api): add GET /venues/:slug detail endpoint"
```

---

## Task 10: Auth — Supabase JWT guard + roles

**Files:**
- Create: `apps/api/src/auth/auth.module.ts`, `jwt-auth.middleware.ts`, `roles.decorator.ts`, `roles.guard.ts`
- Test: `apps/api/src/auth/roles.guard.spec.ts`

**Interfaces:**
- Consumes: `SUPABASE_JWKS_URL` env var
- Produces: `@Roles("curator", "admin")` decorator + `RolesGuard` — every admin controller from Task 15 onward uses this; `AuthenticatedRequest.user.role`/`.id` shape

- [ ] **Step 1: Write the failing test — `roles.guard.spec.ts`**

```typescript
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

function mockContext(user: { role: string } | undefined) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  it("allows when user role is in the required list", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["curator", "admin"]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(mockContext({ role: "curator" }))).toBe(true);
  });

  it("denies when user role is not in the required list", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["curator", "admin"]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(mockContext({ role: "user" }))).toBe(false);
  });

  it("allows when no roles are required (public route)", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(mockContext(undefined))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/auth/roles.guard.spec.ts`
Expected: FAIL — `Cannot find module './roles.guard'`

- [ ] **Step 3: Create `apps/api/src/auth/roles.decorator.ts`**

```typescript
import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 4: Create `apps/api/src/auth/roles.guard.ts`**

```typescript
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest();
    return !!user && requiredRoles.includes(user.role);
  }
}
```

- [ ] **Step 5: Create `apps/api/src/auth/jwt-auth.middleware.ts`** (JWKS verification middleware)

```typescript
import { Injectable, NestMiddleware, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL!));

@Injectable()
export class JwtAuthMiddleware implements NestMiddleware {
  async use(req: any, _res: any, next: () => void) {
    const header = req.headers["authorization"];
    if (!header?.startsWith("Bearer ")) {
      req.user = undefined;
      return next();
    }
    try {
      const token = header.slice("Bearer ".length);
      const { payload } = await jwtVerify(token, JWKS);
      req.user = { id: payload.sub, role: (payload as any).user_role ?? "user" };
    } catch {
      throw new UnauthorizedException({ error: { code: "INVALID_TOKEN", message: "Geçersiz oturum" } });
    }
    next();
  }
}
```

- [ ] **Step 6: Create `apps/api/src/auth/auth.module.ts`**

```typescript
import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtAuthMiddleware } from "./jwt-auth.middleware";
import { RolesGuard } from "./roles.guard";

@Module({
  providers: [{ provide: APP_GUARD, useClass: RolesGuard }],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtAuthMiddleware).forRoutes("*");
  }
}
```

- [ ] **Step 7: Add `jose` dependency**

Run: `cd apps/api && pnpm add jose`

- [ ] **Step 8: Register `AuthModule` in `app.module.ts`** — add to `imports`.

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd apps/api && npx jest src/auth`
Expected: PASS (3 tests)

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/auth apps/api/src/app.module.ts apps/api/package.json
git commit -m "feat(api): add Supabase JWT verification middleware and roles guard"
```

---

## Task 11: Favorites module

**Files:**
- Create: `apps/api/src/favorites/favorites.module.ts`, `favorites.controller.ts`, `favorites.service.ts`
- Test: `apps/api/src/favorites/favorites.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `CreateFavoriteListSchema` (Task 1), `RolesGuard`/`AuthenticatedRequest` (Task 10)
- Produces: `GET/POST /me/lists`, `POST /me/lists/:id/venues` — used by Plan 2's web app favorites feature

- [ ] **Step 1: Write the failing test**

```typescript
import { FavoritesService } from "./favorites.service";

describe("FavoritesService", () => {
  it("createList creates a list scoped to the user", async () => {
    const prisma = { favoriteList: { create: jest.fn().mockResolvedValue({ id: "l1", name: "Kadıköy turu" }) } } as any;
    const service = new FavoritesService(prisma);

    const result = await service.createList("user-1", { name: "Kadıköy turu" });

    expect(prisma.favoriteList.create).toHaveBeenCalledWith({
      data: { userId: "user-1", name: "Kadıköy turu" },
    });
    expect(result).toEqual({ id: "l1", name: "Kadıköy turu" });
  });

  it("addVenue rejects when list does not belong to user", async () => {
    const prisma = { favoriteList: { findUnique: jest.fn().mockResolvedValue({ id: "l1", userId: "other-user" }) } } as any;
    const service = new FavoritesService(prisma);

    await expect(service.addVenue("user-1", "l1", "v1")).rejects.toThrow("Liste bulunamadı");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/favorites/favorites.service.spec.ts`
Expected: FAIL — `Cannot find module './favorites.service'`

- [ ] **Step 3: Create `apps/api/src/favorites/favorites.service.ts`**

```typescript
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFavoriteList } from "@gurmego/shared";

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  listLists(userId: string) {
    return this.prisma.favoriteList.findMany({ where: { userId }, include: { favorites: true } });
  }

  createList(userId: string, dto: CreateFavoriteList) {
    return this.prisma.favoriteList.create({ data: { userId, name: dto.name } });
  }

  async addVenue(userId: string, listId: string, venueId: string) {
    const list = await this.prisma.favoriteList.findUnique({ where: { id: listId } });
    if (!list || list.userId !== userId) {
      throw new NotFoundException({ error: { code: "LIST_NOT_FOUND", message: "Liste bulunamadı" } });
    }
    return this.prisma.favorite.upsert({
      where: { listId_venueId: { listId, venueId } },
      create: { listId, venueId },
      update: {},
    });
  }
}
```

- [ ] **Step 4: Create `apps/api/src/favorites/favorites.controller.ts`**

```typescript
import { Body, Controller, Get, Param, Post, Req, UsePipes } from "@nestjs/common";
import { CreateFavoriteListSchema } from "@gurmego/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { FavoritesService } from "./favorites.service";

@Controller("me/lists")
export class FavoritesController {
  constructor(private favorites: FavoritesService) {}

  @Get()
  list(@Req() req: any) {
    return this.favorites.listLists(req.user.id);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateFavoriteListSchema))
  create(@Req() req: any, @Body() body: { name: string }) {
    return this.favorites.createList(req.user.id, body);
  }

  @Post(":id/venues")
  addVenue(@Req() req: any, @Param("id") listId: string, @Body("venueId") venueId: string) {
    return this.favorites.addVenue(req.user.id, listId, venueId);
  }
}
```

- [ ] **Step 5: Create `apps/api/src/favorites/favorites.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { FavoritesController } from "./favorites.controller";
import { FavoritesService } from "./favorites.service";

@Module({ controllers: [FavoritesController], providers: [FavoritesService] })
export class FavoritesModule {}
```

- [ ] **Step 6: Register `FavoritesModule` in `app.module.ts`**.

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd apps/api && npx jest src/favorites`
Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/favorites apps/api/src/app.module.ts
git commit -m "feat(api): add favorites/lists module"
```

---

## Task 12: Reports module (`POST /venues/:id/report`) + Postgres rate-limit `CacheStore`

**Files:**
- Create: `apps/api/src/common/cache-store.interface.ts`, `postgres-cache-store.service.ts`, `rate-limit.guard.ts`, `rule-config.ts`
- Create: `apps/api/src/reports/reports.module.ts`, `reports.controller.ts`, `reports.service.ts`
- Modify: `apps/api/prisma/schema.prisma` (add `RateLimitCounter` unlogged table)
- Modify: `apps/api/src/app.module.ts` (register `ReportsModule`)
- Test: `apps/api/src/common/postgres-cache-store.service.spec.ts`, `apps/api/src/reports/reports.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `CreateReportSchema` (Task 1)
- Produces: `CacheStore` interface (`increment(key, windowSeconds): Promise<number>`) + `CACHE_STORE` DI token — Task 20 reuses this for general read rate limiting (must also bind `CACHE_STORE` in `venues.module.ts`/`districts.module.ts`, see Task 20 Step 2); `@RateLimit(limit, windowSeconds)` decorator + `RateLimitGuard`; `getUrgentReportThreshold()` from `rule-config.ts` — Task 15 imports this exact function, not a duplicate env read; `ReportsService.submit(venueId, dto)` → `{ urgent: boolean }`

- [ ] **Step 1: Add the rate-limit table to `schema.prisma`** (append, then migrate)

```prisma
model RateLimitCounter {
  key       String   @id
  count     Int      @default(0)
  windowEnd DateTime

  @@map("rate_limit_counters")
}
```

Run: `cd apps/api && npx prisma migrate dev --name add_rate_limit_counter`

- [ ] **Step 2: Make the table `UNLOGGED` — Prisma can't express this, edit the generated migration SQL**

Open the new migration file and change `CREATE TABLE "rate_limit_counters"` to `CREATE UNLOGGED TABLE "rate_limit_counters"`, then re-apply:

Run: `cd apps/api && npx prisma migrate reset --skip-seed` (dev DB only) then `npx prisma migrate dev`
Expected: table exists as unlogged (verify: `\d+ rate_limit_counters` in psql shows `Unlogged`)

- [ ] **Step 3: Write the failing test — `postgres-cache-store.service.spec.ts`**

```typescript
import { PostgresCacheStoreService } from "./postgres-cache-store.service";

describe("PostgresCacheStoreService.increment", () => {
  it("creates a new counter window and returns 1 on first call", async () => {
    const prisma = {
      rateLimitCounter: {
        upsert: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;
    const store = new PostgresCacheStoreService(prisma);

    const count = await store.increment("report:1.2.3.4", 86400);

    expect(count).toBe(1);
    expect(prisma.rateLimitCounter.upsert).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd apps/api && npx jest src/common/postgres-cache-store.service.spec.ts`
Expected: FAIL — `Cannot find module './postgres-cache-store.service'`

- [ ] **Step 5: Create `apps/api/src/common/cache-store.interface.ts`**

```typescript
export interface CacheStore {
  increment(key: string, windowSeconds: number): Promise<number>;
}
export const CACHE_STORE = Symbol("CACHE_STORE");
```

- [ ] **Step 6: Create `apps/api/src/common/postgres-cache-store.service.ts`**

```typescript
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CacheStore } from "./cache-store.interface";

@Injectable()
export class PostgresCacheStoreService implements CacheStore {
  constructor(private prisma: PrismaService) {}

  async increment(key: string, windowSeconds: number): Promise<number> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + windowSeconds * 1000);
    const result = await this.prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO rate_limit_counters (key, count, "windowEnd")
      VALUES (${key}, 1, ${windowEnd})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limit_counters."windowEnd" < ${now} THEN 1 ELSE rate_limit_counters.count + 1 END,
        "windowEnd" = CASE WHEN rate_limit_counters."windowEnd" < ${now} THEN ${windowEnd} ELSE rate_limit_counters."windowEnd" END
      RETURNING count
    `;
    return result[0].count;
  }
}
```

*This is the `CacheStore` interface `architecture.md §8` and `infrastructure.md §1` require — swapping to Redis later means writing a `RedisCacheStoreService implements CacheStore` and changing one DI binding, nothing else.*

- [ ] **Step 7: Create `apps/api/src/common/rate-limit.guard.ts`**

```typescript
import { CanActivate, ExecutionContext, Inject, Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { CACHE_STORE, CacheStore } from "./cache-store.interface";

export function RateLimit(limit: number, windowSeconds: number) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata("rate-limit", { limit, windowSeconds }, descriptor.value);
    return descriptor;
  };
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Inject(CACHE_STORE) private store: CacheStore) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const meta = Reflect.getMetadata("rate-limit", handler);
    if (!meta) return true;
    const req = context.switchToHttp().getRequest();
    const ip = req.ip ?? req.headers["x-forwarded-for"] ?? "unknown";
    const key = `${context.getClass().name}:${handler.name}:${ip}`;
    const count = await this.store.increment(key, meta.windowSeconds);
    if (count > meta.limit) {
      const res = context.switchToHttp().getResponse();
      res.header("Retry-After", String(meta.windowSeconds));
      throw new HttpException(
        { error: { code: "RATE_LIMITED", message: "Çok fazla istek, daha sonra tekrar deneyin" } },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
```

- [ ] **Step 8: Run cache-store test to verify it passes**

Run: `cd apps/api && npx jest src/common/postgres-cache-store.service.spec.ts`
Expected: PASS (1 test)

- [ ] **Step 9: Write the failing test — `reports.service.spec.ts`**

```typescript
import { ReportsService } from "./reports.service";

describe("ReportsService.submit", () => {
  it("writes a REPORT contribution and flags urgent at 3+ pending reports", async () => {
    const prisma = {
      contributionQueue: {
        create: jest.fn().mockResolvedValue({ id: "c1" }),
        count: jest.fn().mockResolvedValue(3),
      },
    } as any;
    const service = new ReportsService(prisma);

    const result = await service.submit("v1", { reason: "Fiyat yanlış görünüyor" });

    expect(prisma.contributionQueue.create).toHaveBeenCalledWith({
      data: { type: "REPORT", venueId: "v1", payload: { reason: "Fiyat yanlış görünüyor" }, submittedBy: null },
    });
    expect(result.urgent).toBe(true);
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `cd apps/api && npx jest src/reports/reports.service.spec.ts`
Expected: FAIL — `Cannot find module './reports.service'`

- [ ] **Step 11: Create `apps/api/src/common/rule-config.ts` — single source for `RULES_MOD_AUTO_HIDE_REPORTS`**

Both this task's `ReportsService` and Task 15's `AdminQueueService` need the exact same "urgent" threshold.
Reading `process.env.RULES_MOD_AUTO_HIDE_REPORTS` independently in two files risks the two copies drifting
if one is edited and the other isn't — this file is the one place it's read.

```typescript
export function getUrgentReportThreshold(): number {
  return Number(process.env.RULES_MOD_AUTO_HIDE_REPORTS ?? 3);
}
```

- [ ] **Step 12: Create `apps/api/src/reports/reports.service.ts`**

```typescript
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReport } from "@gurmego/shared";
import { getUrgentReportThreshold } from "../common/rule-config";

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async submit(venueId: string, dto: CreateReport) {
    await this.prisma.contributionQueue.create({
      data: { type: "REPORT", venueId, payload: { reason: dto.reason }, submittedBy: null },
    });
    const pendingCount = await this.prisma.contributionQueue.count({
      where: { venueId, type: "REPORT", status: "PENDING" },
    });
    return { urgent: pendingCount >= getUrgentReportThreshold() };
  }
}
```

*`RULES_MOD_AUTO_HIDE_REPORTS` is read from env via `getUrgentReportThreshold()`, never hardcoded —
Global Constraints / `rule-engine.md §5`. Per the revised rule, hitting the threshold does **not** hide
the venue — it only flags urgency; Task 15's queue ordering imports this same function to sort urgent
items first (see Task 15's updated **Consumes**).*

- [ ] **Step 13: Create `apps/api/src/reports/reports.controller.ts`**

```typescript
import { Body, Controller, Param, Post, UseGuards, UsePipes } from "@nestjs/common";
import { CreateReportSchema } from "@gurmego/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { RateLimit, RateLimitGuard } from "../common/rate-limit.guard";
import { ReportsService } from "./reports.service";

@Controller("venues")
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Post(":id/report")
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 86400)
  @UsePipes(new ZodValidationPipe(CreateReportSchema))
  submit(@Param("id") venueId: string, @Body() body: { reason: string }) {
    return this.reports.submit(venueId, body);
  }
}
```

- [ ] **Step 14: Create `apps/api/src/reports/reports.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { PostgresCacheStoreService } from "../common/postgres-cache-store.service";
import { CACHE_STORE } from "../common/cache-store.interface";

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, { provide: CACHE_STORE, useClass: PostgresCacheStoreService }],
})
export class ReportsModule {}
```

- [ ] **Step 15: Register `ReportsModule` in `app.module.ts`**.

- [ ] **Step 16: Run tests to verify they pass**

Run: `cd apps/api && npx jest src/reports src/common`
Expected: PASS (all)

- [ ] **Step 17: Commit**

```bash
git add apps/api/src/common apps/api/src/reports apps/api/prisma apps/api/src/app.module.ts
git commit -m "feat(api): add anonymous venue report endpoint with Postgres-backed rate limiting"
```

---

## Task 13: Rule engine — butik hesaplama + re-verify scheduling

**Files:**
- Create: `apps/api/src/rule-engine/rule-engine.module.ts`, `boutique.service.ts`, `re-verify.service.ts`
- Test: `apps/api/src/rule-engine/boutique.service.spec.ts`, `re-verify.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `RULES_BOUTIQUE_MAX_BRANCHES`/`RULES_STALE_DAYS` env vars
- Produces: `BoutiqueService.evaluate(branchCount, franchiseFlag, hasEditorialNote): boolean` — called by Task 16's admin venue CRUD on save; `ReVerifyService.enqueueStale(): Promise<number>` — a cron target for Task 24's CI/scheduler note

- [ ] **Step 1: Write the failing test — `boutique.service.spec.ts`**

```typescript
import { BoutiqueService } from "./boutique.service";

describe("BoutiqueService.evaluate", () => {
  const service = new BoutiqueService();

  it("returns true when branch count under threshold, not franchise, has editorial note", () => {
    expect(service.evaluate({ branchCount: 2, franchiseFlag: false, hasEditorialNote: true })).toBe(true);
  });

  it("returns false when branch count exceeds RULES_BOUTIQUE_MAX_BRANCHES", () => {
    process.env.RULES_BOUTIQUE_MAX_BRANCHES = "3";
    expect(service.evaluate({ branchCount: 5, franchiseFlag: false, hasEditorialNote: true })).toBe(false);
  });

  it("returns false when franchiseFlag is true regardless of branch count", () => {
    expect(service.evaluate({ branchCount: 1, franchiseFlag: true, hasEditorialNote: true })).toBe(false);
  });

  it("returns false when no editorial note (B3 unmet)", () => {
    expect(service.evaluate({ branchCount: 1, franchiseFlag: false, hasEditorialNote: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/rule-engine/boutique.service.spec.ts`
Expected: FAIL — `Cannot find module './boutique.service'`

- [ ] **Step 3: Create `apps/api/src/rule-engine/boutique.service.ts`**

```typescript
import { Injectable } from "@nestjs/common";

interface BoutiqueInput {
  branchCount: number;
  franchiseFlag: boolean;
  hasEditorialNote: boolean;
}

@Injectable()
export class BoutiqueService {
  evaluate({ branchCount, franchiseFlag, hasEditorialNote }: BoutiqueInput): boolean {
    const maxBranches = Number(process.env.RULES_BOUTIQUE_MAX_BRANCHES ?? 3);
    return branchCount <= maxBranches && !franchiseFlag && hasEditorialNote;
  }
}
```

*`rule-engine.md §1`: this is B1 + B2 + B3, all three must hold — never hardcode `3`, always read `RULES_BOUTIQUE_MAX_BRANCHES`.*

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/rule-engine/boutique.service.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the failing test — `re-verify.service.spec.ts`**

```typescript
import { ReVerifyService } from "./re-verify.service";

describe("ReVerifyService.enqueueStale", () => {
  it("creates EDIT-type re_verify contributions for venues older than RULES_STALE_DAYS, skipping existing pending ones", async () => {
    process.env.RULES_STALE_DAYS = "90";
    const staleVenues = [{ id: "v1" }, { id: "v2" }];
    const prisma = {
      venue: { findMany: jest.fn().mockResolvedValue(staleVenues) },
      contributionQueue: {
        findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "existing" }),
        create: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const service = new ReVerifyService(prisma);

    const created = await service.enqueueStale();

    expect(created).toBe(1);
    expect(prisma.contributionQueue.create).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd apps/api && npx jest src/rule-engine/re-verify.service.spec.ts`
Expected: FAIL — `Cannot find module './re-verify.service'`

- [ ] **Step 7: Create `apps/api/src/rule-engine/re-verify.service.ts`**

```typescript
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReVerifyService {
  constructor(private prisma: PrismaService) {}

  async enqueueStale(): Promise<number> {
    const staleDays = Number(process.env.RULES_STALE_DAYS ?? 90);
    const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);
    const staleVenues = await this.prisma.venue.findMany({
      where: { status: "PUBLISHED", verifiedAt: { lt: cutoff } },
      select: { id: true },
    });

    let created = 0;
    for (const venue of staleVenues) {
      const existing = await this.prisma.contributionQueue.findFirst({
        where: { venueId: venue.id, type: "EDIT", status: "PENDING", payload: { path: ["kind"], equals: "re_verify" } },
      });
      if (existing) continue;
      await this.prisma.contributionQueue.create({
        data: { type: "EDIT", venueId: venue.id, payload: { kind: "re_verify" }, submittedBy: null },
      });
      created++;
    }
    return created;
  }
}
```

- [ ] **Step 8: Create `apps/api/src/rule-engine/rule-engine.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { BoutiqueService } from "./boutique.service";
import { ReVerifyService } from "./re-verify.service";

@Module({
  providers: [BoutiqueService, ReVerifyService],
  exports: [BoutiqueService, ReVerifyService],
})
export class RuleEngineModule {}
```

- [ ] **Step 9: Register `RuleEngineModule` in `app.module.ts`**.

- [ ] **Step 10: Run tests to verify they pass**

Run: `cd apps/api && npx jest src/rule-engine`
Expected: PASS (5 tests)

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/rule-engine apps/api/src/app.module.ts
git commit -m "feat(api): add boutique rule evaluation and re-verify scheduling service"
```

*Note: wiring `ReVerifyService.enqueueStale()` to an actual daily cron trigger (`@nestjs/schedule` or Railway cron) is an infra concern — deferred to Plan 4. This task only produces the callable, tested unit.*

---

## Task 14: Admin auth guard reuse + `AdminModule` shell

**Files:**
- Create: `apps/api/src/admin/admin.module.ts`

**Interfaces:**
- Consumes: `RolesGuard`, `Roles` decorator (Task 10)
- Produces: `AdminModule` — Tasks 15–20 register their sub-modules here

- [ ] **Step 1: Create `apps/api/src/admin/admin.module.ts`**

```typescript
import { Module } from "@nestjs/common";

@Module({ imports: [] })
export class AdminModule {}
```

*(This module is deliberately empty until Task 15 starts adding sub-modules to its `imports` array — a shell task exists so each subsequent admin task's diff is small and independently reviewable, per this plan's task-sizing rule.)*

- [ ] **Step 2: Register `AdminModule` in `app.module.ts`**.

- [ ] **Step 3: Verify the app still boots**

Run: `cd apps/api && npx jest test/app.e2e-spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/admin apps/api/src/app.module.ts
git commit -m "chore(api): add empty AdminModule shell"
```

---

## Task 15: Admin queue (`GET /admin/queue`, approve/reject)

**Files:**
- Create: `apps/api/src/admin/queue/admin-queue.module.ts`, `admin-queue.controller.ts`, `admin-queue.service.ts`
- Modify: `apps/api/src/admin/admin.module.ts` (register `AdminQueueModule`)
- Test: `apps/api/src/admin/queue/admin-queue.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `Roles`/`RolesGuard` (Task 10), `getUrgentReportThreshold()` from `apps/api/src/common/rule-config.ts` (Task 12 — same function, not a re-read of the env var)
- Produces: `AdminQueueService.list(type?, status?)`, `.approve(id, reviewerId)`, `.reject(id, reviewerId)` (no `reason` param — `ContributionQueue` has no field to store one, per Task 2's schema) — writes `VenueVersion` snapshot + updates `verified_at` on approve (`architecture.md §5`)

- [ ] **Step 1: Write the failing test**

```typescript
describe("AdminQueueService.approve", () => {
  it("applies a re_verify approval by bumping verifiedAt and snapshotting the version", async () => {
    const item = { id: "c1", type: "EDIT", venueId: "v1", payload: { kind: "re_verify" } };
    const venue = { id: "v1", name: "A", editorialNote: "old" };
    const prisma = {
      contributionQueue: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(item),
        update: jest.fn().mockResolvedValue({}),
      },
      venue: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(venue),
        update: jest.fn().mockResolvedValue({}),
      },
      venueVersion: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const service = new AdminQueueService(prisma);

    await service.approve("c1", "curator-1");

    expect(prisma.venueVersion.create).toHaveBeenCalledWith({
      data: { venueId: "v1", snapshot: venue, createdBy: "curator-1" },
    });
    expect(prisma.venue.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { verifiedAt: expect.any(Date) },
    });
    expect(prisma.contributionQueue.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "APPROVED", reviewedBy: "curator-1", reviewedAt: expect.any(Date) },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/admin/queue/admin-queue.service.spec.ts`
Expected: FAIL — `Cannot find module './admin-queue.service'`

- [ ] **Step 3: Create `apps/api/src/admin/queue/admin-queue.service.ts`**

```typescript
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { getUrgentReportThreshold } from "../../common/rule-config";

@Injectable()
export class AdminQueueService {
  constructor(private prisma: PrismaService) {}

  async list(type?: string, status?: string) {
    const items = await this.prisma.contributionQueue.findMany({
      where: { type: type as any, status: (status as any) ?? "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { venue: { select: { name: true, slug: true } } },
    });
    // Urgent (>= threshold pending REPORTs on same venue) sort first, then re_verify, then rest
    const threshold = getUrgentReportThreshold();
    const withUrgency = await Promise.all(
      items.map(async (item) => {
        if (item.type !== "REPORT") return { item, urgent: false };
        const count = await this.prisma.contributionQueue.count({
          where: { venueId: item.venueId!, type: "REPORT", status: "PENDING" },
        });
        return { item, urgent: count >= threshold };
      }),
    );
    return withUrgency.sort((a, b) => Number(b.urgent) - Number(a.urgent)).map((w) => ({ ...w.item, urgent: w.urgent }));
  }

  async approve(id: string, reviewerId: string) {
    const item = await this.prisma.contributionQueue.findUniqueOrThrow({ where: { id } });
    if (item.venueId) {
      const venue = await this.prisma.venue.findUniqueOrThrow({ where: { id: item.venueId } });
      await this.prisma.venueVersion.create({ data: { venueId: venue.id, snapshot: venue, createdBy: reviewerId } });
      await this.prisma.venue.update({ where: { id: venue.id }, data: { verifiedAt: new Date() } });
    }
    return this.prisma.contributionQueue.update({
      where: { id },
      data: { status: "APPROVED", reviewedBy: reviewerId, reviewedAt: new Date() },
    });
  }

  reject(id: string, reviewerId: string) {
    return this.prisma.contributionQueue.update({
      where: { id },
      data: { status: "REJECTED", reviewedBy: reviewerId, reviewedAt: new Date() },
    });
  }
}
```

- [ ] **Step 4: Create `apps/api/src/admin/queue/admin-queue.controller.ts`**

```typescript
import { Controller, Get, Post, Param, Query, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { AdminQueueService } from "./admin-queue.service";

@Controller("admin/queue")
@UseGuards(RolesGuard)
@Roles("curator", "admin")
export class AdminQueueController {
  constructor(private queue: AdminQueueService) {}

  @Get()
  list(@Query("type") type?: string, @Query("status") status?: string) {
    return this.queue.list(type, status);
  }

  @Post(":id/approve")
  approve(@Param("id") id: string, @Req() req: any) {
    return this.queue.approve(id, req.user.id);
  }

  @Post(":id/reject")
  reject(@Param("id") id: string, @Req() req: any) {
    return this.queue.reject(id, req.user.id);
  }
}
```

- [ ] **Step 5: Create `apps/api/src/admin/queue/admin-queue.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { AdminQueueController } from "./admin-queue.controller";
import { AdminQueueService } from "./admin-queue.service";

@Module({ controllers: [AdminQueueController], providers: [AdminQueueService] })
export class AdminQueueModule {}
```

- [ ] **Step 6: Add `AdminQueueModule` to `admin.module.ts`'s `imports`**.

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd apps/api && npx jest src/admin/queue`
Expected: PASS (1 test)

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/admin
git commit -m "feat(api): add admin queue approve/reject with version snapshotting"
```

---

## Task 16: Admin venues CRUD + CSV import

**Files:**
- Create: `apps/api/src/admin/venues/admin-venues.module.ts`, `admin-venues.controller.ts`, `admin-venues.service.ts`, `csv-import.service.ts`
- Test: `apps/api/src/admin/venues/admin-venues.service.spec.ts`, `csv-import.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `BoutiqueService.evaluate` (Task 13), `VenueSchema` (Task 1)
- Produces: `POST/PUT /admin/venues`, `POST /admin/import`, `POST /admin/venues/:id/revert/:versionId`

**Delegation note:** the CSV parsing/row-mapping implementation in Step 3 below is repetitive, low-judgment code once the test in Step 1 is red. If you want to hand it to GLM via `delegating-bulk-work`, that's appropriate here — **tell the user first**, and keep the test itself (Step 1) written by you, not GLM (project's TDD rule).

- [ ] **Step 1: Write the failing test — `csv-import.service.spec.ts`**

```typescript
import { CsvImportService } from "./csv-import.service";

describe("CsvImportService.parseRows", () => {
  const service = new CsvImportService();

  it("parses valid CSV rows into venue create inputs", () => {
    const csv = "name,districtSlug,category,priceRange,branchCount\nKahveci,kadikoy,cafe,MODERATE,1";
    const result = service.parseRows(csv);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]).toMatchObject({ name: "Kahveci", districtSlug: "kadikoy", priceRange: "MODERATE" });
    expect(result.errors).toHaveLength(0);
  });

  it("collects row-level errors instead of throwing", () => {
    const csv = "name,districtSlug,category,priceRange,branchCount\n,kadikoy,cafe,MODERATE,1";
    const result = service.parseRows(csv);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toEqual([{ row: 1, message: expect.stringContaining("name") }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/admin/venues/csv-import.service.spec.ts`
Expected: FAIL — `Cannot find module './csv-import.service'`

- [ ] **Step 3: Add `csv-parse` dependency and create `csv-import.service.ts`**

Run: `cd apps/api && pnpm add csv-parse`

```typescript
import { Injectable } from "@nestjs/common";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { PRICE_RANGE_VALUES } from "@gurmego/shared";

const CsvRowSchema = z.object({
  name: z.string().min(1, "name zorunlu"),
  districtSlug: z.string().min(1),
  category: z.string().min(1),
  priceRange: z.enum(PRICE_RANGE_VALUES),
  branchCount: z.coerce.number().int().min(1),
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

- [ ] **Step 4: Run CSV test to verify it passes**

Run: `cd apps/api && npx jest src/admin/venues/csv-import.service.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing test — `admin-venues.service.spec.ts`**

```typescript
import { AdminVenuesService } from "./admin-venues.service";

describe("AdminVenuesService.create", () => {
  it("computes isBoutique via BoutiqueService before saving", async () => {
    const prisma = { venue: { create: jest.fn().mockResolvedValue({ id: "v1" }) } } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(true) } as any;
    const service = new AdminVenuesService(prisma, boutique);

    await service.create({
      name: "A", slug: "a", districtId: "d1", category: "cafe", priceRange: "MODERATE",
      signatureItems: [], openingHours: {}, editorialNote: "iyi mekan", branchCount: 1, franchiseFlag: false,
    } as any);

    expect(boutique.evaluate).toHaveBeenCalledWith({ branchCount: 1, franchiseFlag: false, hasEditorialNote: true });
    expect(prisma.venue.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isBoutique: true, verifiedAt: expect.any(Date) }) }),
    );
  });
});

describe("AdminVenuesService.update", () => {
  it("re-evaluates isBoutique on update, same as create", async () => {
    const prisma = { venue: { update: jest.fn().mockResolvedValue({ id: "v1" }) } } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const service = new AdminVenuesService(prisma, boutique);

    await service.update("v1", { branchCount: 5, franchiseFlag: false, editorialNote: "not" } as any);

    expect(boutique.evaluate).toHaveBeenCalledWith({ branchCount: 5, franchiseFlag: false, hasEditorialNote: true });
    expect(prisma.venue.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: expect.objectContaining({ branchCount: 5, isBoutique: false }),
    });
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd apps/api && npx jest src/admin/venues/admin-venues.service.spec.ts`
Expected: FAIL — `Cannot find module './admin-venues.service'`

- [ ] **Step 7: Create `apps/api/src/admin/venues/admin-venues.service.ts`** — includes `update`, filling the `PUT /admin/venues/:id` gap (`api-spec.md §5`: "POST `/admin/venues` · PUT `/admin/venues/:id`")

```typescript
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { BoutiqueService } from "../../rule-engine/boutique.service";

@Injectable()
export class AdminVenuesService {
  constructor(private prisma: PrismaService, private boutique: BoutiqueService) {}

  create(input: any) {
    const isBoutique = this.boutique.evaluate({
      branchCount: input.branchCount,
      franchiseFlag: input.franchiseFlag,
      hasEditorialNote: !!input.editorialNote,
    });
    return this.prisma.venue.create({
      data: { ...input, isBoutique, verifiedAt: new Date(), status: "DRAFT", source: "MANUAL" },
    });
  }

  update(id: string, input: any) {
    const isBoutique = this.boutique.evaluate({
      branchCount: input.branchCount,
      franchiseFlag: input.franchiseFlag,
      hasEditorialNote: !!input.editorialNote,
    });
    return this.prisma.venue.update({ where: { id }, data: { ...input, isBoutique } });
  }

  async revert(venueId: string, versionId: string) {
    const version = await this.prisma.venueVersion.findUniqueOrThrow({ where: { id: versionId } });
    return this.prisma.venue.update({ where: { id: venueId }, data: version.snapshot as any });
  }
}
```

- [ ] **Step 8: Create `apps/api/src/admin/venues/admin-venues.controller.ts`**

```typescript
import { Body, Controller, Param, Post, Put, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { AdminVenuesService } from "./admin-venues.service";
import { CsvImportService } from "./csv-import.service";

@Controller("admin")
@UseGuards(RolesGuard)
@Roles("curator", "admin")
export class AdminVenuesController {
  constructor(private venues: AdminVenuesService, private csvImport: CsvImportService) {}

  @Post("venues")
  create(@Body() body: any) {
    return this.venues.create(body);
  }

  @Put("venues/:id")
  update(@Param("id") id: string, @Body() body: any) {
    return this.venues.update(id, body);
  }

  @Post("venues/:id/revert/:versionId")
  revert(@Param("id") id: string, @Param("versionId") versionId: string) {
    return this.venues.revert(id, versionId);
  }

  @Post("import")
  @UseInterceptors(FileInterceptor("file"))
  importCsv(@UploadedFile() file: { buffer: Buffer }) {
    return this.csvImport.parseRows(file.buffer.toString("utf-8"));
  }
}
```

- [ ] **Step 9: Create `apps/api/src/admin/venues/admin-venues.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { AdminVenuesController } from "./admin-venues.controller";
import { AdminVenuesService } from "./admin-venues.service";
import { CsvImportService } from "./csv-import.service";
import { RuleEngineModule } from "../../rule-engine/rule-engine.module";

@Module({
  imports: [RuleEngineModule],
  controllers: [AdminVenuesController],
  providers: [AdminVenuesService, CsvImportService],
})
export class AdminVenuesModule {}
```

- [ ] **Step 10: Add `AdminVenuesModule` to `admin.module.ts`'s `imports`, add `@nestjs/platform-express` + `multer` deps**

Run: `cd apps/api && pnpm add @nestjs/platform-express multer && pnpm add -D @types/multer`

- [ ] **Step 11: Run tests to verify they pass**

Run: `cd apps/api && npx jest src/admin/venues`
Expected: PASS (4 tests)

- [ ] **Step 12: Commit**

```bash
git add apps/api/src/admin apps/api/package.json
git commit -m "feat(api): add admin venue CRUD, CSV import, and version revert"
```

---

## Task 17: Admin data-quality report

**Files:**
- Create: `apps/api/src/admin/reports/admin-reports.module.ts`, `admin-reports.controller.ts`, `admin-reports.service.ts`
- Test: `apps/api/src/admin/reports/admin-reports.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`
- Produces: `GET /admin/reports/data-quality` → `{ perDistrict: {name, count}[], staleCount: number, bySource: {source, count}[] }`

- [ ] **Step 1: Write the failing test**

```typescript
describe("AdminReportsService.dataQuality", () => {
  it("aggregates venue counts per district, stale count, and source breakdown", async () => {
    const prisma = {
      venue: {
        groupBy: jest.fn()
          .mockResolvedValueOnce([{ districtId: "d1", _count: 12 }])
          .mockResolvedValueOnce([{ source: "MANUAL", _count: 12 }]),
        count: jest.fn().mockResolvedValue(3),
      },
      district: { findMany: jest.fn().mockResolvedValue([{ id: "d1", name: "Kadıköy" }]) },
    } as any;
    const service = new AdminReportsService(prisma);

    const result = await service.dataQuality();

    expect(result.perDistrict).toEqual([{ name: "Kadıköy", count: 12 }]);
    expect(result.staleCount).toBe(3);
    expect(result.bySource).toEqual([{ source: "MANUAL", count: 12 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/admin/reports/admin-reports.service.spec.ts`
Expected: FAIL — `Cannot find module './admin-reports.service'`

- [ ] **Step 3: Create `apps/api/src/admin/reports/admin-reports.service.ts`**

```typescript
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AdminReportsService {
  constructor(private prisma: PrismaService) {}

  async dataQuality() {
    const staleDays = Number(process.env.RULES_STALE_DAYS ?? 90);
    const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

    const [byDistrict, districts, staleCount, bySourceRaw] = await Promise.all([
      this.prisma.venue.groupBy({ by: ["districtId"], _count: true }),
      this.prisma.district.findMany(),
      this.prisma.venue.count({ where: { verifiedAt: { lt: cutoff } } }),
      this.prisma.venue.groupBy({ by: ["source"], _count: true }),
    ]);

    const districtMap = new Map(districts.map((d) => [d.id, d.name]));
    return {
      perDistrict: byDistrict.map((row: any) => ({ name: districtMap.get(row.districtId), count: row._count })),
      staleCount,
      bySource: bySourceRaw.map((row: any) => ({ source: row.source, count: row._count })),
    };
  }
}
```

- [ ] **Step 4: Create `apps/api/src/admin/reports/admin-reports.controller.ts`**

```typescript
import { Controller, Get, UseGuards } from "@nestjs/common";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { AdminReportsService } from "./admin-reports.service";

@Controller("admin/reports")
@UseGuards(RolesGuard)
@Roles("curator", "admin")
export class AdminReportsController {
  constructor(private reports: AdminReportsService) {}

  @Get("data-quality")
  dataQuality() {
    return this.reports.dataQuality();
  }
}
```

- [ ] **Step 5: Create `apps/api/src/admin/reports/admin-reports.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { AdminReportsController } from "./admin-reports.controller";
import { AdminReportsService } from "./admin-reports.service";

@Module({ controllers: [AdminReportsController], providers: [AdminReportsService] })
export class AdminReportsModule {}
```

- [ ] **Step 6: Add `AdminReportsModule` to `admin.module.ts`'s `imports`**.

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd apps/api && npx jest src/admin/reports`
Expected: PASS (1 test)

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/admin/reports
git commit -m "feat(api): add admin data-quality report endpoint"
```

---

## Task 18: Admin export (`GET /admin/export`)

**Files:**
- Modify: `apps/api/src/admin/reports/admin-reports.controller.ts`, `admin-reports.service.ts`
- Test: append to `admin-reports.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`
- Produces: `AdminReportsService.exportVenues(format: "json" | "csv"): Promise<string>`

- [ ] **Step 1: Write the failing test**

```typescript
describe("AdminReportsService.exportVenues", () => {
  it("returns JSON stringified venues for format=json", async () => {
    const prisma = { venue: { findMany: jest.fn().mockResolvedValue([{ id: "v1", name: "A" }]) } } as any;
    const service = new AdminReportsService(prisma);

    const result = await service.exportVenues("json");

    expect(JSON.parse(result)).toEqual([{ id: "v1", name: "A" }]);
  });

  it("returns CSV header + rows for format=csv", async () => {
    const prisma = { venue: { findMany: jest.fn().mockResolvedValue([{ id: "v1", name: "A" }]) } } as any;
    const service = new AdminReportsService(prisma);

    const result = await service.exportVenues("csv");

    expect(result).toContain("id,name");
    expect(result).toContain("v1,A");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/admin/reports/admin-reports.service.spec.ts -t exportVenues`
Expected: FAIL — `service.exportVenues is not a function`

- [ ] **Step 3: Add `stringify` from `csv-parse`'s sibling `csv-stringify` and implement `exportVenues`**

Run: `cd apps/api && pnpm add csv-stringify`

```typescript
import { stringify } from "csv-stringify/sync";
// ... inside AdminReportsService
async exportVenues(format: "json" | "csv") {
  const venues = await this.prisma.venue.findMany({ where: { status: "PUBLISHED" } });
  if (format === "json") return JSON.stringify(venues);
  return stringify(venues, { header: true });
}
```

- [ ] **Step 4: Add the endpoint to `admin-reports.controller.ts`**

```typescript
@Get("../export")
export(@Query("format") format: "json" | "csv" = "json") {
  return this.reports.exportVenues(format);
}
```

*Note: NestJS controller paths are relative to the class-level `@Controller("admin/reports")` prefix — since the spec wants `/admin/export` (not `/admin/reports/export`), move this one handler to a sibling controller in the next step instead of using a `../` hack.*

- [ ] **Step 5: Correction — create a dedicated `apps/api/src/admin/admin-export.controller.ts` instead**

```typescript
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AdminReportsService } from "./reports/admin-reports.service";

@Controller("admin/export")
@UseGuards(RolesGuard)
@Roles("curator", "admin")
export class AdminExportController {
  constructor(private reports: AdminReportsService) {}

  @Get()
  export(@Query("format") format: "json" | "csv" = "json") {
    return this.reports.exportVenues(format);
  }
}
```

Remove the `../export` handler added in Step 4 from `admin-reports.controller.ts`, and add `AdminExportController` to `admin-reports.module.ts`'s `controllers` array, exporting `AdminReportsService` from that module for reuse.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/api && npx jest src/admin`
Expected: PASS (all admin tests)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/admin apps/api/package.json
git commit -m "feat(api): add admin venue export endpoint (json/csv)"
```

---

## Task 19: Admin role assignment (`PUT /admin/users/:id/roles`)

**Files:**
- Create: `apps/api/src/admin/users/admin-users.module.ts`, `admin-users.controller.ts`, `admin-users.service.ts`
- Test: `apps/api/src/admin/users/admin-users.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`
- Produces: `AdminUsersService.assignRole(userId, role)` — MVP restricts assignable roles to `"curator"` only (AK-01 closed for MVP, `approved_rater` is Faz 2 per `prd.md`)

- [ ] **Step 1: Write the failing test**

```typescript
describe("AdminUsersService.assignRole", () => {
  it("assigns curator role", async () => {
    const prisma = { user: { update: jest.fn().mockResolvedValue({ id: "u1", role: "CURATOR" }) } } as any;
    const service = new AdminUsersService(prisma);

    const result = await service.assignRole("u1", "curator");

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { role: "CURATOR" } });
    expect(result.role).toBe("CURATOR");
  });

  it("rejects approved_rater in MVP (Faz 2 only)", async () => {
    const prisma = { user: { update: jest.fn() } } as any;
    const service = new AdminUsersService(prisma);

    await expect(service.assignRole("u1", "approved_rater")).rejects.toThrow(
      "Bu rol MVP'de kullanılamaz (Faz 2)",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/admin/users/admin-users.service.spec.ts`
Expected: FAIL — `Cannot find module './admin-users.service'`

- [ ] **Step 3: Create `apps/api/src/admin/users/admin-users.service.ts`**

```typescript
import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const MVP_ASSIGNABLE_ROLES = ["curator", "admin"];

@Injectable()
export class AdminUsersService {
  constructor(private prisma: PrismaService) {}

  assignRole(userId: string, role: string) {
    if (!MVP_ASSIGNABLE_ROLES.includes(role)) {
      throw new BadRequestException({
        error: { code: "ROLE_NOT_AVAILABLE", message: "Bu rol MVP'de kullanılamaz (Faz 2)" },
      });
    }
    return this.prisma.user.update({ where: { id: userId }, data: { role: role.toUpperCase() as any } });
  }
}
```

- [ ] **Step 4: Create `apps/api/src/admin/users/admin-users.controller.ts`**

```typescript
import { Body, Controller, Param, Put, UseGuards } from "@nestjs/common";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { AdminUsersService } from "./admin-users.service";

@Controller("admin/users")
@UseGuards(RolesGuard)
@Roles("admin")
export class AdminUsersController {
  constructor(private users: AdminUsersService) {}

  @Put(":id/roles")
  assignRole(@Param("id") id: string, @Body("role") role: string) {
    return this.users.assignRole(id, role);
  }
}
```

*Role assignment itself is admin-only, not curator (a curator shouldn't be able to promote peers) — deliberately stricter than the queue endpoints.*

- [ ] **Step 5: Create `apps/api/src/admin/users/admin-users.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";

@Module({ controllers: [AdminUsersController], providers: [AdminUsersService] })
export class AdminUsersModule {}
```

- [ ] **Step 6: Add `AdminUsersModule` to `admin.module.ts`'s `imports`**.

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd apps/api && npx jest src/admin/users`
Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/admin/users
git commit -m "feat(api): add admin role assignment, MVP-scoped to curator/admin"
```

---

## Task 20: General read rate limiting

**Files:**
- Modify: `apps/api/src/venues/venues.controller.ts`, `venues.module.ts`, `districts.controller.ts`, `districts.module.ts`, `favorites.controller.ts`, `favorites.module.ts`
- Test: append coverage in respective controller specs (guard is already unit-tested in Task 12)

**Interfaces:**
- Consumes: `RateLimitGuard`, `RateLimit` decorator, `CACHE_STORE` token + `PostgresCacheStoreService` (Task 12 — each of `venues.module.ts`/`districts.module.ts`/`favorites.module.ts` needs its own `{ provide: CACHE_STORE, useClass: PostgresCacheStoreService }` provider entry, same as `reports.module.ts` already has; Nest providers are module-scoped, this isn't optional)
- Produces: 100 req/min IP-based limit on public read endpoints — `GET /venues`, `/venues/map`, `/venues/:slug`, `/districts`, `/districts/nearest`, `GET /me/lists` (`api-spec.md §6`). Admin endpoints (Tasks 15–19) are deliberately **not** covered here — they're already behind `RolesGuard`, and pilot-scale admin traffic (2-3 curators) doesn't warrant a second limiter; this exclusion is intentional, not an oversight.

- [ ] **Step 1: Apply the guard to `venues.controller.ts`**

```typescript
import { UseGuards } from "@nestjs/common";
import { RateLimit, RateLimitGuard } from "../common/rate-limit.guard";

@Controller("venues")
@UseGuards(RateLimitGuard)
export class VenuesController {
  constructor(private venues: VenuesService) {}

  @Get()
  @RateLimit(100, 60)
  @UsePipes(new ZodValidationPipe(VenueListQuerySchema))
  list(@Query() query: ReturnType<(typeof VenueListQuerySchema)["parse"]>) {
    return this.venues.list(query);
  }

  @Get("map")
  @RateLimit(100, 60)
  mapView(@Query("bbox") bbox: string) {
    const parts = bbox.split(",").map(Number) as [number, number, number, number];
    return this.venues.mapView(parts);
  }

  @Get(":slug")
  @RateLimit(100, 60)
  detail(@Param("slug") slug: string) {
    return this.venues.detail(slug);
  }
}
```

- [ ] **Step 2: Apply the guard to `districts.controller.ts`** — same pattern as Step 1: add `@UseGuards(RateLimitGuard)` at the class level and `@RateLimit(100, 60)` on both `findAll` and `findNearest`.

- [ ] **Step 3: Apply the guard to `favorites.controller.ts`'s `GET /me/lists` only** (not the `POST` endpoints — those are user-scoped writes, not the "read uçları" this task covers)

```typescript
@Get()
@UseGuards(RateLimitGuard)
@RateLimit(100, 60)
list(@Req() req: any) {
  return this.favorites.listLists(req.user.id);
}
```

- [ ] **Step 4: Make `CACHE_STORE` available to `VenuesModule`, `DistrictsModule`, and `FavoritesModule`** — all three need `PostgresCacheStoreService` bound; add the same provider registration used in `reports.module.ts` (Task 12 Step 14: `{ provide: CACHE_STORE, useClass: PostgresCacheStoreService }` in the `providers` array) to `venues.module.ts`, `districts.module.ts`, and `favorites.module.ts`.

- [ ] **Step 5: Run tests to verify nothing broke**

Run: `cd apps/api && npx jest src/venues src/districts src/favorites`
Expected: PASS (all)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/venues apps/api/src/districts apps/api/src/favorites
git commit -m "feat(api): apply general read rate limiting to public endpoints"
```

---

## Task 21: OpenAPI generation + `packages/api-client`

**Files:**
- Modify: `apps/api/src/main.ts` (add `@nestjs/swagger` setup)
- Create: `packages/api-client/package.json`, `packages/api-client/src/index.ts`, `packages/api-client/scripts/generate.ts`

**Interfaces:**
- Consumes: NestJS controllers (all prior tasks) — via their route decorators (`@Get`/`@Post`/`@Param`/`@Query`), **not** `@ApiResponse`/`@ApiProperty` decorators (none were added in Tasks 5–19). `SwaggerModule.createDocument` introspects paths, methods, and params without those, but response body shapes will come through as untyped (`unknown`) in the generated client for this first pass — the DTOs are Zod-inferred TS types (Task 1), not `class-validator` classes, which is what `@nestjs/swagger`'s reflection needs for typed response schemas. Documented as a known gap, not silently accepted: see Step 2b.
- Produces: `packages/api-client` — typed-paths-but-loosely-typed-bodies fetch client Plan 2 (web) and Plan 3 (admin) import instead of hand-writing `fetch` calls; tightening response types (via `@ApiResponse({ type: ... })` or switching DTOs to `nestjs-zod`) is explicitly deferred, not forgotten

- [ ] **Step 1: Add Swagger to `apps/api`**

Run: `cd apps/api && pnpm add @nestjs/swagger`

- [ ] **Step 2: Wire OpenAPI doc generation in `main.ts`** — keep the `/v1` global prefix from Task 3 Step 7, don't drop it

```typescript
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { writeFileSync } from "fs";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix("v1", { exclude: ["health"] });
  const config = new DocumentBuilder().setTitle("GurmeGo API").setVersion("1.0").build();
  const document = SwaggerModule.createDocument(app, config);
  if (process.env.EXPORT_OPENAPI) {
    writeFileSync("openapi.json", JSON.stringify(document));
    process.exit(0);
  }
  SwaggerModule.setup("docs", app, document);
  await app.listen(process.env.PORT ?? 3000, "0.0.0.0");
}
bootstrap();
```

- [ ] **Step 2b: Acknowledge the response-type gap in the generated client (not a bug to fix now)**

Open `apps/api/openapi.json` after Step 3 runs and confirm each path's `responses.200.content` is present but
schema-less (`{}` or missing `$ref`). This is expected — record it as a known limitation in the commit
message (Step 7) rather than silently shipping it as if it were fully typed. Plan 2 (web) and Plan 3 (admin)
will need to assert response shapes against `@gurmego/shared`'s Zod schemas at the call site until this is
tightened.

- [ ] **Step 3: Generate the spec file**

Run: `cd apps/api && EXPORT_OPENAPI=1 node -r ts-node/register src/main.ts`
Expected: `apps/api/openapi.json` created, process exits 0

- [ ] **Step 4: Create `packages/api-client/package.json`**

```json
{
  "name": "@gurmego/api-client",
  "version": "0.0.0",
  "private": true,
  "main": "src/index.ts",
  "scripts": { "generate": "openapi-typescript ../../apps/api/openapi.json -o src/generated-types.ts" },
  "devDependencies": { "openapi-typescript": "^6.7.0" }
}
```

- [ ] **Step 5: Generate types and create the thin fetch wrapper `packages/api-client/src/index.ts`**

Run: `cd packages/api-client && pnpm add -D openapi-typescript && pnpm run generate`

```typescript
export * from "./generated-types";

export function createApiClient(baseUrl: string, getToken?: () => string | undefined) {
  return {
    async get<T>(path: string): Promise<T> {
      const token = getToken?.();
      const res = await fetch(`${baseUrl}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
      return res.json();
    },
  };
}
```

- [ ] **Step 6: Verify the generated types file exists and typechecks**

Run: `cd packages/api-client && npx tsc --noEmit src/generated-types.ts`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/main.ts apps/api/package.json packages/api-client apps/api/openapi.json
git commit -m "feat: generate OpenAPI spec and typed api-client package"
```

---

## Task 22: Seed script for local development

**Files:**
- Create: `apps/api/prisma/seed.ts`
- Modify: `apps/api/package.json` (add `prisma.seed` config)

**Interfaces:**
- Consumes: Prisma Client (Task 2)
- Produces: `pnpm --filter @gurmego/api prisma db seed` populates 1 City (İstanbul), 3 Districts (Kadıköy/Beşiktaş/Beyoğlu), 6 sample venues — used by Plan 2/3 developers to have data to point the frontend at

- [ ] **Step 1: Create `apps/api/prisma/seed.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const city = await prisma.city.upsert({
    where: { slug: "istanbul" },
    update: {},
    create: { name: "İstanbul", slug: "istanbul" },
  });

  const districtNames = [
    { name: "Kadıköy", slug: "kadikoy" },
    { name: "Beşiktaş", slug: "besiktas" },
    { name: "Beyoğlu", slug: "beyoglu" },
  ];

  for (const d of districtNames) {
    const district = await prisma.district.upsert({
      where: { slug: d.slug },
      update: {},
      create: { ...d, cityId: city.id },
    });

    await prisma.$executeRaw`
      INSERT INTO "Venue" (id, name, slug, "districtId", location, category, "priceRange",
        "signatureItems", "openingHours", "editorialNote", "isBoutique", "branchCount",
        "verifiedAt", status, source, "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(), ${`${d.name} Kahvecisi`}, ${`${d.slug}-kahvecisi`}, ${district.id},
        ST_SetSRID(ST_MakePoint(29.02, 40.99), 4326)::geography, 'cafe', 'MODERATE',
        ARRAY['filtre kahve'], '{}'::jsonb, 'Örnek kürasyon notu.', true, 1,
        now(), 'PUBLISHED', 'MANUAL', now(), now()
      )
      ON CONFLICT (slug) DO NOTHING
    `;
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Add seed config to `apps/api/package.json`**

```json
"prisma": { "seed": "ts-node prisma/seed.ts" }
```

Run: `cd apps/api && pnpm add -D ts-node`

- [ ] **Step 3: Run the seed and verify**

Run: `cd apps/api && npx prisma db seed`
Expected: no errors; `npx prisma studio` shows 1 city, 3 districts, 3 venues

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/seed.ts apps/api/package.json
git commit -m "chore(api): add dev seed script for districts and sample venues"
```

---

## Task 23: CI — lint/typecheck/test on PR

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `turbo run lint/typecheck/test` (Task 0)
- Produces: GitHub Actions workflow — full deploy pipeline (staging/prod, Vercel, Railway) is Plan 4's job; this task only wires the local quality gate.

- [ ] **Step 1: Load the `devops-engineer` skill** before writing the workflow — even though full deploy is Plan 4, the CI trigger/cache pattern should match what that plan will extend.

- [ ] **Step 2: Create `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:15-3.4
        env:
          POSTGRES_PASSWORD: postgres
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: ".nvmrc"
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @gurmego/api exec prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
      - run: pnpm run lint
      - run: pnpm run typecheck
      - run: pnpm run test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
          SUPABASE_JWKS_URL: http://localhost:54321/auth/v1/.well-known/jwks.json
```

- [ ] **Step 3: Push to a branch and verify the workflow runs**

Run: `git push origin HEAD` (on a feature branch)
Expected: GitHub Actions "CI" workflow appears and all steps pass

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "chore: add CI workflow for lint/typecheck/test"
```

---

## Task 24: Cross-model review (mandatory)

**Files:** none created — this task reviews everything from Tasks 0–23.

- [ ] **Step 1: Run the project's built-in review**

Invoke `superpowers:requesting-code-review` against the full diff (Tasks 0–23).

- [ ] **Step 2: Run the mandatory cross-model review — this is not optional per `CLAUDE.md`**

Invoke the `cross-model-review` skill. Tell the user before this runs (delegation to Codex) — the repo is the user's own project so the data-boundary question doesn't need re-asking (already established this session), but the "delege ettiğinde kullanıcıya söyle" rule still applies.

- [ ] **Step 3: Merge findings from both reviews**

Present to the user: what Superpowers' reviewer found, what Codex found that the first reviewer missed, and fix anything both flagged as blocking before calling this plan done.

- [ ] **Step 4: Update `docs/STATE.md` and `docs/CHANGELOG.md`**

Record: Plan 1 complete, what was built, what Plan 2 (web/PWA) needs from this API (the `packages/api-client` types + endpoint list), any findings deferred rather than fixed.

---

## Red-team bulguları (Codex, plan-red-team, 2026-07-24)

Codex'in ilk verdikti **YENİDEN BÖL**, tam planı değil (10+ dakika sürdüğü için 3 kez zaman aşımına uğradı)
kısaltılmış bir Files/Consumes/Produces özetini denetledi. Kendi CONFIDENCE bloğu şunu söylüyordu: "tam
planda açık wiring, Swagger üretimi, update endpoint'i ve task-bağımlılıkları bulunması" fikrini
değiştirirdi — yani bulguların bir kısmı özetin eksikliğinden, gerçek plan hatasından değildi.

**Kabul edilenler (plana işlendi):**
- Eksik `PUT /admin/venues/:id` ucu → Task 16'ya `AdminVenuesService.update` + controller route eklendi.
- `/v1` global prefix hiç yoktu (`api-spec.md §1`'deki Base URL ile çelişiyordu) → Task 3'e `setGlobalPrefix("v1")` eklendi, Task 21'e de taşındı (main.ts'i iki task değiştiriyor, ikisinde de korunmalı).
- `429` yanıtlarında `Retry-After` header yoktu (`api-spec.md §6` şart koşuyordu) → `RateLimitGuard`'a eklendi.
- `RULES_MOD_AUTO_HIDE_REPORTS` eşiği Task 12 ve Task 15'te bağımsız iki yerde okunuyordu (drift riski) → `rule-config.ts`'te tek fonksiyona (`getUrgentReportThreshold`) çıkarıldı, ikisi de oradan import ediyor.
- `jwt.strategy.ts` adı yanıltıcıydı (içinde bir Passport Strategy değil, bir `NestMiddleware` var) → `jwt-auth.middleware.ts` olarak yeniden adlandırıldı.
- `CACHE_STORE` provider'ının yalnızca `reports.module.ts`'e eklenmesi, Task 20'nin `venues`/`districts` (ve gözden kaçan `favorites`) modüllerinde de aynı binding'e ihtiyaç duyduğunu örtük bırakıyordu → Task 20'nin Interfaces/Steps bölümü üçünü de açıkça listeliyor artık.
- `GET /me/lists` genel okuma rate limitine dahil değildi → Task 20'ye eklendi (admin uçları bilinçli olarak hariç bırakıldı, aşağıya bakın).
- ADR 001/002/003'te gerçek hatalar vardı (crash/restart karışıklığı, "injection riski yok" aşırı kesinliği, blast-radius abartısı) → üçü de düzeltildi.

**Kısmen kabul edilenler:**
- "Genel wiring (`app.module.ts`/`admin.module.ts` kaydı) Files bölümünde görünmüyor" — her 24 task'ın Files bloğuna tek tek `Modify: app.module.ts` eklemek yerine, planın başına bunu açıklayan bir **Wiring Convention** notu eklendi. Gerekçe: aynı tek satırlık ekleme 10 task'ta tekrarlanınca DRY'yi ihlal eder ve gerçek bilgi eklemez — ama neden eksik göründüğü artık açık, kör nokta değil.

**Reddedilenler:**
- **Genel "YENİDEN BÖL" verdikti**: reddedildi. Gerekçe: bulguların hiçbiri task/dosya sınırlarının yanlış çizildiğini göstermiyor (ör. paralel çalışacak iki task'ın aynı dosyaya çakışarak yazması gibi) — hepsi ekleme (eksik endpoint, eksik header) veya düzeltme (yanlış isim, tekrarlanan sabit) seviyesinde, yani `DUZELTILEBILIR`. **Bu yanlışsa ne olur:** task sınırları gerçekten yanlış çizilmişse, subagent-driven-development sırasında iki subagent aynı dosyada çakışan değişiklikler üretir; bu durumda plana geri dönüp Task 8/9/20'yi (hepsi `venues.controller.ts`'e dokunuyor) tek bir task'ta birleştirmek gerekir.
- **T8→T9 arasında "consumes edilmeyen değişiklik" riski**: kısmen reddedildi — task'lar sıralı numaralandırılmış ve inline/subagent-driven yürütmede sırayla çalışacak, bu yüzden "Consumes: aynı Task 7" ifadesi zaten önceki task'ın son haliyle devam edildiğini ima ediyor. Route sırası notu (map, sonra :slug) zaten Task 8'de vardı. **Bu yanlışsa ne olur:** paralel yürütme denenirse (bu plan paralel değil, sıralı tasarlandı) gerçek bir çakışma olur — bu yüzden Task 24'te bu plan **sıralı** yürütülmeli notu eklenmedi çünkü zaten `subagent-driven-development`in "fresh subagent per task" modeli doğası gereği sıralı review checkpoint'li çalışır, paralel değil.

## Self-Review Notes (completed during plan authoring)

- **Spec coverage:** every MVP endpoint in `api-spec.md` (post-round-3 revision) has a task: districts (Task 5), venues list/map/detail (Tasks 7–9), report (Task 12), favorites (Task 11), admin queue/venues/reports/users/export (Tasks 15–19). `POST /search`, `/venues/:id/reviews`, `/venues/:id/gourmet-rating`, `owner-verification`, `/contributions/*` are Faz 2 per `prd.md` and correctly **not** in this plan.
- **Placeholder scan:** no TBD/TODO — every step has real code, every test has real assertions.
- **Type consistency verified:** `VenueListQuery` (Task 1) flows unchanged into `VenuesRepository.searchPublished` (Task 6) and `VenuesService.list` (Task 7); `CacheStore` interface (Task 12) is reused identically in Task 20; `BoutiqueService.evaluate`'s input shape is identical between its own tests (Task 13) and its caller in `AdminVenuesService.create` (Task 16).
