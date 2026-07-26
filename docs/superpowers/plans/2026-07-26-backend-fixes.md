# GurmeGo — Plan 4b: Backend Kritik Düzeltmeler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every backend finding from `docs/AUDIT-2026-07-26.md` so the pilot can actually
function — most critically, make it possible to publish a venue at all, and stop the location
header contract / data-integrity / security gaps documented in
`docs/superpowers/specs/2026-07-26-backend-fixes-design.md` (HAZIR after 5 idea-red-team rounds).

## Red-team bulguları — round 1 (Codex, YENİDEN BÖL) uygulandı

Round 1'in en kritik bulgusu: önceki task bölünmesi `VenuesRepository`'nin imzasını (Task 3)
değiştirip production çağrı noktalarını (seed.ts, AdminVenuesService, AdminQueueService) ancak
2-3 task sonra düzeltiyordu — aradaki her `npx tsc --noEmit` adımı gerçekte FAIL verirdi çünkü
o anki kod tabanı henüz derlenmiyor olurdu. Bu, kullanıcının global CLAUDE.md'sinin
"sözleşme hatası en pahalı hatadır" uyarısının tam karşılığı. Bu revizyonda:

- Task 3 (eski 3+4+5+6) tek bir atomik task'ta birleşti: repository'nin transaction-farkındalığı,
  `findRawForSnapshot`, `findBySlug` yeniden yazımı, `open_now` filtresi ve B11 hepsi aynı task'ta
  — typecheck/test iddiaları yalnızca o task'ın kendi dosyasına (`venues.repository.spec.ts`) karşı
  yapılıyor, tüm-repo `tsc --noEmit` çağrı noktaları düzelene kadar (yeni Task 8) ertelendi.
- CSV `status` artık `VenueStatusSchema`'nın tamamını değil (`ARCHIVED` dahil tüm statüleri) yalnızca
  design doc'un istediği `DRAFT | PUBLISHED` alt kümesini kabul eden ayrı bir enum kullanıyor.
- CSV `address` alanı şemaya eklendi (önceden Task 9 varmış gibi kullanıyordu ama şema üretmiyordu).
- B11 (`lat===0`/`lng===0` yerine `!== undefined`) artık Task 3'ün açık bir adımı.
- B12 (UUID path param doğrulaması) artık Task 8'in açık bir adımı.
- `open_now`'ın "eksik/malformed veri fail-open olsun" gereksinimi PostgreSQL'in three-valued
  logic'iyle (`NOT NULL` = `NULL`, `TRUE` değil) uyumlu hale getirildi — ayrı `CASE WHEN ... ELSE true END`
  bariyeriyle.
- `revert()`'ün `findRawForSnapshot`'tan gelen satırı `updateWithLocation`'a `any` ile geçirmesi yerine
  açık bir `snapshotToUpdateInput()` dönüştürücü eklendi (nullable alanların kaybolmaması için).
- ADR 002 güncellendi: raw SQL kuralı artık `venues.repository.ts`'e özel değil, `*.repository.ts`
  dosya deseni geneline (bkz. `docs/adr/002-postgis-raw-sql-repository-isolation.md`, commit
  `fc3eecc`) — Task 8'in `DistrictsRepository`'de KNN SQL çalıştırması artık ADR'ye aykırı değil.
- Task 11 (eski)'in commit adımından yanlışlıkla `apps/web/src` staging'i kaldırıldı.
- Task 14 (final)'ün curl tabanlı "smoke test" adımı artık açıkça **manuel doğrulama** olarak
  etiketlendi, otomatik/tekrarlanabilir bir kabul kriteri olarak sunulmuyor.
- Çeşitli placeholder testler (bbox, AllExceptionsFilter, admin-queue REPORT) gerçek assertion'larla
  değiştirildi.

**Reddedilen bulgular:**
- "ADR 001'in Postgres seçimi MVP'de process-içi store'dan daha iyi değil" — reddedildi. Gerekçe:
  pilot Railway'de tek instance'ta çalışacak (ADR 001, Plan 4a idea-red-team kararı), ama restart'ta
  process-içi store sıfırlanır ve rate-limit sayaçları kaybolur; Postgres `unlogged` tablo bu riski
  taşımadan aynı basitliği veriyor. Bu yanlışsa ne olur: gereksiz bir DB round-trip'i her istekte
  eklenmiş olur — ölçülebilir sinyal zaten ADR 001'de var (p95 etkisi).
- "ADR 004 için coarsened/geohash konum değerlendirilmeliydi" — kısmen kabul, kısmen ret. Kabul:
  ADR 004'e Cache-Control/CORS/header-redaction riskleri erken uyarı sinyali olarak zaten kayıtlı.
  Ret: geohash'e geçmek MVP kapsamını genişletir (mesafe hesaplama hassasiyeti değişir, tüm
  sort=distance mantığı yeniden tasarlanır) — bu pilotun zaman bütçesine göre orantısız. Bu yanlışsa
  ne olur: bir CDN eklendiğinde header'ın loglanmadığı varsayımı bozulursa, tam koordinat sızmış
  olur; ADR 004 bu riski "erken uyarı sinyali" olarak zaten kayıtlı tutuyor.

**Architecture:** No new modules. Existing `VenuesRepository` (raw-SQL, ADR 002) becomes
transaction-aware (accepts a Prisma client parameter) so admin writes and their `VenueVersion`
snapshots become atomic. A new `@UserLocationParam()` decorator reads `X-User-Location` instead of
query params (ADR 004). Zod schemas in `packages/shared` gain `status`, `openNow`, and a corrected
optional-boolean pattern; the sort-default logic moves from schema `.transform()` to the service
layer because headers aren't visible during Zod parsing.

**Tech Stack:** NestJS 10 (Fastify), Prisma 5 + raw `$queryRaw`/`$queryRawUnsafe` (PostGIS), Zod,
Jest, `@nestjs/schedule` (new dependency for Task 9).

## Global Constraints

- TypeScript `strict: true`; `any` forbidden unless justified.
- All API input validated via Zod schemas from `packages/shared`.
- PostGIS raw SQL only in `*.repository.ts` files (ADR 002, as amended 2026-07-26).
- Rule engine thresholds (boutique branch limit, stale days, moderation threshold, rate limits)
  read from env, never hardcoded.
- `ContributionQueue` remains the only entry point for user contributions into `Venue` — no task
  in this plan bypasses it.
- Migration: only `prisma migrate`, never manual Supabase dashboard edits.
- User location travels only via the `X-User-Location` HTTP header (ADR 004), never as a query
  param, never written to any log/analytics call (NFR-04).
- This repo has no `origin` git remote — no task assumes a real GitHub Actions run; local command
  reproduction is the acceptance proof, same as Plan 4a.
- Local Supabase stack connection details must be read from `npx supabase status` at execution
  time — do not assume the example ports in this plan are still correct if the stack restarted.
- **A `npx tsc --noEmit` or full `npx jest` run is only a valid acceptance step once every call
  site of a changed signature in this plan has been updated.** Tasks 1-7 assert tests scoped to
  the files they touch; the first whole-project `tsc --noEmit`/`jest` run is Task 8, once every
  repository signature change has propagated to every caller.

---

## Task 1: Migration — `Venue.address` and `Venue.photos`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_venue_address_photos/migration.sql` (generated)

**Interfaces:**
- Consumes: nothing (first task, pure schema change)
- Produces: `Venue.address: String?`, `Venue.photos: String[]` (default `[]`) — every later task in
  this plan that touches venue read/write (Tasks 3, 5) depends on these columns existing.

- [ ] **Step 1: Edit `apps/api/prisma/schema.prisma`** — add two fields to the `Venue` model,
      immediately after `transportNote`:

```prisma
  transportNote     String?
  address           String?
  photos            String[]            @default([])
```

- [ ] **Step 2: Generate and apply the migration**

Run (confirm local Supabase stack is up first: `npx supabase status` from repo root):
```bash
cd apps/api && npx prisma migrate dev --name add_venue_address_photos
```
Expected: `Your database is now in sync with your schema.`, new migration file created.

- [ ] **Step 3: Regenerate Prisma Client**

Run: `cd apps/api && npx prisma generate`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add Venue.address and Venue.photos columns"
```

---

## Task 2: Shared schema contract updates

**Files:**
- Modify: `packages/shared/src/schemas/admin-venue.schema.ts`
- Modify: `packages/shared/src/schemas/csv-venue-import.schema.ts`
- Modify: `packages/shared/src/schemas/venue.schema.ts`
- Modify: `packages/shared/src/schemas/admin-queue.schema.ts`
- Test: `packages/shared/src/schemas/admin-venue.schema.spec.ts`, `venue.schema.spec.ts` (append),
  `csv-venue-import.schema.spec.ts` (append)

**Interfaces:**
- Consumes: nothing new
- Produces: `AdminVenueCreateSchema`/`AdminVenueUpdateSchema` with `status`/`address`/`photos`
  (`status: z.infer<typeof VenueStatusSchema> | undefined`); `CsvVenueImportRowSchema` with a
  **separate** `CsvVenueStatusSchema = z.enum(["DRAFT", "PUBLISHED"])`-typed `status` field
  (narrower than the full `VenueStatusSchema` — CSV import can never produce `ARCHIVED`) and an
  `address: z.string().max(500).optional()` field; `OptionalTrueFlag` helper (exported from
  `venue.schema.ts`); `VenueListQuerySchema` with `openNow`, corrected `isBoutique`, no `lat`/`lng`;
  `VenueDetailSchema` with `lat`/`lng`/`address`/`photos`; `AdminQueueItemSchema` and
  `AdminQueueMutationResultSchema` both accepting `type: "REPORT" | "EDIT"`. Every later backend
  task (3-10) and Plan 4c depend on these exact names/shapes.

- [ ] **Step 1: Write the failing test — `packages/shared/src/schemas/admin-venue.schema.spec.ts`** (new file)

```typescript
import { describe, it, expect } from "vitest";
import { AdminVenueCreateSchema, AdminVenueUpdateSchema } from "./admin-venue.schema";

const BASE = {
  name: "Test Kahve", slug: "test-kahve", districtId: "d290f1ee-6c54-4b01-90e6-d701748f0851",
  category: "cafe", priceRange: "MODERATE", openingHours: { mon_fri: "09:00-18:00" },
  branchCount: 1, franchiseFlag: false, lat: 40.99, lng: 29.02,
};

describe("AdminVenueCreateSchema status/address/photos", () => {
  it("accepts an explicit status", () => {
    const result = AdminVenueCreateSchema.safeParse({ ...BASE, status: "PUBLISHED" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("PUBLISHED");
  });

  it("leaves status undefined when omitted (caller decides the default)", () => {
    const result = AdminVenueCreateSchema.safeParse(BASE);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBeUndefined();
  });

  it("rejects an invalid status value", () => {
    const result = AdminVenueCreateSchema.safeParse({ ...BASE, status: "PUBLISHD" });
    expect(result.success).toBe(false);
  });

  it("accepts optional address and photos", () => {
    const result = AdminVenueCreateSchema.safeParse({ ...BASE, address: "Bahariye Cd. No:1", photos: ["https://x/1.jpg"] });
    expect(result.success).toBe(true);
  });
});

describe("AdminVenueUpdateSchema", () => {
  it("is fully partial and still accepts status", () => {
    const result = AdminVenueUpdateSchema.safeParse({ status: "ARCHIVED" });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/schemas/admin-venue.schema.spec.ts`
Expected: FAIL — `status` field not recognized, or `address`/`photos` not present.

- [ ] **Step 3: Add `status`, `address`, `photos` to `AdminVenueCreateSchema`**

In `packages/shared/src/schemas/admin-venue.schema.ts`, add this import at the top:
```typescript
import { VenueStatusSchema } from "./venue.schema";
```
Add these fields to `AdminVenueCreateSchema` (after `franchiseFlag`, before `lat`):
```typescript
  status: VenueStatusSchema.optional(),
  address: z.string().max(500).optional(),
  photos: z.array(z.string().url()).max(20).optional(),
```
(`AdminVenueUpdateSchema` is `AdminVenueCreateSchema.partial()`, so it inherits these automatically.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/schemas/admin-venue.schema.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing test — append to (or create) `packages/shared/src/schemas/csv-venue-import.schema.spec.ts`**

```typescript
import { CsvVenueImportRowSchema } from "./csv-venue-import.schema";

describe("CsvVenueImportRowSchema status/address columns", () => {
  const BASE_ROW = {
    name: "Test", slug: "test", districtSlug: "kadikoy", category: "cafe",
    priceRange: "MODERATE" as const, branchCount: "1", franchiseFlag: "false" as const,
    lat: "40.99", lng: "29.02", openingHours: '{"mon_fri":"09:00-18:00"}',
  };

  it("treats an empty status cell as undefined, not a validation error", () => {
    const result = CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, status: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBeUndefined();
  });

  it("accepts an explicit DRAFT status cell", () => {
    const result = CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, status: "DRAFT" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("DRAFT");
  });

  it("rejects ARCHIVED — CSV import can only produce DRAFT or PUBLISHED", () => {
    const result = CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, status: "ARCHIVED" });
    expect(result.success).toBe(false);
  });

  it("still parses correctly when the status column is missing entirely", () => {
    const result = CsvVenueImportRowSchema.safeParse(BASE_ROW);
    expect(result.success).toBe(true);
  });

  it("accepts an optional address column", () => {
    const result = CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, address: "Bahariye Cd. No:1" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.address).toBe("Bahariye Cd. No:1");
  });

  it("treats an empty address cell as undefined", () => {
    const result = CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, address: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.address).toBeUndefined();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/schemas/csv-venue-import.schema.spec.ts`
Expected: FAIL — `status`/`address` not defined on the schema yet, or `ARCHIVED` wrongly accepted.

- [ ] **Step 7: Add a CSV-specific status enum and `address` to `CsvVenueImportRowSchema`**

In `packages/shared/src/schemas/csv-venue-import.schema.ts`, add:
```typescript
// Deliberately narrower than VenueStatusSchema (which also allows ARCHIVED) -- a CSV import
// creates new venues, and "archived on creation" is not a meaningful state for this path.
export const CsvVenueStatusSchema = z.enum(["DRAFT", "PUBLISHED"]);
```
Add these fields to the row object (after `openingHours`):
```typescript
  status: z.preprocess((v) => (v === "" ? undefined : v), CsvVenueStatusSchema.optional()),
  address: z.preprocess((v) => (v === "" ? undefined : v), z.string().max(500).optional()),
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/schemas/csv-venue-import.schema.spec.ts`
Expected: PASS (6 new tests + any pre-existing ones still passing).

- [ ] **Step 9: Write the failing test — append to `packages/shared/src/schemas/venue.schema.spec.ts`**

```typescript
import { OptionalTrueFlag, VenueListQuerySchema, VenueDetailSchema } from "./venue.schema";

describe("OptionalTrueFlag", () => {
  it("leaves the field undefined when absent (does not coerce to false)", () => {
    const schema = z.object({ flag: OptionalTrueFlag });
    const result = schema.parse({});
    expect(result.flag).toBeUndefined();
  });

  it("parses the literal string 'true' as boolean true", () => {
    const schema = z.object({ flag: OptionalTrueFlag });
    expect(schema.parse({ flag: "true" }).flag).toBe(true);
  });

  it("rejects the literal string 'false' rather than coercing it to true", () => {
    const schema = z.object({ flag: OptionalTrueFlag });
    expect(schema.safeParse({ flag: "false" }).success).toBe(false);
  });
});

describe("VenueListQuerySchema location fields", () => {
  it("no longer accepts lat/lng (moved to the X-User-Location header)", () => {
    const parsed = VenueListQuerySchema.parse({ lat: "40.99", lng: "29.02" });
    expect((parsed as any).lat).toBeUndefined();
    expect((parsed as any).lng).toBeUndefined();
  });

  it("accepts openNow=true and rejects openNow=false", () => {
    expect(VenueListQuerySchema.parse({ openNow: "true" }).openNow).toBe(true);
    expect(VenueListQuerySchema.safeParse({ openNow: "false" }).success).toBe(false);
  });

  it("isBoutique=false is rejected (must be 'true' or omitted)", () => {
    expect(VenueListQuerySchema.safeParse({ isBoutique: "false" }).success).toBe(false);
    expect(VenueListQuerySchema.parse({}).isBoutique).toBeUndefined();
  });
});

describe("VenueDetailSchema new fields", () => {
  it("requires lat/lng, allows nullable address, defaults photos shape", () => {
    const base = {
      id: "d290f1ee-6c54-4b01-90e6-d701748f0851", slug: "x", name: "X", category: "cafe",
      cuisineType: null, priceRange: "MODERATE", signatureItems: [], transportNote: null,
      openingHours: {}, editorialNote: null, isBoutique: false,
      verifiedAt: "2026-07-24T00:00:00.000Z", source: "MANUAL", googleRating: null,
      googleRatingCount: null, googlePlaceId: null, district: { name: "Kadıköy", slug: "kadikoy" },
      lat: 40.99, lng: 29.02, address: null, photos: [],
    };
    expect(VenueDetailSchema.safeParse(base).success).toBe(true);
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/schemas/venue.schema.spec.ts`
Expected: FAIL — `OptionalTrueFlag` not exported, `openNow` not recognized, `VenueDetailSchema`
missing new fields, `lat`/`lng` still present on `VenueListQuerySchema`.

- [ ] **Step 11: Implement in `packages/shared/src/schemas/venue.schema.ts`**

Add this exported helper near the top of the file (after imports):
```typescript
// Correct pattern for an optional "true"-only query flag. `z.coerce.boolean()` is a footgun here:
// `Boolean("false")` is `true`, so a client explicitly sending `?flag=false` would flip it on.
// A naive `z.literal("true").optional().transform(v => v === "true")` is ALSO wrong -- when the
// field is absent, `v` is `undefined`, and `undefined === "true"` is `false`, not `undefined`,
// which collapses "filter not requested" into "filter explicitly off". This version preserves
// `undefined` for the absent case.
export const OptionalTrueFlag = z.literal("true").optional().transform((v) => (v === undefined ? undefined : true));
```

In `VenueListQuerySchema`, remove the `lat`/`lng` fields and any `.transform()` that defaults
`sort` based on their presence (that logic moves to `VenuesService`, see Task 4). Replace
`isBoutique: z.coerce.boolean().optional()` with `isBoutique: OptionalTrueFlag`. Add
`openNow: OptionalTrueFlag`. Read the actual current file first — preserve every other existing
field (e.g. `districtId`/`category`/`priceRange`/`radiusM`/`sort`/`limit`/`cursor`) exactly as-is,
only touching `lat`/`lng`/`isBoutique`/`openNow`.

In `VenueDetailSchema`, add after `district`:
```typescript
  lat: z.number(),
  lng: z.number(),
  address: z.string().nullable(),
  photos: z.array(z.string()),
```

- [ ] **Step 12: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/schemas/venue.schema.spec.ts`
Expected: PASS (all new + pre-existing tests).

- [ ] **Step 13: Write the failing test — append to `packages/shared/src/schemas/admin-queue.schema.spec.ts`**

(Find the existing test file with `find packages/shared/src/schemas -iname "admin-queue*"`. Read
the real current schema first — the `base` object below must match its actual required fields;
this is illustrative of the assertion, not a literal copy-paste if the real shape differs.)

```typescript
describe("AdminQueueItemSchema / AdminQueueMutationResultSchema type enum", () => {
  it("accepts type EDIT on both schemas, not just REPORT", () => {
    const base = { id: "d290f1ee-6c54-4b01-90e6-d701748f0851", status: "PENDING", createdAt: "2026-07-24T00:00:00.000Z" };
    expect(AdminQueueItemSchema.safeParse({ ...base, type: "EDIT", payload: { kind: "re_verify" }, urgent: false }).success).toBe(true);
    expect(AdminQueueMutationResultSchema.safeParse({ ...base, type: "EDIT" }).success).toBe(true);
  });
});
```

- [ ] **Step 14: Run test to verify it fails, then change both schemas' `type` field from
      `z.literal("REPORT")` to `z.enum(["REPORT", "EDIT"])`, then verify the test passes.**

Run: `cd packages/shared && npx vitest run src/schemas/admin-queue.schema.spec.ts`

- [ ] **Step 15: Run the full shared package suite and typecheck**

Run: `cd packages/shared && npx vitest run && npx tsc --noEmit`
Expected: all pass, no type errors. (This is a valid whole-package typecheck here because
`packages/shared` has no callers inside this same package that this task left broken — every
consumer lives in `apps/api`/`apps/web`, which are exactly what Tasks 3-8 update.)

- [ ] **Step 16: Commit**

```bash
git add packages/shared/src/schemas
git commit -m "feat(shared): add status/address/photos fields, fix optional-boolean pattern, widen admin-queue type enum"
```

---

## Task 3: `VenuesRepository` — transaction-aware, location-safe, open_now, B11 (single atomic task)

**Files:**
- Modify: `apps/api/src/venues/venues.repository.ts`
- Test: `apps/api/src/venues/venues.repository.spec.ts` (append)

**Interfaces:**
- Consumes: `packages/shared`'s updated `AdminVenueCreateInput`/`AdminVenueUpdateInput`/`VenueListQuery` (Task 2)
- Produces:
  - `createWithLocation(client, input)`, `updateWithLocation(client, id, input)` — both take a
    Prisma client as the first argument (`PrismaService` or a `Prisma.TransactionClient`).
  - `findRawForSnapshot(client, id): Promise<AdminVenueRow>`.
  - `findBySlug(slug)`: now returns `lat`, `lng`, `address`, `photos`, nested `district: {name, slug}`.
  - `searchPublished(filters: VenueSearchFilters)` — internal type
    `VenueSearchFilters = Omit<VenueListQuery, "sort"> & { sort: "distance" | "newest"; lat?: number; lng?: number }`,
    not exported outside this file — now honors `openNow`.
  - `CreateVenueWithLocationInput`/`UpdateVenueWithLocationInput` gain
    `googleRating`/`googleRatingCount`/`googlePlaceId`/`address`/`photos`.
  - `snapshotToUpdateInput(row: AdminVenueRow): UpdateVenueWithLocationInput` — a pure mapping
    function, no DB access, that converts a raw snapshot row back into a valid update input
    (needed by `revert()` in Task 5; defined here because it is this file's row-shape knowledge).

  **These are consumed by:** Task 4 (`VenuesService.list` calls `searchPublished`), Task 5
  (`AdminVenuesService` calls `createWithLocation`/`updateWithLocation`/`findRawForSnapshot`/
  `snapshotToUpdateInput`, and `seed.ts`'s existing direct call site), Task 6 (CSV import calls
  `AdminVenuesService.create` → transitively `createWithLocation`), Task 7 (`AdminQueueService`
  calls `findRawForSnapshot`).

  **This task does NOT update any caller.** `seed.ts`, `AdminVenuesService`, and `AdminQueueService`
  will not compile against this file's new signatures until Tasks 5 and 7 run — this is expected
  and is why this task's acceptance is scoped to `venues.repository.spec.ts` only, not a
  whole-project typecheck (see Global Constraints).

- [ ] **Step 1: Write the failing tests for the client-parameter change and Google fields**

```typescript
describe("VenuesRepository.createWithLocation — client parameter and Google fields", () => {
  it("accepts an explicit Prisma client (e.g. a transaction client) as the first argument", async () => {
    const fakeTxClient = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1" }]) } as any;
    const repo = new VenuesRepository({} as any);
    const result = await repo.createWithLocation(fakeTxClient, {
      name: "A", slug: "a", districtId: "d1", category: "cafe", priceRange: "MODERATE",
      signatureItems: [], openingHours: {}, isBoutique: false, branchCount: 1, franchiseFlag: false,
      source: "MANUAL", verifiedAt: new Date(), status: "DRAFT", lat: 40.99, lng: 29.02,
    });
    expect(fakeTxClient.$queryRaw).toHaveBeenCalled();
    expect(result).toEqual({ id: "v1" });
  });

  it("includes googleRating/googleRatingCount/googlePlaceId in the INSERT", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1" }]) } as any;
    const repo = new VenuesRepository({} as any);
    await repo.createWithLocation(client, {
      name: "A", slug: "a", districtId: "d1", category: "cafe", priceRange: "MODERATE",
      signatureItems: [], openingHours: {}, isBoutique: false, branchCount: 1, franchiseFlag: false,
      source: "MANUAL", verifiedAt: new Date(), status: "DRAFT", lat: 40.99, lng: 29.02,
      googleRating: 4.5, googleRatingCount: 10, googlePlaceId: "place123",
    });
    const sqlCall = client.$queryRaw.mock.calls[0][0];
    const sqlText = sqlCall.strings ? sqlCall.strings.join("") : String(sqlCall);
    expect(sqlText).toContain("googleRating");
    expect(sqlCall.values).toContain(4.5);
    expect(sqlCall.values).toContain(10);
    expect(sqlCall.values).toContain("place123");
  });
});

describe("VenuesRepository.updateWithLocation — B11 lat/lng zero handling", () => {
  it("includes a lat=0 update (does not silently drop a falsy-but-valid coordinate)", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1" }]) } as any;
    const repo = new VenuesRepository({} as any);
    await repo.updateWithLocation(client, "v1", { lat: 0, lng: 0 } as any);
    const sqlCall = client.$queryRaw.mock.calls[0][0];
    const sqlText = sqlCall.strings ? sqlCall.strings.join("") : String(sqlCall);
    expect(sqlText).toContain("location");
    expect(sqlCall.values).toContain(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts -t "client parameter and Google fields|B11"`
Expected: FAIL — no client parameter, no Google fields in INSERT, and (if the current code uses
`if (input.lat)` / `if (input.lng)` truthiness checks) a `lat: 0` update is silently skipped.

- [ ] **Step 3: Update `CreateVenueWithLocationInput`/`UpdateVenueWithLocationInput` interfaces**

Add to `CreateVenueWithLocationInput` (after `status`):
```typescript
  googleRating?: number;
  googleRatingCount?: number;
  googlePlaceId?: string;
  address?: string;
  photos?: string[];
```
(`UpdateVenueWithLocationInput` derives from this via `Partial<Omit<...>>`, so it inherits these
automatically as optional.)

- [ ] **Step 4: Change `createWithLocation`'s signature and INSERT statement**

```typescript
async createWithLocation(client: Pick<PrismaService, "$queryRaw">, input: CreateVenueWithLocationInput): Promise<AdminVenueRow> {
    const id = randomUUID();
    const rows = await client.$queryRaw<AdminVenueRow[]>(Prisma.sql`
      INSERT INTO "Venue" (
        id, name, slug, "districtId", category, "cuisineType", "priceRange", "signatureItems",
        "transportNote", "openingHours", "editorialNote", "isBoutique", "branchCount", "franchiseFlag",
        source, "verifiedAt", status, location, "googleRating", "googleRatingCount", "googlePlaceId",
        address, photos, "updatedAt"
      ) VALUES (
        ${id}, ${input.name}, ${input.slug}, ${input.districtId}, ${input.category},
        ${input.cuisineType ?? null}, ${input.priceRange}::"PriceRange", ${input.signatureItems},
        ${input.transportNote ?? null}, ${JSON.stringify(input.openingHours)}::jsonb,
        ${input.editorialNote ?? null}, ${input.isBoutique}, ${input.branchCount}, ${input.franchiseFlag},
        ${input.source}::"VenueSource", ${input.verifiedAt}, ${input.status}::"VenueStatus",
        ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
        ${input.googleRating ?? null}, ${input.googleRatingCount ?? null}, ${input.googlePlaceId ?? null},
        ${input.address ?? null}, ${input.photos ?? []},
        now()
      )
      ${ADMIN_VENUE_RETURNING}
    `);
    return rows[0];
}
```
Remove `private prisma: PrismaService` usage inside this method body — it now uses the `client`
parameter. The constructor's `private prisma: PrismaService` stays, since `searchPublished`/
`findBySlug`/`findInBbox`/`findRawForSnapshot` still use it directly for their own
non-transactional reads.

- [ ] **Step 5: Change `updateWithLocation`'s signature; fix B11; add Google/address/photos**

```typescript
async updateWithLocation(client: Pick<PrismaService, "$queryRaw">, id: string, input: UpdateVenueWithLocationInput): Promise<AdminVenueRow> {
```
Ensure every conditional assignment in this method (including the pre-existing ones for other
fields) uses `!== undefined`, not truthiness — in particular:
```typescript
    if (input.lat !== undefined && input.lng !== undefined) {
      assignments.push(Prisma.sql`location = ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography`);
    }
    if (input.googleRating !== undefined) assignments.push(Prisma.sql`"googleRating" = ${input.googleRating}`);
    if (input.googleRatingCount !== undefined) assignments.push(Prisma.sql`"googleRatingCount" = ${input.googleRatingCount}`);
    if (input.googlePlaceId !== undefined) assignments.push(Prisma.sql`"googlePlaceId" = ${input.googlePlaceId}`);
    if (input.address !== undefined) assignments.push(Prisma.sql`address = ${input.address}`);
    if (input.photos !== undefined) assignments.push(Prisma.sql`photos = ${input.photos}`);
```
(If the existing code already guards `lat`/`lng` together as one combined condition using
truthiness — e.g. `if (input.lat && input.lng)` — this is exactly B11: replace it with the
`!== undefined` version above.) Replace `this.prisma.$queryRaw` with `client.$queryRaw` in this
method's final query call.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts -t "client parameter and Google fields|B11"`
Expected: PASS (3 tests).

- [ ] **Step 7: Write the failing test for `findRawForSnapshot`**

```typescript
describe("VenuesRepository.findRawForSnapshot", () => {
  it("returns the full row including lat/lng via raw SQL", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1", lat: 40.99, lng: 29.02 }]) } as any;
    const repo = new VenuesRepository({} as any);
    const result = await repo.findRawForSnapshot(client, "v1");
    const sqlCall = client.$queryRaw.mock.calls[0][0];
    const sqlText = sqlCall.strings ? sqlCall.strings.join("") : String(sqlCall);
    expect(sqlText).toContain("ST_Y");
    expect(sqlText).toContain("ST_X");
    expect(result).toEqual({ id: "v1", lat: 40.99, lng: 29.02 });
  });

  it("throws NotFoundException when the venue doesn't exist", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    const repo = new VenuesRepository({} as any);
    await expect(repo.findRawForSnapshot(client, "missing")).rejects.toThrow("Mekan bulunamadı");
  });
});
```

- [ ] **Step 8: Run test to verify it fails, then implement `findRawForSnapshot`**

```typescript
async findRawForSnapshot(client: Pick<PrismaService, "$queryRaw">, id: string): Promise<AdminVenueRow> {
    const rows = await client.$queryRaw<AdminVenueRow[]>(Prisma.sql`
      SELECT id, name, slug, "districtId", category, "cuisineType", "priceRange", "signatureItems",
        "transportNote", "openingHours", "editorialNote", "isBoutique", "branchCount", "franchiseFlag",
        source, "verifiedAt", status, "googleRating", "googleRatingCount", "googlePlaceId", featured,
        address, photos, "createdAt", "updatedAt",
        ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
      FROM "Venue"
      WHERE id = ${id}
    `);
    if (rows.length === 0) {
      const notFound = new NotFoundException({ error: { code: "VENUE_NOT_FOUND", message: "Mekan bulunamadı" } });
      notFound.message = "Mekan bulunamadı";
      throw notFound;
    }
    return rows[0];
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts -t findRawForSnapshot`
Expected: PASS (2 tests).

- [ ] **Step 10: Write the failing test for `snapshotToUpdateInput`**

```typescript
describe("snapshotToUpdateInput", () => {
  it("maps a raw snapshot row into a valid update input, preserving nulls explicitly", () => {
    const row: AdminVenueRow = {
      id: "v1", name: "A", slug: "a", districtId: "d1", category: "cafe", cuisineType: null,
      priceRange: "MODERATE", signatureItems: [], transportNote: null, openingHours: {},
      editorialNote: null, isBoutique: false, branchCount: 1, franchiseFlag: false,
      source: "MANUAL", verifiedAt: new Date(), status: "PUBLISHED", googleRating: null,
      googleRatingCount: null, googlePlaceId: null, featured: false, address: null, photos: [],
      createdAt: new Date(), updatedAt: new Date(), lat: 40.99, lng: 29.02,
    } as any;
    const input = snapshotToUpdateInput(row);
    expect(input).toMatchObject({
      name: "A", slug: "a", districtId: "d1", category: "cafe", cuisineType: null,
      priceRange: "MODERATE", isBoutique: false, branchCount: 1, franchiseFlag: false,
      status: "PUBLISHED", googleRating: null, googleRatingCount: null, googlePlaceId: null,
      address: null, photos: [], lat: 40.99, lng: 29.02,
    });
  });
});
```

- [ ] **Step 11: Run test to verify it fails, then implement `snapshotToUpdateInput`**

```typescript
// Pure mapping, no DB access. `revert()` (Task 5) uses this to turn a VenueVersion snapshot back
// into a valid updateWithLocation input -- without this, nullable fields (address, Google fields)
// restored from a snapshot would need unsafe `any` casts at the call site.
export function snapshotToUpdateInput(row: AdminVenueRow): UpdateVenueWithLocationInput {
  return {
    name: row.name, slug: row.slug, districtId: row.districtId, category: row.category,
    cuisineType: row.cuisineType, priceRange: row.priceRange, signatureItems: row.signatureItems,
    transportNote: row.transportNote, openingHours: row.openingHours as Record<string, string>,
    editorialNote: row.editorialNote, isBoutique: row.isBoutique, branchCount: row.branchCount,
    franchiseFlag: row.franchiseFlag, status: row.status, googleRating: row.googleRating,
    googleRatingCount: row.googleRatingCount, googlePlaceId: row.googlePlaceId,
    address: row.address, photos: row.photos, lat: row.lat, lng: row.lng,
  };
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts -t snapshotToUpdateInput`

- [ ] **Step 13: Write the failing test for `findBySlug`'s rewrite**

```typescript
describe("VenuesRepository.findBySlug — location and new fields", () => {
  it("returns lat/lng, address, photos, and a nested district object via raw SQL", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{
      id: "v1", slug: "a", name: "A", lat: 40.99, lng: 29.02, address: "Adres 1", photos: ["p1"],
      district: { name: "Kadıköy", slug: "kadikoy" },
    }]) } as any;
    const repo = new VenuesRepository(prisma);
    const result = await repo.findBySlug("a");
    const sqlCall = prisma.$queryRaw.mock.calls[0][0];
    const sqlText = sqlCall.strings ? sqlCall.strings.join("") : String(sqlCall);
    expect(sqlText).toContain("ST_Y");
    expect(sqlText).toContain("json_build_object");
    expect(sqlText).toContain("status = 'PUBLISHED'");
    expect(result).toMatchObject({ lat: 40.99, lng: 29.02, address: "Adres 1", photos: ["p1"], district: { name: "Kadıköy", slug: "kadikoy" } });
  });

  it("returns undefined when not found", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    const repo = new VenuesRepository(prisma);
    expect(await repo.findBySlug("missing")).toBeUndefined();
  });
});
```

- [ ] **Step 14: Run test to verify it fails, then replace `findBySlug` with a raw-SQL version**

```typescript
async findBySlug(slug: string) {
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT v.id, v.slug, v.name, v.category, v."cuisineType", v."priceRange", v."signatureItems",
        v."transportNote", v."openingHours", v."editorialNote", v."isBoutique", v."verifiedAt",
        v.source, v."googleRating", v."googleRatingCount", v."googlePlaceId", v.address, v.photos,
        ST_Y(v.location::geometry) AS lat, ST_X(v.location::geometry) AS lng,
        json_build_object('name', d.name, 'slug', d.slug) AS district
      FROM "Venue" v
      JOIN "District" d ON d.id = v."districtId"
      WHERE v.slug = ${slug} AND v.status = 'PUBLISHED'
      LIMIT 1
    `);
    return rows[0];
}
```

- [ ] **Step 15: Run test to verify it passes**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts -t "findBySlug"`
Expected: PASS (2 tests).

- [ ] **Step 16: Write the failing tests for `open_now`**

```typescript
describe("VenuesRepository.searchPublished — openNow", () => {
  it("includes a fail-open CASE barrier for missing/malformed opening-hours data", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    const repo = new VenuesRepository(prisma);
    await repo.searchPublished({ sort: "newest", limit: 20, openNow: true } as any);
    const sql = prisma.$queryRaw.mock.calls[0][0];
    const sqlText = sql.strings ? sql.strings.join("") : String(sql);
    expect(sqlText).toContain("openingHours");
    expect(sqlText).toContain("Europe/Istanbul");
    // Three-valued-logic guard: PostgreSQL's NOT(NULL) is NULL, not TRUE, so a plain
    // `OR NOT (<condition>)` fallback silently excludes venues with missing/malformed hours
    // instead of including them. The fix wraps the whole match in a CASE that defaults to TRUE.
    expect(sqlText).toMatch(/CASE\s+WHEN/i);
  });

  it("does not add an openNow condition when the filter is absent", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    const repo = new VenuesRepository(prisma);
    await repo.searchPublished({ sort: "newest", limit: 20 } as any);
    const sql = prisma.$queryRaw.mock.calls[0][0];
    const sqlText = sql.strings ? sql.strings.join("") : String(sql);
    expect(sqlText).not.toContain("Europe/Istanbul");
  });
});
```

- [ ] **Step 17: Run test to verify it fails**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts -t openNow`

- [ ] **Step 18: Add the internal `VenueSearchFilters` type and `open_now` SQL condition**

At the top of `venues.repository.ts`, near the other interfaces:
```typescript
// Internal type only -- never exported outside this file. `VenueListQuery` (the public API
// contract) no longer carries lat/lng (moved to the X-User-Location header, see
// user-location.decorator.ts, Task 4) or a resolved `sort`; VenuesService.list() merges the
// parsed query with the header-derived location and a computed sort before calling this method.
type VenueSearchFilters = Omit<VenueListQuery, "sort"> & { sort: "distance" | "newest"; lat?: number; lng?: number };
```
Change `searchPublished(filters: VenueListQuery)` to `searchPublished(filters: VenueSearchFilters)`.
Add this condition inside the method, alongside the other `conditions.push(...)` calls:
```typescript
    if (filters.openNow) {
      // CASE-wrapped: PostgreSQL three-valued logic means `NOT(NULL)` is NULL, not TRUE. Without
      // wrapping the whole match in a CASE with an explicit ELSE, a venue whose today's-bucket
      // opening-hours value is NULL or fails the regex would silently disappear from the fallback
      // "malformed data" OR-branch too, instead of being included as designed.
      conditions.push(Prisma.sql`
        CASE
          WHEN EXTRACT(ISODOW FROM now() AT TIME ZONE 'Europe/Istanbul') BETWEEN 1 AND 5
               AND v."openingHours"->>'mon_fri' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$'
          THEN (now() AT TIME ZONE 'Europe/Istanbul')::time
               BETWEEN (split_part(v."openingHours"->>'mon_fri', '-', 1))::time
               AND (split_part(v."openingHours"->>'mon_fri', '-', 2))::time
          WHEN EXTRACT(ISODOW FROM now() AT TIME ZONE 'Europe/Istanbul') BETWEEN 6 AND 7
               AND v."openingHours"->>'sat_sun' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$'
          THEN (now() AT TIME ZONE 'Europe/Istanbul')::time
               BETWEEN (split_part(v."openingHours"->>'sat_sun', '-', 1))::time
               AND (split_part(v."openingHours"->>'sat_sun', '-', 2))::time
          ELSE true
        END
      `);
    }
```
(The `ELSE true` is the fail-open case: if today's bucket's `openingHours` value is missing or
malformed — `NULL`, wrong format — the venue is included rather than excluded. This must never
surface as a 500 from the `::time` cast either, and the regex guard on each `WHEN` ensures the
cast only runs on a string that already matches the expected `HH:MM-HH:MM` shape.)

- [ ] **Step 19: Run test to verify it passes**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts -t openNow`
Expected: PASS (2 tests).

- [ ] **Step 20: Write and run a real-DB test for malformed `openingHours` fail-open behavior**

This needs an actual Postgres connection (unit mocks can't verify SQL executes without error).
Add to a new or existing integration test file that already runs against local Postgres (check
`apps/api/test/` for the pattern Plan 1's `app.e2e-spec.ts` established), seeding one venue with
`openingHours: { mon_fri: "kapalı" }` and one with `openingHours: {}` (key entirely absent),
confirming `searchPublished({ openNow: true, ... })` does not throw and includes both venues.

- [ ] **Step 21: Run the full repository test suite (this task's scoped acceptance gate)**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts`
Expected: all pass. **Do not run a whole-project `npx tsc --noEmit` yet** — `seed.ts`,
`AdminVenuesService`, and `AdminQueueService` still call the old signatures and will not compile
until Tasks 5 and 7.

- [ ] **Step 22: Commit**

```bash
git add apps/api/src/venues/venues.repository.ts
git commit -m "feat(api): VenuesRepository transaction-aware writes, location-safe findBySlug/findRawForSnapshot, open_now filter, B11 fix

Callers (seed.ts, AdminVenuesService, AdminQueueService) still reference
the old signatures at this commit -- fixed in the next two tasks. This
task's own test suite (venues.repository.spec.ts) is green."
```

---

## Task 4: Location header — `@UserLocationParam()`, pipe scoping, sort-default in service

**Files:**
- Create: `apps/api/src/common/user-location.decorator.ts`
- Modify: `apps/api/src/venues/venues.controller.ts`, `venues.service.ts`
- Modify: `apps/api/src/districts/districts.controller.ts`, `districts.service.ts` (wherever
  `findNearest` currently lives — check `apps/api/src/districts/`)
- Test: `apps/api/src/common/user-location.decorator.spec.ts`, `venues.service.spec.ts` (append)

**Interfaces:**
- Consumes: Task 2's `VenueListQuerySchema` (no `lat`/`lng`), Task 3's `VenueSearchFilters`-shaped
  `searchPublished`
- Produces: `UserLocationParam` decorator (returns `{lat,lng} | undefined`); `VenuesService.list(query, location)`
  computing `sort = query.sort ?? (location ? "distance" : "newest")` before calling
  `VenuesRepository.searchPublished`; `DistrictsController.findNearest` requiring the header
  (`400 LOCATION_REQUIRED` if absent). This task's `VenuesController`/`DistrictsController` edits
  are the FIRST caller update against Task 3's new repository — `npx tsc --noEmit` scoped to
  `apps/api/src/venues` and `apps/api/src/districts` (not the whole project — `AdminVenuesService`/
  `AdminQueueService`/`seed.ts` are still pending) is a valid gate at the end of this task.

- [ ] **Step 1: Write the failing test — `user-location.decorator.spec.ts`**

NestJS custom param decorators created via `createParamDecorator` are awkward to unit test
directly — test the underlying parsing logic as a plain exported function instead:

```typescript
import { parseUserLocationHeader } from "./user-location.decorator";

describe("parseUserLocationHeader", () => {
  it("parses a valid 'lat,lng' header", () => {
    expect(parseUserLocationHeader("40.99,29.02")).toEqual({ lat: 40.99, lng: 29.02 });
  });
  it("returns undefined for a missing header", () => {
    expect(parseUserLocationHeader(undefined)).toBeUndefined();
  });
  it("returns undefined for a malformed header (empty parts, Number('')===0 footgun)", () => {
    expect(parseUserLocationHeader(",")).toBeUndefined();
    expect(parseUserLocationHeader("40.99,")).toBeUndefined();
  });
  it("returns undefined for out-of-range values", () => {
    expect(parseUserLocationHeader("999,29.02")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/common/user-location.decorator.spec.ts`
Expected: FAIL — file doesn't exist.

- [ ] **Step 3: Create `apps/api/src/common/user-location.decorator.ts`**

```typescript
import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface UserLocation {
  lat: number;
  lng: number;
}

export function parseUserLocationHeader(header: string | undefined): UserLocation | undefined {
  if (typeof header !== "string") return undefined;
  const parts = header.split(",");
  // `Number("")` is `0`, a technically-in-range coordinate -- without this guard a malformed
  // header like "," or "40.99," would silently become {lat:0,lng:0} instead of being rejected.
  if (parts.length !== 2 || parts.some((p) => p.trim() === "")) return undefined;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return undefined;
  }
  return { lat, lng };
}

export const UserLocationParam = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserLocation | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return parseUserLocationHeader(req.headers["x-user-location"]);
  },
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/common/user-location.decorator.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing test for `VenuesService.list`'s sort-default logic**

```typescript
describe("VenuesService.list — sort default moved from schema to service", () => {
  it("defaults to distance sort when location is provided and query.sort is unset", async () => {
    const repo = { searchPublished: jest.fn().mockResolvedValue({ items: [], nextCursor: null }) } as any;
    const service = new VenuesService(repo);
    await service.list({ limit: 20 } as any, { lat: 40.99, lng: 29.02 });
    expect(repo.searchPublished).toHaveBeenCalledWith(expect.objectContaining({ sort: "distance", lat: 40.99, lng: 29.02 }));
  });

  it("defaults to newest sort when no location is provided", async () => {
    const repo = { searchPublished: jest.fn().mockResolvedValue({ items: [], nextCursor: null }) } as any;
    const service = new VenuesService(repo);
    await service.list({ limit: 20 } as any, undefined);
    expect(repo.searchPublished).toHaveBeenCalledWith(expect.objectContaining({ sort: "newest" }));
  });

  it("respects an explicit query.sort over the location-based default", async () => {
    const repo = { searchPublished: jest.fn().mockResolvedValue({ items: [], nextCursor: null }) } as any;
    const service = new VenuesService(repo);
    await service.list({ limit: 20, sort: "newest" } as any, { lat: 40.99, lng: 29.02 });
    expect(repo.searchPublished).toHaveBeenCalledWith(expect.objectContaining({ sort: "newest" }));
  });
});
```

- [ ] **Step 6: Run test to verify it fails, then update `VenuesService.list`**

```typescript
list(query: VenueListQuery, location?: UserLocation) {
    const sort = query.sort ?? (location ? "distance" : "newest");
    return this.repo.searchPublished({ ...query, sort, lat: location?.lat, lng: location?.lng });
}
```
(Import `UserLocation` from `../common/user-location.decorator`.)

- [ ] **Step 7: Run test to verify it passes**

Run: `cd apps/api && npx jest src/venues/venues.service.spec.ts`

- [ ] **Step 8: Update `VenuesController.list`** — parameter-scoped pipe, add location parameter

```typescript
@Get()
@RateLimit(100, 60)
list(
  @Query(new ZodValidationPipe(VenueListQuerySchema)) query: VenueListQuery,
  @UserLocationParam() location?: UserLocation,
) {
  return this.venues.list(query, location);
}
```
Read the current file first — if `@UsePipes(new ZodValidationPipe(VenueListQuerySchema))` is
applied at the method level, remove it in favor of the parameter-scoped pipe above (a method-level
pipe would try to validate every parameter, including `@UserLocationParam()`'s return value,
against `VenueListQuerySchema` and corrupt it). Preserve `@RateLimit`/any existing guards exactly.

- [ ] **Step 9: Write a controller-level test confirming the pipe scoping doesn't corrupt the location param**

```typescript
describe("VenuesController.list — pipe scoping", () => {
  it("passes both the validated query and the raw location object through unmangled", async () => {
    const venuesService = { list: jest.fn().mockResolvedValue({ items: [], nextCursor: null }) } as any;
    const controller = new VenuesController(venuesService);
    await controller.list({ limit: 20 } as any, { lat: 40.99, lng: 29.02 });
    expect(venuesService.list).toHaveBeenCalledWith({ limit: 20 }, { lat: 40.99, lng: 29.02 });
  });
});
```
Run: `cd apps/api && npx jest src/venues/venues.controller.spec.ts` — expected PASS (adjust the
constructor args to match the controller's actual dependencies if it takes more than one).

- [ ] **Step 10: Update `DistrictsController.findNearest`** to require the header

```typescript
@Get("nearest")
@RateLimit(100, 60)
findNearest(@UserLocationParam() location?: UserLocation) {
  if (!location) {
    throw new BadRequestException({ error: { code: "LOCATION_REQUIRED", message: "Konum bilgisi gerekli" } });
  }
  return this.districts.findNearest(location.lat, location.lng);
}
```
Remove the old `@Query("lat")`/`@Query("lng")` parameters and their `parseFloat` calls.

- [ ] **Step 11: Write the failing test, then verify it passes**

```typescript
describe("DistrictsController.findNearest — header required", () => {
  it("throws 400 LOCATION_REQUIRED when the header is absent", () => {
    const districtsService = { findNearest: jest.fn() } as any;
    const controller = new DistrictsController(districtsService);
    expect(() => controller.findNearest(undefined)).toThrow(BadRequestException);
    expect(districtsService.findNearest).not.toHaveBeenCalled();
  });

  it("calls the service with the header's lat/lng when present", () => {
    const districtsService = { findNearest: jest.fn().mockReturnValue("ok") } as any;
    const controller = new DistrictsController(districtsService);
    controller.findNearest({ lat: 40.99, lng: 29.02 });
    expect(districtsService.findNearest).toHaveBeenCalledWith(40.99, 29.02);
  });
});
```
Run: `cd apps/api && npx jest src/districts/districts.controller.spec.ts`

- [ ] **Step 12: Run the scoped typecheck and test suites for this task's surface**

Run: `cd apps/api && npx jest src/venues src/districts src/common && npx tsc --noEmit -p apps/api 2>&1 | grep -v "admin-venues\|admin-queue\|seed.ts" || true`
(The `grep -v` is a temporary triage aid for this task only, to confirm no *new* errors appeared
outside the known-pending files — `AdminVenuesService`/`AdminQueueService`/`seed.ts` are expected
to still show errors here and get fixed in Tasks 5/7.)
Expected: `apps/api/src/venues/*` and `apps/api/src/districts/*` and `apps/api/src/common/*`
compile clean; the three known-pending files are the only remaining errors.

- [ ] **Step 13: Commit**

```bash
git add apps/api/src/common/user-location.decorator.ts apps/api/src/common/user-location.decorator.spec.ts apps/api/src/venues apps/api/src/districts
git commit -m "feat(api): read user location from X-User-Location header instead of query params (ADR 004)"
```

---

## Task 5: Admin venue create/update/revert — status, transaction, partial-update completeness

**Files:**
- Modify: `apps/api/src/admin/venues/admin-venues.service.ts`
- Modify: `apps/api/src/rule-engine/boutique.service.ts`
- Modify: `apps/api/prisma/seed.ts`
- Test: `apps/api/src/admin/venues/admin-venues.service.spec.ts` (append),
  `apps/api/src/rule-engine/boutique.service.spec.ts` (append)

**Interfaces:**
- Consumes: Task 2's `status` field, Task 3's `createWithLocation`/`updateWithLocation`/
  `findRawForSnapshot`/`snapshotToUpdateInput`
- Produces: `AdminVenuesService.create()` respects `input.status` (defaults `DRAFT`); `update()`/
  `revert()` are atomic (transaction + snapshot with location); `BoutiqueService.evaluate()` takes
  a `status` parameter and returns `false` for non-`PUBLISHED` venues; partial updates recompute
  `isBoutique` correctly even when only one of `branchCount`/`franchiseFlag`/`editorialNote` is
  supplied. **This task fixes `seed.ts`'s call site** — the only other production caller of
  `createWithLocation` besides `AdminVenuesService` itself.

- [ ] **Step 1: Write the failing test — `boutique.service.spec.ts`**

```typescript
describe("BoutiqueService.evaluate — status gate", () => {
  const service = new BoutiqueService();
  it("returns false for a DRAFT venue even if all other rules pass", () => {
    expect(service.evaluate({ branchCount: 1, franchiseFlag: false, hasEditorialNote: true, status: "DRAFT" })).toBe(false);
  });
  it("returns true for a PUBLISHED venue meeting all rules", () => {
    expect(service.evaluate({ branchCount: 1, franchiseFlag: false, hasEditorialNote: true, status: "PUBLISHED" })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails, then update `BoutiqueService`**

```typescript
interface BoutiqueInput {
  branchCount: number;
  franchiseFlag: boolean;
  hasEditorialNote: boolean;
  status: string;
}

@Injectable()
export class BoutiqueService {
  evaluate({ branchCount, franchiseFlag, hasEditorialNote, status }: BoutiqueInput): boolean {
    if (status !== "PUBLISHED") return false;
    const maxBranches = Number(process.env.RULES_BOUTIQUE_MAX_BRANCHES ?? 3);
    return branchCount <= maxBranches && !franchiseFlag && hasEditorialNote;
  }
}
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd apps/api && npx jest src/rule-engine/boutique.service.spec.ts`
Expected: PASS (all, including pre-existing tests — update any existing call site in this file
that constructs a `BoutiqueInput` without `status`).

- [ ] **Step 4: Write the failing test — `admin-venues.service.spec.ts`, status + transaction + partial update + revert**

```typescript
describe("AdminVenuesService.create — status", () => {
  it("uses input.status when provided instead of always DRAFT", async () => {
    const venuesRepository = { createWithLocation: jest.fn().mockResolvedValue({ id: "v1" }) } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const service = new AdminVenuesService({} as any, boutique, venuesRepository);
    await service.create({ name: "A", slug: "a", districtId: "d1", category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: {}, branchCount: 1, franchiseFlag: false, status: "PUBLISHED" } as any);
    expect(venuesRepository.createWithLocation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "PUBLISHED" }));
  });

  it("defaults to DRAFT when status is not provided", async () => {
    const venuesRepository = { createWithLocation: jest.fn().mockResolvedValue({ id: "v1" }) } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const service = new AdminVenuesService({} as any, boutique, venuesRepository);
    await service.create({ name: "A", slug: "a", districtId: "d1", category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: {}, branchCount: 1, franchiseFlag: false } as any);
    expect(venuesRepository.createWithLocation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "DRAFT" }));
  });
});

describe("AdminVenuesService.update — atomic snapshot + write, partial-update completeness, rollback", () => {
  it("wraps snapshot + update in a single transaction", async () => {
    const prisma = { $transaction: jest.fn((fn) => fn({ venueVersion: { create: jest.fn() } })) } as any;
    const venuesRepository = {
      findRawForSnapshot: jest.fn().mockResolvedValue({ id: "v1", branchCount: 2, franchiseFlag: false, editorialNote: "old note", status: "PUBLISHED" }),
      updateWithLocation: jest.fn().mockResolvedValue({ id: "v1" }),
    } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(true) } as any;
    const service = new AdminVenuesService(prisma, boutique, venuesRepository);
    await service.update("v1", { branchCount: 5 } as any);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(venuesRepository.findRawForSnapshot).toHaveBeenCalled();
    expect(venuesRepository.updateWithLocation).toHaveBeenCalled();
  });

  it("completes a partial update's isBoutique inputs from the existing DB row before evaluating", async () => {
    const prisma = { $transaction: jest.fn((fn) => fn({ venueVersion: { create: jest.fn() } })) } as any;
    const venuesRepository = {
      findRawForSnapshot: jest.fn().mockResolvedValue({ id: "v1", branchCount: 2, franchiseFlag: false, editorialNote: "old note", status: "PUBLISHED" }),
      updateWithLocation: jest.fn().mockResolvedValue({ id: "v1" }),
    } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(true) } as any;
    const service = new AdminVenuesService(prisma, boutique, venuesRepository);
    // Only branchCount is in the request; franchiseFlag/editorialNote/status should come from the existing row.
    await service.update("v1", { branchCount: 5 } as any);
    expect(boutique.evaluate).toHaveBeenCalledWith({ branchCount: 5, franchiseFlag: false, hasEditorialNote: true, status: "PUBLISHED" });
  });

  it("propagates a repository failure without committing the version snapshot (rollback)", async () => {
    let snapshotCommitted = false;
    const txClient = {
      venueVersion: { create: jest.fn().mockImplementation(() => { snapshotCommitted = true; return Promise.resolve({}); }) },
    };
    const prisma = {
      $transaction: jest.fn(async (fn) => {
        try {
          return await fn(txClient);
        } catch (err) {
          // Real Prisma rolls back everything the callback did on any thrown error -- this
          // mock only proves the service lets the error propagate rather than swallowing it,
          // which is the precondition for Prisma's real rollback to ever engage.
          snapshotCommitted = false;
          throw err;
        }
      }),
    } as any;
    const venuesRepository = {
      findRawForSnapshot: jest.fn().mockResolvedValue({ id: "v1", branchCount: 2, franchiseFlag: false, editorialNote: null, status: "PUBLISHED" }),
      updateWithLocation: jest.fn().mockRejectedValue(new Error("db error")),
    } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(true) } as any;
    const service = new AdminVenuesService(prisma, boutique, venuesRepository);
    await expect(service.update("v1", { branchCount: 5 } as any)).rejects.toThrow("db error");
    expect(snapshotCommitted).toBe(false);
  });
});

describe("AdminVenuesService.revert", () => {
  it("takes a fresh snapshot of the current state, then applies the target version's snapshot", async () => {
    const targetSnapshot = { id: "v1", name: "Old Name", lat: 40.9, lng: 29.0, status: "PUBLISHED" };
    const txClient = {
      venueVersion: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "ver1", venueId: "v1", snapshot: targetSnapshot }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = { $transaction: jest.fn((fn) => fn(txClient)) } as any;
    const venuesRepository = {
      findRawForSnapshot: jest.fn().mockResolvedValue({ id: "v1", name: "Current Name", status: "PUBLISHED" }),
      updateWithLocation: jest.fn().mockResolvedValue({ id: "v1" }),
    } as any;
    const service = new AdminVenuesService(prisma, {} as any, venuesRepository);
    await service.revert("v1", "ver1");
    expect(txClient.venueVersion.create).toHaveBeenCalledWith({ data: { venueId: "v1", snapshot: expect.objectContaining({ name: "Current Name" }), createdBy: null } });
    expect(venuesRepository.updateWithLocation).toHaveBeenCalledWith(txClient, "v1", expect.objectContaining({ name: "Old Name" }));
  });

  it("throws NotFoundException if the version does not belong to the given venue", async () => {
    const txClient = { venueVersion: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "ver1", venueId: "OTHER_VENUE", snapshot: {} }) } };
    const prisma = { $transaction: jest.fn((fn) => fn(txClient)) } as any;
    const service = new AdminVenuesService(prisma, {} as any, { findRawForSnapshot: jest.fn() } as any);
    await expect(service.revert("v1", "ver1")).rejects.toThrow("Bu mekan için böyle bir versiyon bulunamadı");
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `cd apps/api && npx jest src/admin/venues/admin-venues.service.spec.ts`
Expected: FAIL — current `create`/`update`/`revert` don't match these signatures/behaviors.

- [ ] **Step 6: Implement `create()`, `update()`, `revert()`**

```typescript
import { snapshotToUpdateInput } from "../../venues/venues.repository";
// ...

create(input: AdminVenueCreateInput) {
    const status = input.status ?? "DRAFT";
    const isBoutique = this.boutique.evaluate({
      branchCount: input.branchCount,
      franchiseFlag: input.franchiseFlag,
      hasEditorialNote: !!input.editorialNote,
      status,
    });
    return this.venuesRepository.createWithLocation(this.prisma, {
      ...input,
      isBoutique,
      verifiedAt: new Date(),
      status,
      source: "MANUAL",
    });
}

async update(id: string, input: AdminVenueUpdateInput) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await this.venuesRepository.findRawForSnapshot(tx, id);
      await tx.venueVersion.create({ data: { venueId: id, snapshot: existing as any, createdBy: null } });

      const branchCount = input.branchCount ?? existing.branchCount;
      const franchiseFlag = input.franchiseFlag ?? existing.franchiseFlag;
      const hasEditorialNote = input.editorialNote !== undefined ? !!input.editorialNote : !!existing.editorialNote;
      const status = input.status ?? existing.status;
      const isBoutique = this.boutique.evaluate({ branchCount, franchiseFlag, hasEditorialNote, status });

      return this.venuesRepository.updateWithLocation(tx, id, { ...input, isBoutique, verifiedAt: new Date() });
    });
}

async revert(venueId: string, versionId: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const version = await tx.venueVersion.findUniqueOrThrow({ where: { id: versionId } });
      if (version.venueId !== venueId) {
        const notFound = new NotFoundException({ error: { code: "VENUE_VERSION_NOT_FOUND", message: "Bu mekan için böyle bir versiyon bulunamadı" } });
        notFound.message = "Bu mekan için böyle bir versiyon bulunamadı";
        throw notFound;
      }
      const current = await this.venuesRepository.findRawForSnapshot(tx, venueId);
      await tx.venueVersion.create({ data: { venueId, snapshot: current as any, createdBy: null } });
      return this.venuesRepository.updateWithLocation(tx, venueId, snapshotToUpdateInput(version.snapshot as any));
    });
}
```
(`createdBy: null` matches this plan's pattern elsewhere for system-initiated version rows where
no authenticated reviewer id is threaded through the controller yet — if the controller already
passes a reviewer id into `update`/`revert`, use that instead; check the current controller
signature before finalizing this step.)

- [ ] **Step 7: Update `apps/api/prisma/seed.ts`'s call site**

Change `venuesRepository.createWithLocation({...})` to `venuesRepository.createWithLocation(prisma, {...})`.

- [ ] **Step 8: Run test to verify it passes**

Run: `cd apps/api && npx jest src/admin/venues/admin-venues.service.spec.ts`
Expected: PASS (all, including pre-existing CSV-import-related tests in this file, which call
`create()` — verify the `status` default doesn't break the "CSV rows default to PUBLISHED per
Task 6" expectation; if `importRows()` currently calls `this.create({...})` without a `status`,
Task 6 updates that call site to pass one explicitly).

- [ ] **Step 9: Run the full admin/venues/rule-engine test suites (this task's scoped acceptance gate)**

Run: `cd apps/api && npx jest src/admin/venues src/rule-engine src/venues`
Expected: all pass. **Still not a whole-project typecheck** — `AdminQueueService`'s EDIT-branch
snapshot code (Task 7) and CSV import's `status` wiring (Task 6) are still pending.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/admin/venues/admin-venues.service.ts apps/api/src/rule-engine/boutique.service.ts apps/api/prisma/seed.ts
git commit -m "fix(api): admin venue update/revert atomic with location-inclusive snapshots, boutique rule requires PUBLISHED, partial-update field completion, seed.ts caller fixed"
```

---

## Task 6: CSV import defaults to PUBLISHED, passes `status`/`address` through

**Files:**
- Modify: `apps/api/src/admin/venues/admin-venues.service.ts` (the `importRows` method)
- Test: `apps/api/src/admin/venues/admin-venues.service.spec.ts` (append),
  `packages/shared/src/schemas/csv-venue-import.schema.spec.ts` (append — full-row parse)

**Interfaces:**
- Consumes: Task 2's `CsvVenueStatusSchema`/`address` on `CsvVenueImportRowSchema`, Task 5's `create()`
- Produces: CSV-imported venues default to `PUBLISHED` unless the CSV row explicitly says `DRAFT`;
  `address` from the CSV row reaches `createWithLocation`.

- [ ] **Step 1: Write the failing test for a full CSV row round-trip (not just the object schema)**

```typescript
// packages/shared/src/schemas/csv-venue-import.schema.spec.ts
import { parseCsvVenueRows } from "./csv-venue-import.schema"; // or wherever the CSV-string-to-rows parser lives -- check apps/api's csv-import.service.ts for the actual entry point and adjust this import

describe("CSV row parsing — empty and filled status cells in the same file", () => {
  it("parses a CSV with one row omitting status and one row setting DRAFT", () => {
    const csv = "name,slug,districtSlug,category,priceRange,branchCount,franchiseFlag,lat,lng,openingHours,status\n" +
      "A,a,kadikoy,cafe,MODERATE,1,false,40.99,29.02,\"{\"\"mon_fri\"\":\"\"09:00-18:00\"\"}\",\n" +
      "B,b,kadikoy,cafe,MODERATE,1,false,40.98,29.01,\"{\"\"mon_fri\"\":\"\"09:00-18:00\"\"}\",DRAFT\n";
    const result = parseCsvVenueRows(csv);
    expect(result[0].data?.status).toBeUndefined();
    expect(result[1].data?.status).toBe("DRAFT");
  });
});
```
(If `apps/api`'s CSV import already has its own parser test file covering the string-to-rows step,
add this case there instead of duplicating a parser import path in `packages/shared` — find it
with `find apps/api/src -iname "csv-import*"` and align the import/function name to what actually
exists before writing this step.)

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL or file/function not found — locate the real CSV-string parsing entry point first.

- [ ] **Step 3: Fix the parsing entry point / schema wiring so both cases pass** (no separate
      production code change should be needed here if Task 2's schema-level `status`/`address`
      preprocessing is correct — this step exists to catch a case Task 2's object-level tests
      couldn't: a real multi-row CSV string with a mix of empty and filled cells parsing through
      whatever CSV-string library this codebase uses, e.g. `papaparse` or a hand-rolled splitter).

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Write the failing test for `importRows`'s status/address default**

```typescript
describe("AdminVenuesService.importRows — status/address default", () => {
  it("defaults an imported venue to PUBLISHED when the CSV row has no status", async () => {
    const prisma = { venue: { findUnique: jest.fn().mockResolvedValue(null) }, district: { findUnique: jest.fn().mockResolvedValue({ id: "d1" }) } } as any;
    const venuesRepository = { createWithLocation: jest.fn().mockResolvedValue({ id: "v1" }) } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const service = new AdminVenuesService(prisma, boutique, venuesRepository);
    await service.importRows([{ row: 1, data: { name: "A", slug: "a", districtSlug: "kadikoy", category: "cafe", priceRange: "MODERATE", branchCount: 1, franchiseFlag: false, lat: 40.99, lng: 29.02, openingHours: {} } as any }]);
    expect(venuesRepository.createWithLocation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "PUBLISHED" }));
  });

  it("respects an explicit DRAFT status and passes address through", async () => {
    const prisma = { venue: { findUnique: jest.fn().mockResolvedValue(null) }, district: { findUnique: jest.fn().mockResolvedValue({ id: "d1" }) } } as any;
    const venuesRepository = { createWithLocation: jest.fn().mockResolvedValue({ id: "v1" }) } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const service = new AdminVenuesService(prisma, boutique, venuesRepository);
    await service.importRows([{ row: 1, data: { name: "A", slug: "a", districtSlug: "kadikoy", category: "cafe", priceRange: "MODERATE", branchCount: 1, franchiseFlag: false, lat: 40.99, lng: 29.02, openingHours: {}, status: "DRAFT", address: "Bahariye Cd. No:1" } as any }]);
    expect(venuesRepository.createWithLocation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "DRAFT", address: "Bahariye Cd. No:1" }));
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd apps/api && npx jest src/admin/venues/admin-venues.service.spec.ts -t "importRows"`

- [ ] **Step 7: Update `importRows`'s call to `this.create(...)`**

Find the object literal passed to `this.create({...})` inside `importRows` and add:
```typescript
          status: row.status ?? "PUBLISHED",
          address: row.address,
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd apps/api && npx jest src/admin/venues/admin-venues.service.spec.ts`
Expected: PASS (all).

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/admin/venues/admin-venues.service.ts packages/shared/src/schemas
git commit -m "feat(api): CSV import defaults venues to PUBLISHED, passes status/address through, real multi-row parse test"
```

---

## Task 7: `AdminQueueService` — REPORT/EDIT branching, location-safe snapshot, DI fix

**Files:**
- Modify: `apps/api/src/admin/queue/admin-queue.service.ts`
- Modify: `apps/api/src/admin/queue/admin-queue.module.ts`
- Test: `apps/api/src/admin/queue/admin-queue.service.spec.ts` (append/modify)

**Interfaces:**
- Consumes: Task 3's `findRawForSnapshot`
- Produces: `AdminQueueService.approve()` — `REPORT` type only flips `ContributionQueue.status`
  (no `Venue`/`VenueVersion` write at all); `EDIT` type keeps taking a location-inclusive snapshot
  + bumping `verifiedAt`. `AdminQueueModule` now imports `VenuesModule` so `VenuesRepository` can
  be injected. **This task fixes the last production caller of `findRawForSnapshot`.**

- [ ] **Step 1: Write the failing test**

```typescript
describe("AdminQueueService.approve — REPORT vs EDIT branching", () => {
  it("REPORT: only flips ContributionQueue status, never touches Venue or VenueVersion", async () => {
    const item = { id: "c1", type: "REPORT", venueId: "v1", status: "PENDING" };
    const txClient = {
      contributionQueue: { findUniqueOrThrow: jest.fn().mockResolvedValue(item), update: jest.fn().mockResolvedValue({}) },
      venue: { update: jest.fn() },
      venueVersion: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((fn) => fn(txClient)) } as any;
    const venuesRepository = { findRawForSnapshot: jest.fn() } as any;
    const service = new AdminQueueService(prisma, venuesRepository);
    await service.approve("c1", "curator-1");
    expect(venuesRepository.findRawForSnapshot).not.toHaveBeenCalled();
    expect(txClient.venue.update).not.toHaveBeenCalled();
    expect(txClient.venueVersion.create).not.toHaveBeenCalled();
    expect(txClient.contributionQueue.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1" }, data: expect.objectContaining({ status: "APPROVED" }) }));
  });

  it("EDIT (re_verify): takes a location-inclusive snapshot and bumps verifiedAt", async () => {
    const item = { id: "c2", type: "EDIT", venueId: "v1", status: "PENDING" };
    const snapshot = { id: "v1", lat: 40.99, lng: 29.02 };
    const txMock = {
      contributionQueue: { findUniqueOrThrow: jest.fn().mockResolvedValue(item), update: jest.fn().mockResolvedValue({}) },
      venue: { update: jest.fn().mockResolvedValue({}) },
      venueVersion: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((fn) => fn(txMock)) } as any;
    const venuesRepository = { findRawForSnapshot: jest.fn().mockResolvedValue(snapshot) } as any;
    const service = new AdminQueueService(prisma, venuesRepository);
    await service.approve("c2", "curator-1");
    expect(venuesRepository.findRawForSnapshot).toHaveBeenCalledWith(txMock, "v1");
    expect(txMock.venueVersion.create).toHaveBeenCalledWith({ data: { venueId: "v1", snapshot, createdBy: "curator-1" } });
    expect(txMock.venue.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { verifiedAt: expect.any(Date) } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/admin/queue/admin-queue.service.spec.ts -t "REPORT vs EDIT"`

- [ ] **Step 3: Update `AdminQueueService`'s constructor and `approve()`**

```typescript
constructor(private prisma: PrismaService, private venuesRepository: VenuesRepository) {}

async approve(id: string, reviewerId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const item = await tx.contributionQueue.findUniqueOrThrow({ where: { id } });
      if (item.status !== "PENDING") {
        throw alreadyProcessedError();
      }
      if (item.type === "EDIT" && item.venueId) {
        const snapshot = await this.venuesRepository.findRawForSnapshot(tx, item.venueId);
        await tx.venueVersion.create({ data: { venueId: item.venueId, snapshot, createdBy: reviewerId } });
        await tx.venue.update({ where: { id: item.venueId }, data: { verifiedAt: new Date() } });
      }
      // REPORT: intentionally does NOT touch Venue -- approving a "this info is wrong" report
      // means "we've reviewed it," not "we've confirmed it's accurate." Any actual correction
      // happens through a separate AdminVenuesService.update() call, which is what genuinely
      // bumps verifiedAt and records a VenueVersion (Task 5).
      return tx.contributionQueue.update({
        where: { id },
        data: { status: "APPROVED", reviewedBy: reviewerId, reviewedAt: new Date() },
      });
    });
}
```
(Import `VenuesRepository` from `../../venues/venues.repository`.)

- [ ] **Step 4: Wire `VenuesModule` into `AdminQueueModule`**

In `admin-queue.module.ts`, add `import { VenuesModule } from "../../venues/venues.module";` and
add `imports: [VenuesModule]` to the `@Module({...})` decorator.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && npx jest src/admin/queue/admin-queue.service.spec.ts`
Expected: PASS (all, including pre-existing `approve` tests for the EDIT path — update them to
inject `venuesRepository` into the constructor if they don't already).

- [ ] **Step 6: Verify the module actually boots** (catches DI wiring mistakes unit tests can't)

Run: `cd apps/api && npx jest test/app.e2e-spec.ts`
Expected: PASS — confirms `AdminQueueModule`'s new `VenuesModule` import doesn't create a circular
dependency or missing-provider error at boot time.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/admin/queue/admin-queue.service.ts apps/api/src/admin/queue/admin-queue.module.ts
git commit -m "fix(api): REPORT approval no longer mutates Venue/VenueVersion; EDIT approval snapshot includes location; wire VenuesModule into AdminQueueModule"
```

---

## Task 8: Remaining data-integrity fixes (B9, B10, B12, B13) + first whole-project typecheck

**Files:**
- Modify: `apps/api/src/favorites/favorites.service.ts`
- Modify: `apps/api/src/districts/districts.repository.ts` (or wherever `findNearestDistrict` lives)
- Modify: `apps/api/src/venues/venues.controller.ts` (bbox validation, UUID path params)
- Modify: `apps/api/src/auth/roles.guard.ts`
- Modify: `packages/shared/src/schemas/venue.schema.ts` (bbox schema)
- Test: corresponding `.spec.ts` files (append)

**Interfaces:**
- Consumes: nothing new
- Produces: `FavoritesService.addVenue` rejects non-`PUBLISHED` venues; `findNearestDistrict`
  filters `status='PUBLISHED'` and returns `cityId`/`slug`; bbox query validated by a Zod schema;
  every `:id` path param on venue/admin-venue routes validated as a UUID (B12); `RolesGuard`
  returns 401 (no user) vs 403 (wrong role) distinctly. **This is the first task where a
  whole-project `npx tsc --noEmit` and full `npx jest` run are valid acceptance gates** — every
  repository/service signature changed in Tasks 3-7 now has every caller updated.

- [ ] **Step 1: Write the failing test — `favorites.service.spec.ts`**

```typescript
describe("FavoritesService.addVenue — PUBLISHED check", () => {
  it("rejects adding a DRAFT venue with 404", async () => {
    const prisma = {
      favoriteList: { findUnique: jest.fn().mockResolvedValue({ id: "l1", userId: "u1" }) },
      venue: { findUnique: jest.fn().mockResolvedValue({ id: "v1", status: "DRAFT" }) },
    } as any;
    const service = new FavoritesService(prisma);
    await expect(service.addVenue("u1", "l1", "v1")).rejects.toThrow("Mekan bulunamadı");
  });
});
```

- [ ] **Step 2: Run test to verify it fails, then update `FavoritesService.addVenue`**

Add a check before the existing `upsert` call:
```typescript
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue || venue.status !== "PUBLISHED") {
      const notFound = new NotFoundException({ error: { code: "VENUE_NOT_FOUND", message: "Mekan bulunamadı" } });
      notFound.message = "Mekan bulunamadı";
      throw notFound;
    }
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd apps/api && npx jest src/favorites/favorites.service.spec.ts`

- [ ] **Step 4: Write the failing test for `findNearestDistrict` projection**

```typescript
describe("DistrictsRepository.findNearestDistrict — full projection + status filter", () => {
  it("selects cityId and slug in addition to id/name, and filters PUBLISHED venues", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ id: "d1", name: "Kadıköy", cityId: "c1", slug: "kadikoy" }]) } as any;
    const repo = new DistrictsRepository(prisma);
    const result = await repo.findNearestDistrict(40.99, 29.02);
    const sql = prisma.$queryRaw.mock.calls[0][0];
    const sqlText = sql.strings ? sql.strings.join("") : String(sql);
    expect(sqlText).toContain("cityId");
    expect(sqlText).toContain("slug");
    expect(sqlText).toContain("PUBLISHED");
    expect(result).toEqual({ id: "d1", name: "Kadıköy", cityId: "c1", slug: "kadikoy" });
  });
});
```

- [ ] **Step 5: Run test to verify it fails, then update the query**

```typescript
export interface NearestDistrictRow {
  id: string;
  name: string;
  cityId: string;
  slug: string;
}

async findNearestDistrict(lat: number, lng: number): Promise<NearestDistrictRow | undefined> {
    const rows = await this.prisma.$queryRaw<NearestDistrictRow[]>(
      Prisma.sql`
        SELECT d.id, d.name, d."cityId", d.slug
        FROM "District" d
        JOIN "Venue" v ON v."districtId" = d.id
        WHERE v.status = 'PUBLISHED'
        ORDER BY v.location <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        LIMIT 1
      `,
    );
    return rows[0];
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/api && npx jest src/districts`

- [ ] **Step 7: Add a `BboxQuerySchema` to `packages/shared/src/schemas/venue.schema.ts`**

```typescript
export const BboxQuerySchema = z.object({
  bbox: z.string().transform((s, ctx) => {
    const parts = s.split(",").map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "bbox must be 4 comma-separated finite numbers" });
      return z.NEVER;
    }
    const [minLng, minLat, maxLng, maxLat] = parts;
    if (minLng >= maxLng || minLat >= maxLat) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "bbox min must be less than max" });
      return z.NEVER;
    }
    return parts as [number, number, number, number];
  }),
});
```

- [ ] **Step 8: Write a real (non-placeholder) controller test for bbox validation**

```typescript
describe("VenuesController.mapView — bbox validation", () => {
  it("rejects a malformed bbox string with a Zod validation error, not a PostGIS crash", () => {
    const pipe = new ZodValidationPipe(BboxQuerySchema);
    expect(() => pipe.transform({ bbox: "not,numbers,here" }, {} as any)).toThrow();
  });

  it("rejects a bbox with only 3 parts", () => {
    const pipe = new ZodValidationPipe(BboxQuerySchema);
    expect(() => pipe.transform({ bbox: "29.0,40.9,29.1" }, {} as any)).toThrow();
  });

  it("accepts a well-formed bbox and produces 4 numbers", () => {
    const pipe = new ZodValidationPipe(BboxQuerySchema);
    const result = pipe.transform({ bbox: "29.0,40.9,29.1,41.0" }, {} as any);
    expect(result.bbox).toEqual([29.0, 40.9, 29.1, 41.0]);
  });
});
```
Run: `cd apps/api && npx jest src/venues/venues.controller.spec.ts -t bbox` — expected FAIL, then
wire `mapView`'s `@Query()` parameter to `new ZodValidationPipe(BboxQuerySchema)` (parameter-scoped,
same pattern as Task 4) replacing the current manual `bbox.split(",").map(Number)`, then PASS.

- [ ] **Step 9: Add UUID path-param validation (B12)**

Check whether `apps/api` already has a `ParseUUIDPipe`-equivalent in use anywhere (NestJS ships
`ParseUUIDPipe` built in). Apply it to every `:id`/`:venueId`/`:versionId` path param across
`venues.controller.ts` and the admin controllers that don't already have one, e.g.:
```typescript
@Get(":slug")
detail(@Param("slug") slug: string) { ... } // slug params: no change, not a UUID

@Get(":id")
findOne(@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string) { ... }
```
Write a failing test per modified endpoint confirming a non-UUID `:id` produces 400, then apply
the pipe, then verify it passes. (Exact endpoint list depends on reading the current controllers
— cover every admin venue/queue endpoint keyed by a `Venue`/`ContributionQueue`/`VenueVersion` id.)

- [ ] **Step 10: Write the failing test for `RolesGuard`'s 401/403 split**

```typescript
describe("RolesGuard — 401 vs 403", () => {
  it("throws UnauthorizedException (401) when there is no user", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["curator"]) } as any;
    const guard = new RolesGuard(reflector);
    const ctx = { switchToHttp: () => ({ getRequest: () => ({ user: undefined }) }), getHandler: () => ({}), getClass: () => ({}) } as any;
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("throws ForbiddenException (403) when the user's role is insufficient", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["curator"]) } as any;
    const guard = new RolesGuard(reflector);
    const ctx = { switchToHttp: () => ({ getRequest: () => ({ user: { role: "user" } }) }), getHandler: () => ({}), getClass: () => ({}) } as any;
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("allows access when the role matches", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["curator"]) } as any;
    const guard = new RolesGuard(reflector);
    const ctx = { switchToHttp: () => ({ getRequest: () => ({ user: { role: "curator" } }) }), getHandler: () => ({}), getClass: () => ({}) } as any;
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
```

- [ ] **Step 11: Run test to verify it fails, then update `RolesGuard`**

```typescript
canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new UnauthorizedException({ error: { code: "UNAUTHORIZED", message: "Giriş gerekli" } });
    }
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException({ error: { code: "FORBIDDEN", message: "Yetkiniz yok" } });
    }
    return true;
}
```

- [ ] **Step 12: Run test to verify it passes, then find and update every existing test across the
      codebase that asserts a bare-`false`/403 return from `RolesGuard` for the no-user case**

Run: `cd apps/api && npx jest src/auth` first, then:
Run: `cd apps/api && grep -rl "RolesGuard" src --include=*.spec.ts` to find all affected test
files (admin controllers/services, favorites, etc.) and update any assertion that expected a
plain `false`/generic 403 for the "no token" case to expect 401 instead.

- [ ] **Step 13: Run the FULL test suite and FULL typecheck (first valid whole-project gate)**

Run: `cd apps/api && npx jest && npx tsc --noEmit`
Expected: all pass, zero type errors — every repository signature change from Task 3 now has
every caller (seed.ts, AdminVenuesService, AdminQueueService, CSV import) updated.

- [ ] **Step 14: Commit**

```bash
git add apps/api/src/favorites apps/api/src/districts apps/api/src/venues apps/api/src/auth packages/shared/src/schemas
git commit -m "fix(api): favorites/nearest-district PUBLISHED checks, bbox and UUID path validation, 401 vs 403 split in RolesGuard"
```

---

## Task 9: Re-verify cron actually runs

**Files:**
- Modify: `apps/api/package.json` (add `@nestjs/schedule`), `apps/api/pnpm-lock.yaml` (regenerated)
- Modify: `apps/api/src/rule-engine/rule-engine.module.ts`, `re-verify.service.ts`
- Test: `apps/api/src/rule-engine/re-verify.service.spec.ts` (append)

**Interfaces:**
- Consumes: nothing new
- Produces: `ReVerifyService.enqueueStale()` runs daily via a named, registered cron job
  (`"re-verify-stale"`), verifiable via `SchedulerRegistry`.

- [ ] **Step 1: Add the dependency**

Run: `cd apps/api && pnpm add @nestjs/schedule`
This regenerates the workspace's `pnpm-lock.yaml` — include it in this task's commit.

- [ ] **Step 2: Write the failing test**

```typescript
import { Test } from "@nestjs/testing";
import { SchedulerRegistry, ScheduleModule } from "@nestjs/schedule";
import { ReVerifyService } from "./re-verify.service";
import { PrismaService } from "../prisma/prisma.service";

describe("ReVerifyService — cron registration", () => {
  it("registers a named daily cron job", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot()],
      providers: [ReVerifyService, { provide: PrismaService, useValue: {} }],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    const registry = app.get(SchedulerRegistry);
    expect(registry.getCronJob("re-verify-stale")).toBeDefined();
    await app.close();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/api && npx jest src/rule-engine/re-verify.service.spec.ts -t "cron registration"`
Expected: FAIL — no `@Cron` decorator exists yet.

- [ ] **Step 4: Add `ScheduleModule.forRoot()` to `RuleEngineModule` and the `@Cron` decorator**

In `rule-engine.module.ts`, import `ScheduleModule` from `@nestjs/schedule` and add it to `imports`.

In `re-verify.service.ts`, add:
```typescript
import { Cron, CronExpression } from "@nestjs/schedule";
// ...
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: "re-verify-stale" })
  async handleCron() {
    await this.enqueueStale();
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && npx jest src/rule-engine/re-verify.service.spec.ts`

- [ ] **Step 6: Run the full app boot test** (confirms `ScheduleModule` doesn't break bootstrap)

Run: `cd apps/api && npx jest test/app.e2e-spec.ts`

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json apps/api/pnpm-lock.yaml apps/api/src/rule-engine
git commit -m "feat(api): wire re-verify stale-venue job to a real daily cron"
```

---

## Task 10: Security hardening (B7, B14, B15, B16)

**Files:**
- Create: `apps/api/src/common/rate-limit.config.ts`, `apps/api/src/common/all-exceptions.filter.ts`
- Modify: `apps/api/src/reports/reports.controller.ts`, `venues.controller.ts`, `districts.controller.ts`, `favorites.controller.ts`
- Modify: `apps/api/src/admin/users/admin-users.service.ts`
- Modify: `apps/api/src/main.ts`
- Test: `apps/api/src/admin/users/admin-users.service.spec.ts` (append), `apps/api/src/common/all-exceptions.filter.spec.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: rate limit values read from env; `AdminUsersService.assignRole` restricted to
  `curator` only; Swagger disabled in production; a global exception filter that normalizes
  unhandled errors without touching existing `HttpException` behavior.

- [ ] **Step 1: Create `apps/api/src/common/rate-limit.config.ts`**

```typescript
export const RATE_LIMITS = {
  read: {
    limit: Number(process.env.RATE_LIMIT_READ_PER_MINUTE ?? 100),
    windowSeconds: 60,
  },
  report: {
    limit: Number(process.env.RATE_LIMIT_REPORT_PER_DAY ?? 10),
    windowSeconds: 86400,
  },
};
```
Replace every hardcoded `@RateLimit(100, 60)` with `@RateLimit(RATE_LIMITS.read.limit, RATE_LIMITS.read.windowSeconds)`
and `@RateLimit(10, 86400)` with `@RateLimit(RATE_LIMITS.report.limit, RATE_LIMITS.report.windowSeconds)`
across `venues.controller.ts`, `districts.controller.ts`, `favorites.controller.ts`,
`reports.controller.ts`. Add `RATE_LIMIT_READ_PER_MINUTE=100` and `RATE_LIMIT_REPORT_PER_DAY=10`
to `apps/api/.env.example`.

- [ ] **Step 2: Write a test proving the rate limit value is actually read from env, not just present in the config file**

```typescript
describe("RATE_LIMITS — env override", () => {
  const original = process.env.RATE_LIMIT_READ_PER_MINUTE;
  afterEach(() => { process.env.RATE_LIMIT_READ_PER_MINUTE = original; jest.resetModules(); });

  it("uses the env value when set", () => {
    process.env.RATE_LIMIT_READ_PER_MINUTE = "42";
    jest.resetModules();
    const { RATE_LIMITS } = require("./rate-limit.config");
    expect(RATE_LIMITS.read.limit).toBe(42);
  });

  it("falls back to 100 when unset", () => {
    delete process.env.RATE_LIMIT_READ_PER_MINUTE;
    jest.resetModules();
    const { RATE_LIMITS } = require("./rate-limit.config");
    expect(RATE_LIMITS.read.limit).toBe(100);
  });
});
```
Run: `cd apps/api && npx jest src/common/rate-limit.config.spec.ts` — expected PASS once Step 1's
file exists (write this test alongside Step 1, TDD order: test first, then the config file).

- [ ] **Step 3: Write the failing test — `admin-users.service.spec.ts`**

```typescript
describe("AdminUsersService.assignRole — MVP restricts to curator only", () => {
  it("rejects assigning the admin role in MVP", async () => {
    const prisma = { user: { update: jest.fn() } } as any;
    const service = new AdminUsersService(prisma);
    await expect(service.assignRole("u1", "admin")).rejects.toThrow("Bu rol MVP'de kullanılamaz (Faz 2)");
  });
});
```

- [ ] **Step 4: Run test to verify it fails, then change `MVP_ASSIGNABLE_ROLES` to `["curator"]`**

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && npx jest src/admin/users/admin-users.service.spec.ts`

- [ ] **Step 6: Guard Swagger behind `NODE_ENV`, with a test proving it**

```typescript
describe("bootstrap — Swagger production guard", () => {
  it("does not call SwaggerModule.setup when NODE_ENV=production", async () => {
    // Adjust to however apps/api/src/main.ts is structured for testability -- if bootstrap()
    // isn't currently an exported, independently-callable function, extract it as one so this
    // test can call it with a mocked NestFactory/SwaggerModule instead of spawning a real process.
  });
});
```
In `main.ts`, wrap the `SwaggerModule.setup("docs", app, document)` call:
```typescript
  if (process.env.NODE_ENV !== "production") {
    SwaggerModule.setup("docs", app, document);
  }
```

- [ ] **Step 7: Implement `AllExceptionsFilter` with a real behavioral test**

```typescript
import { ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { AllExceptionsFilter } from "./all-exceptions.filter";

function mockHost(status: jest.Mock, send: jest.Mock) {
  return {
    switchToHttp: () => ({ getResponse: () => ({ status: status.mockReturnValue({ send }) }), getRequest: () => ({}) }),
  } as unknown as ArgumentsHost;
}

describe("AllExceptionsFilter", () => {
  it("replies with the original HttpException's own status and body, unmodified", () => {
    const filter = new AllExceptionsFilter();
    const send = jest.fn();
    const status = jest.fn();
    const host = mockHost(status, send);
    const original = new HttpException({ error: { code: "TOO_MANY_REQUESTS", message: "Yavaşlayın" } }, HttpStatus.TOO_MANY_REQUESTS);
    filter.catch(original, host);
    expect(status).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
    expect(send).toHaveBeenCalledWith({ error: { code: "TOO_MANY_REQUESTS", message: "Yavaşlayın" } });
  });

  it("converts an unhandled non-HttpException error to the standard 500 envelope", () => {
    const filter = new AllExceptionsFilter();
    const send = jest.fn();
    const status = jest.fn();
    const host = mockHost(status, send);
    filter.catch(new Error("boom"), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(send).toHaveBeenCalledWith({ error: { code: "INTERNAL_ERROR", message: "Beklenmeyen bir hata oluştu" } });
  });
});
```

```typescript
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception instanceof HttpException) {
      // Never touch an exception NestJS's own pipeline already knows how to render correctly
      // (401/403/404/409/429 with Retry-After, etc.) -- reply with its own status/body directly.
      response.status(exception.getStatus()).send(exception.getResponse());
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: { code: "INTERNAL_ERROR", message: "Beklenmeyen bir hata oluştu" },
    });
  }
}
```

- [ ] **Step 8: Wire it globally in `main.ts`**

```typescript
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
// ...
  app.useGlobalFilters(new AllExceptionsFilter());
```
(Add this before `await app.listen(...)`.)

- [ ] **Step 9: Run test to verify it passes**

Run: `cd apps/api && npx jest src/common/all-exceptions.filter.spec.ts`

- [ ] **Step 10: Run the full test suite once more to confirm the global filter doesn't change
      any existing endpoint's observable status code/body, including the Retry-After header**

Run: `cd apps/api && npx jest`
Expected: all pass, unchanged from Task 8's baseline — if anything breaks, the filter is altering
existing HttpException behavior, which the design explicitly forbids. In particular, re-run
whatever test currently asserts the `Retry-After` header on a 429 response (from Plan 1) and
confirm the header still appears with this filter registered.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/common apps/api/src/reports apps/api/src/venues apps/api/src/districts apps/api/src/favorites apps/api/src/admin/users apps/api/src/main.ts apps/api/.env.example
git commit -m "feat(api): env-configurable rate limits, MVP-only curator role assignment, prod-gated Swagger, global exception filter"
```

---

## Task 11: Full regression pass and manual smoke verification

**Files:** none created — this task verifies the whole plan's diff together.

- [ ] **Step 1: Run the complete test suite**

Run: `cd apps/api && npx jest && cd ../../packages/shared && npx vitest run`
Expected: 100% pass, no skipped tests.

- [ ] **Step 2: Typecheck and lint everything this plan touched**

Run: `pnpm exec turbo run typecheck lint --filter=@gurmego/api... --filter=@gurmego/shared`
Expected: clean (only pre-existing documented warnings, per Plan 4a's established baseline).

- [ ] **Step 3: Manual verification — publish a venue end to end (NOT an automated acceptance
      gate; this step requires a human-obtained curator JWT and a real district id, and is
      recorded here as a one-time confidence check, not a repeatable CI step)**

Using the real local Supabase stack (`npx supabase status` from repo root for current ports),
start the API (`cd apps/api && npx ts-node -T src/main.ts`) and, with a real curator JWT obtained
through the actual login flow (not fabricated), and a real district id read from
`SELECT id FROM "District" LIMIT 1`:
```bash
curl -X POST http://localhost:3001/v1/admin/venues -H "Authorization: Bearer <real-curator-jwt>" -H "Content-Type: application/json" -d '{"name":"Smoke Test Cafe","slug":"smoke-test-cafe","districtId":"<real-district-id>","category":"cafe","priceRange":"MODERATE","openingHours":{"mon_fri":"09:00-18:00"},"branchCount":1,"franchiseFlag":false,"lat":40.99,"lng":29.02,"status":"PUBLISHED"}'
curl http://localhost:3001/v1/venues
```
Expected: the second call's response includes "Smoke Test Cafe". If it doesn't, this is a real
regression to investigate before considering A1 fixed — but the automated proof of A1 is Task 5's
and Task 6's test suites (admin create with `status`, CSV import defaulting to `PUBLISHED`), not
this manual step.

- [ ] **Step 4: Update `docs/STATE.md` and `docs/SESSION-LOG-2026-07-26.md`**

Record Plan 4b complete, ready for the final whole-branch review (Superpowers reviewer +
`cross-model-review`, per the standing project rule — both mandatory, neither optional).

---

## Self-Review Notes (completed during plan authoring, revised after round-1 plan-red-team)

- **Spec coverage:** every numbered finding from `docs/AUDIT-2026-07-26.md`'s backend section
  (A1, A2 backend half, A3, A4, A5 deferred per user decision, B1 deferred per design, B2 deferred
  to Plan 4a, B3-B16) maps to a task above, including B11/B12 which round 1 caught as missing.
- **Placeholder scan:** the round-1-flagged placeholders (bbox test, AllExceptionsFilter test,
  admin-queue REPORT test, Task 6's CSV parser step) were replaced with real assertions or an
  explicit "find the real entry point first" instruction where the exact current file layout is
  unknown to this plan's author.
- **Type consistency:** `AdminVenueCreateInput`/`UpdateInput` (Task 2) flow unchanged into
  `CreateVenueWithLocationInput`/`UpdateVenueWithLocationInput` (Task 3) via `AdminVenuesService`
  (Task 5) — field names match throughout. `VenueSearchFilters` (Task 3) is consumed by
  `VenuesService.list` (Task 4) exactly as constructed. `snapshotToUpdateInput` (Task 3) closes
  the round-1-flagged untyped `revert()` gap.
- **Sequencing fixed:** Task 3 is now a single atomic unit for the repository signature change;
  Tasks 4 (venues/districts controllers), 5 (AdminVenuesService + seed.ts), 6 (CSV), and 7
  (AdminQueueService) each fix exactly the callers they own, in dependency order; Task 8 is the
  first point where every caller is fixed and a whole-project `tsc --noEmit`/`jest` run is a valid
  gate. No task between 3 and 7 claims a whole-project typecheck passes.
