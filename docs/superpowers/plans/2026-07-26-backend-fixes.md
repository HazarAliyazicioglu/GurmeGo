# GurmeGo — Plan 4b: Backend Kritik Düzeltmeler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every backend finding from `docs/AUDIT-2026-07-26.md` so the pilot can actually
function — most critically, make it possible to publish a venue at all, and stop the location
header contract / data-integrity / security gaps documented in
`docs/superpowers/specs/2026-07-26-backend-fixes-design.md` (HAZIR after 5 idea-red-team rounds).

## Red-team geçmişi

**Round 1 (Codex, YENİDEN BÖL):** Repository imza değişikliği (eski Task 3) production çağrı
noktalarını (seed.ts, AdminVenuesService, AdminQueueService) 2-3 task sonra düzeltiyordu; aradaki
`tsc`/`jest` iddiaları gerçekte FAIL verirdi. Ayrıca B11/B12 eksik, CSV `address` şemada yoktu,
`open_now`'ın fail-open gereksinimi PostgreSQL three-valued logic'iyle uyumsuzdu, `revert()` `any`
ile tip güvenliğini bypass ediyordu, ADR 002 `DistrictsRepository`'nin raw SQL kullanımıyla
çelişiyordu.

**Round 2 (Codex, YENİDEN BÖL):** Round 1'in düzeltmesi sorunu **çözmek yerine sadece
etiketlemişti** — Task 3 hâlâ imzayı değiştirip caller'ları (Task 5/7) sonraya bırakıyordu, sadece
"bu ara adımda typecheck çalıştırma" notu eklenmişti. Ayrıca: `snapshotToUpdateInput`'ın ürettiği
tipler `UpdateVenueWithLocationInput`'la uyuşmuyordu (nullable alanlar için `null` kabul etmiyordu,
zorunlu `as any` gerektiriyordu); CSV parser testi hâlâ "adjust this import" placeholder'ıydı;
Swagger testi çalıştırılamaz bir placeholder'dı; `AllExceptionsFilter` tasarımın istediği gibi
`HttpException`'ları Nest'in kendi mekanizmasına bırakmıyordu (elle `send()` çağırıyordu — bu
`Retry-After` gibi Nest-yönetimli header'ları koruduğunu kanıtlamıyordu); Task 8/10 birbirinden
bağımsız birden fazla sözleşmeyi tek task'a yığıyordu; B12 için hangi endpoint'lerin UUID
doğrulaması alacağı somut değildi.

**Bu round (3): gerçek kod okundu, placeholder'lar kaldırıldı.**
- Eski Task 3+4+5+7 (repository + VenuesService/Controller + DistrictsController +
  AdminVenuesService/seed.ts + AdminQueueService) artık **tek bir atomik Task 3**. Repository
  imzası değişip aynı task içinde her çağıranı günceller — hiçbir ara commit'te proje derlenmez
  durumda bırakılmıyor, tüm `apps/api` `tsc --noEmit`/`jest` bu task'ın kendi sonunda geçerli bir
  kabul kriteri.
- `UpdateVenueWithLocationInput`'ın nullable alanları (`cuisineType`/`transportNote`/
  `editorialNote`/Google alanları/`address`) artık açıkça `T | null` kabul ediyor — `revert()`
  `snapshotToUpdateInput()`'un ürettiği değeri `any` olmadan geçirebiliyor.
- `apps/api/src/admin/venues/csv-import.service.ts`'in gerçek `CsvImportService.parseRows(csv)`
  metoduna karşı gerçek bir test yazıldı (placeholder import yok).
- `apps/api/src/main.ts`'in gerçek `bootstrap()` fonksiyonu export edilip test edilebilir hale
  getirildi; Swagger testi artık çalıştırılabilir.
- `AllExceptionsFilter` artık `BaseExceptionFilter`'ı extend edip `HttpException` durumunda
  `super.catch()`'e delege ediyor — Nest'in kendi `Retry-After` vb. header mantığına dokunmuyor.
- B12 (UUID path doğrulama) artık gerçek `grep` sonucuna dayanan somut bir endpoint listesi:
  `admin-queue.controller.ts` (approve/reject `:id`), `admin-users.controller.ts` (assignRole
  `:id`), `admin-venues.controller.ts` (update `:id`, revert `:id`/`:versionId`),
  `favorites.controller.ts` (addVenue `:id`), `reports.controller.ts` (submit `:id`).
  `venues.controller.ts`'in `:slug` parametresi UUID değil, dokunulmuyor.
- Task 8/10 (round 2'nin "bağımsız sözleşmeleri tek task'a yığıyor" bulgusu) ayrı task'lara
  bölündü: rate-limit config, admin rol kısıtlaması, Swagger prod guard, exception filter artık
  dört ayrı task (10-13).
- Round 2'nin "rollback testi dairesel" bulgusu: mock-tabanlı test kaldırıldı, yerine gerçek
  Postgres'e karşı çalışan bir entegrasyon testi kondu (Task 3, Adım 24).

**Reddedilen bulgular (round 1+2, gerekçeli):**
- "ADR 001'in Postgres seçimi MVP'de process-içi store'dan daha iyi değil" — reddedildi. Gerekçe:
  restart'ta process-içi store sıfırlanır, Postgres `unlogged` tablo bu riski taşımadan aynı
  basitliği veriyor (ADR 001). Yanlışsa: gereksiz DB round-trip, ADR 001'in kendi p95 sinyaliyle
  yakalanır.
- "ADR 004 için coarsened/geohash konum değerlendirilmeliydi" — kısmen kabul (Cache-Control/CORS
  riskleri ADR 004'e zaten erken-uyarı olarak işlendi), kısmen ret (geohash'e geçmek MVP kapsamını
  orantısız genişletir). Yanlışsa: bir CDN header'ı loglarsa tam koordinat sızar — ADR 004 bu
  riski zaten kayıtlı tutuyor.
- "Rate limit `?? 100`/`?? 10` fallback'i 'asla hardcode' kuralına aykırı" — reddedildi. Gerekçe:
  bu env okuma + geliştirici-dostu varsayılan, rule-engine eşiklerinin (butik limiti gibi) iş
  mantığına gömülmesinden farklı — env değişkeni her zaman öncelikli, sadece yerel geliştirmede
  `.env` eksikse süreç çökmesin diye var. Yanlışsa: production'da env unutulursa sessizce 100/10
  kullanılır — bu riski azaltmak için Task 10'a "prod'da env zorunlu, unset ise boot-time uyarı"
  eklendi.
- "Cursor pagination'ın limit varsayılanının yükseltilmesi somut değil" — kabul edilmedi, kapsam
  dışı bırakıldı: bu, design doc'un round 3'ünde zaten "bu pilot ölçeğinde ertele" kararına bağlı
  (bkz. `docs/STATE.md` "Denenmiş ve ELENMİŞ yaklaşımlar"); Plan 4b'nin kapsamı değil.
- "B1 (JWT issuer/audience yorumu) netleştirilmedi" — kabul edilmedi, kapsam dışı: B1 design doc'ta
  zaten Plan 4b kapsamı dışına, `docs/CHANGELOG.md`'nin "ertelenen takip maddeleri"ne yazılmıştı.

**Architecture:** No new modules. Existing `VenuesRepository` (raw-SQL, ADR 002) becomes
transaction-aware. A new `@UserLocationParam()` decorator reads `X-User-Location` (ADR 004). Zod
schemas in `packages/shared` gain `status`/`openNow`/corrected optional-boolean; sort-default logic
moves from schema `.transform()` to `VenuesService` because headers aren't visible during Zod parsing.

**Tech Stack:** NestJS 10 (Fastify), Prisma 5 + raw `$queryRaw` (PostGIS), Zod, Jest,
`@nestjs/schedule` (Task 9).

## Global Constraints

- TypeScript `strict: true`; `any` forbidden unless justified inline with a comment explaining why
  no narrower type is possible (e.g. reading a Prisma `Json` column back into a known shape).
- All API input validated via Zod schemas from `packages/shared`.
- PostGIS raw SQL only in `*.repository.ts` files (ADR 002, amended 2026-07-26 to cover the
  file-pattern, not one named file).
- Rule engine thresholds read from env, never hardcoded into business logic.
- `ContributionQueue` remains the only entry point for user contributions into `Venue`.
- Migration: only `prisma migrate`.
- User location travels only via the `X-User-Location` HTTP header (ADR 004), never a query param,
  never logged (NFR-04).
- No `origin` git remote in this repo — local command reproduction is the acceptance proof.
- Read `npx supabase status` for real local ports before running migrations.
- **A `npx tsc --noEmit`/`npx jest` run is only a valid acceptance step once every call site of a
  changed signature has been updated.** Task 3 is the one place a repository signature changes,
  and it updates every one of its callers before its own acceptance gate — no other task in this
  plan changes a signature with callers outside itself.

---

## Task 1: Migration — `Venue.address` and `Venue.photos`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_venue_address_photos/migration.sql` (generated)

**Interfaces:**
- Consumes: nothing
- Produces: `Venue.address: String?`, `Venue.photos: String[]` (default `[]`) — consumed by Task 3.

- [ ] **Step 1:** Add to the `Venue` model in `apps/api/prisma/schema.prisma`, after `transportNote`:
```prisma
  transportNote     String?
  address           String?
  photos            String[]            @default([])
```
- [ ] **Step 2:** Run: `cd apps/api && npx prisma migrate dev --name add_venue_address_photos`
Expected: `Your database is now in sync with your schema.`
- [ ] **Step 3:** Run: `cd apps/api && npx prisma generate`
- [ ] **Step 4:** Commit
```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add Venue.address and Venue.photos columns"
```

---

## Task 2: Shared schema contract updates

**Files:**
- Modify: `packages/shared/src/schemas/admin-venue.schema.ts`, `csv-venue-import.schema.ts`,
  `venue.schema.ts`, `admin-queue.schema.ts`
- Test: `packages/shared/src/schemas/admin-venue.schema.spec.ts` (new),
  `csv-venue-import.schema.spec.ts`, `venue.schema.spec.ts`, `admin-queue.schema.spec.ts` (append)

**Interfaces:**
- Consumes: nothing
- Produces: `AdminVenueCreateSchema`/`UpdateSchema` with `status`/`address`/`photos`;
  `CsvVenueStatusSchema = z.enum(["DRAFT","PUBLISHED"])` and `address` on `CsvVenueImportRowSchema`;
  `OptionalTrueFlag` helper; `VenueListQuerySchema` with `openNow`, corrected `isBoutique`, no
  `lat`/`lng`; `VenueDetailSchema` with `lat`/`lng`/`address`/`photos`; `AdminQueueItemSchema`/
  `MutationResultSchema` with `type: "REPORT" | "EDIT"`. Consumed by Task 3 (all of it) and Plan 4c.

- [ ] **Step 1: Write the failing test — `admin-venue.schema.spec.ts`** (new file)
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
  it("leaves status undefined when omitted", () => {
    const result = AdminVenueCreateSchema.safeParse(BASE);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBeUndefined();
  });
  it("rejects an invalid status value", () => {
    expect(AdminVenueCreateSchema.safeParse({ ...BASE, status: "PUBLISHD" }).success).toBe(false);
  });
  it("accepts optional address and photos", () => {
    expect(AdminVenueCreateSchema.safeParse({ ...BASE, address: "Bahariye Cd. No:1", photos: ["https://x/1.jpg"] }).success).toBe(true);
  });
});

describe("AdminVenueUpdateSchema", () => {
  it("is fully partial and still accepts status", () => {
    expect(AdminVenueUpdateSchema.safeParse({ status: "ARCHIVED" }).success).toBe(true);
  });
});
```
- [ ] **Step 2:** Run: `cd packages/shared && npx vitest run src/schemas/admin-venue.schema.spec.ts` — expect FAIL.
- [ ] **Step 3:** In `admin-venue.schema.ts`, import `VenueStatusSchema` from `./venue.schema` and add to
`AdminVenueCreateSchema` (after `franchiseFlag`):
```typescript
  status: VenueStatusSchema.optional(),
  address: z.string().max(500).optional(),
  photos: z.array(z.string().url()).max(20).optional(),
```
- [ ] **Step 4:** Run test again — expect PASS (5 tests).

- [ ] **Step 5: Write the failing test — `csv-venue-import.schema.spec.ts`**
```typescript
import { CsvVenueImportRowSchema } from "./csv-venue-import.schema";

describe("CsvVenueImportRowSchema status/address columns", () => {
  const BASE_ROW = {
    name: "Test", slug: "test", districtSlug: "kadikoy", category: "cafe",
    priceRange: "MODERATE" as const, branchCount: "1", franchiseFlag: "false" as const,
    lat: "40.99", lng: "29.02", openingHours: '{"mon_fri":"09:00-18:00"}',
  };
  it("treats an empty status cell as undefined", () => {
    const r = CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, status: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBeUndefined();
  });
  it("accepts DRAFT", () => {
    const r = CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, status: "DRAFT" });
    expect(r.success && r.data.status).toBe("DRAFT");
  });
  it("rejects ARCHIVED — CSV import can only produce DRAFT or PUBLISHED", () => {
    expect(CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, status: "ARCHIVED" }).success).toBe(false);
  });
  it("parses fine when status column is absent entirely", () => {
    expect(CsvVenueImportRowSchema.safeParse(BASE_ROW).success).toBe(true);
  });
  it("accepts an address column, treats empty as undefined", () => {
    const r1 = CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, address: "Bahariye Cd. No:1" });
    expect(r1.success && r1.data.address).toBe("Bahariye Cd. No:1");
    const r2 = CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, address: "" });
    expect(r2.success && r2.data.address).toBeUndefined();
  });
});
```
- [ ] **Step 6:** Run — expect FAIL.
- [ ] **Step 7:** In `csv-venue-import.schema.ts`, add:
```typescript
// Narrower than VenueStatusSchema (no ARCHIVED) -- CSV import only creates new venues.
export const CsvVenueStatusSchema = z.enum(["DRAFT", "PUBLISHED"]);
```
and add to the row object:
```typescript
  status: z.preprocess((v) => (v === "" ? undefined : v), CsvVenueStatusSchema.optional()),
  address: z.preprocess((v) => (v === "" ? undefined : v), z.string().max(500).optional()),
```
- [ ] **Step 8:** Run — expect PASS (5 tests).

- [ ] **Step 9: Write the failing test — `venue.schema.spec.ts`**
```typescript
import { OptionalTrueFlag, VenueListQuerySchema, VenueDetailSchema } from "./venue.schema";

describe("OptionalTrueFlag", () => {
  it("stays undefined when absent", () => expect(z.object({ flag: OptionalTrueFlag }).parse({}).flag).toBeUndefined());
  it("parses 'true' as true", () => expect(z.object({ flag: OptionalTrueFlag }).parse({ flag: "true" }).flag).toBe(true));
  it("rejects 'false'", () => expect(z.object({ flag: OptionalTrueFlag }).safeParse({ flag: "false" }).success).toBe(false));
});

describe("VenueListQuerySchema", () => {
  it("no longer accepts lat/lng", () => {
    const parsed = VenueListQuerySchema.parse({ lat: "40.99", lng: "29.02" });
    expect((parsed as any).lat).toBeUndefined();
  });
  it("openNow=true parses, openNow=false rejects", () => {
    expect(VenueListQuerySchema.parse({ openNow: "true" }).openNow).toBe(true);
    expect(VenueListQuerySchema.safeParse({ openNow: "false" }).success).toBe(false);
  });
  it("isBoutique=false rejects", () => {
    expect(VenueListQuerySchema.safeParse({ isBoutique: "false" }).success).toBe(false);
  });
});

describe("VenueDetailSchema", () => {
  const FULL = {
    id: "d290f1ee-6c54-4b01-90e6-d701748f0851", slug: "x", name: "X", category: "cafe",
    cuisineType: null, priceRange: "MODERATE", signatureItems: [], transportNote: null,
    openingHours: {}, editorialNote: null, isBoutique: false,
    verifiedAt: "2026-07-24T00:00:00.000Z", source: "MANUAL", googleRating: null,
    googleRatingCount: null, googlePlaceId: null, district: { name: "Kadıköy", slug: "kadikoy" },
    lat: 40.99, lng: 29.02, address: null, photos: [],
  };
  it("accepts the full new shape", () => expect(VenueDetailSchema.safeParse(FULL).success).toBe(true));
  it("rejects when lat/lng are missing (proves the fields are actually required, not stripped-and-ignored)", () => {
    const { lat, lng, ...withoutCoords } = FULL;
    expect(VenueDetailSchema.safeParse(withoutCoords).success).toBe(false);
  });
  it("round-trips address/photos through parse (proves they're captured, not silently stripped)", () => {
    const parsed = VenueDetailSchema.parse({ ...FULL, address: "Bahariye Cd. No:1", photos: ["p1"] });
    expect(parsed.address).toBe("Bahariye Cd. No:1");
    expect(parsed.photos).toEqual(["p1"]);
  });
});
```
- [ ] **Step 10:** Run — expect FAIL.
- [ ] **Step 11:** In `venue.schema.ts`, add:
```typescript
// `z.coerce.boolean()` is a footgun: Boolean("false") is true. A naive
// z.literal("true").optional().transform(v => v === "true") is ALSO wrong -- when absent, v is
// undefined, and undefined === "true" is false, collapsing "not requested" into "explicitly off".
export const OptionalTrueFlag = z.literal("true").optional().transform((v) => (v === undefined ? undefined : true));
```
Read the current file, remove `lat`/`lng` and any sort-default `.transform()` from
`VenueListQuerySchema` (moves to `VenuesService`, Task 3), replace `isBoutique: z.coerce.boolean().optional()`
with `isBoutique: OptionalTrueFlag`, add `openNow: OptionalTrueFlag`. Preserve every other field
(`districtId`/`category`/`priceRange`/`radiusM`/`sort`/`limit`/`cursor`) exactly as-is.
Add to `VenueDetailSchema` after `district`:
```typescript
  lat: z.number(),
  lng: z.number(),
  address: z.string().nullable(),
  photos: z.array(z.string()),
```
- [ ] **Step 12:** Run — expect PASS (all).

- [ ] **Step 13: Write the failing test — `admin-queue.schema.spec.ts`** (read the real current
      schema's required fields first, adjust `base` to match)
```typescript
describe("AdminQueueItemSchema / AdminQueueMutationResultSchema type enum", () => {
  it("accepts type EDIT, not just REPORT", () => {
    const base = { id: "d290f1ee-6c54-4b01-90e6-d701748f0851", status: "PENDING", createdAt: "2026-07-24T00:00:00.000Z" };
    expect(AdminQueueItemSchema.safeParse({ ...base, type: "EDIT", payload: { kind: "re_verify" }, urgent: false }).success).toBe(true);
    expect(AdminQueueMutationResultSchema.safeParse({ ...base, type: "EDIT" }).success).toBe(true);
  });
});
```
- [ ] **Step 14:** Run — FAIL, then change both schemas' `type` from `z.literal("REPORT")` to
`z.enum(["REPORT", "EDIT"])`, run again — PASS.

- [ ] **Step 15:** Run: `cd packages/shared && npx vitest run && npx tsc --noEmit` — expect all pass.
- [ ] **Step 16:** Commit
```bash
git add packages/shared/src/schemas
git commit -m "feat(shared): add status/address/photos fields, fix optional-boolean pattern, widen admin-queue type enum"
```

---

## Task 3: `VenuesRepository` transaction-aware rewrite AND every one of its callers (single atomic task)

This is the task both prior red-team rounds flagged as broken: a repository signature change
whose callers were fixed in later tasks, leaving every intermediate commit non-compiling. This
version changes the repository AND updates `VenuesService`, `VenuesController`,
`DistrictsController`/`DistrictsRepository`, `AdminVenuesService`, `apps/api/prisma/seed.ts`, and
`AdminQueueService`/`AdminQueueModule` — all in this one task, before its own acceptance gate.

**Files:**
- Modify: `apps/api/src/venues/venues.repository.ts`, `venues.service.ts`, `venues.controller.ts`
- Create: `apps/api/src/common/user-location.decorator.ts`
- Modify: `apps/api/src/districts/districts.controller.ts`, `districts.repository.ts` (or
  wherever `findNearestDistrict` lives)
- Modify: `apps/api/src/admin/venues/admin-venues.service.ts`, `apps/api/prisma/seed.ts`
- Modify: `apps/api/src/admin/queue/admin-queue.service.ts`, `admin-queue.module.ts`
- Modify: `apps/api/src/rule-engine/boutique.service.ts`
- Test: `venues.repository.spec.ts`, `venues.service.spec.ts`, `venues.controller.spec.ts`,
  `common/user-location.decorator.spec.ts`, `districts.controller.spec.ts`, `districts.repository.spec.ts`
  (or wherever), `admin-venues.service.spec.ts`, `admin-queue.service.spec.ts`,
  `boutique.service.spec.ts`, `apps/api/test/app.e2e-spec.ts` (append), a new real-DB integration
  test file (Step 24).

**Interfaces:**
- Consumes: Task 2's `AdminVenueCreateInput`/`UpdateInput`/`VenueListQuery`
- Produces (final state after this task, no intermediate broken state):
  - `createWithLocation(client, input)`, `updateWithLocation(client, id, input)` — Prisma client
    (`PrismaService` or `Prisma.TransactionClient`) as first arg.
  - `findRawForSnapshot(client, id): Promise<AdminVenueRow>`.
  - `findBySlug(slug)` returns `lat`/`lng`/`address`/`photos`/nested `district: {name, slug}`.
  - `searchPublished(filters: VenueSearchFilters)` honors `openNow`; internal type
    `VenueSearchFilters = Omit<VenueListQuery, "sort"> & { sort: "distance"|"newest"; lat?: number; lng?: number }`.
  - `snapshotToUpdateInput(row: AdminVenueRow): UpdateVenueWithLocationInput`.
  - `UserLocationParam`/`parseUserLocationHeader` (new file).
  - `VenuesService.list(query, location)` — sort default computed here, not in the Zod schema.
  - `AdminVenuesService.create/update/revert` — status-aware, transactional, atomic snapshot.
  - `AdminQueueService.approve` — REPORT/EDIT branching, location-safe EDIT snapshot.
  - `BoutiqueService.evaluate` — takes `status`, gates on `PUBLISHED`.
  - **Every one of these is used by every other caller in the same commit set. Nothing outside
    this task references the old signatures by the time this task's own tests run.**

### Part A — Repository core

- [ ] **Step 1: Write the failing tests for client-parameter + Google fields + B11**
```typescript
describe("VenuesRepository.createWithLocation — client parameter and Google fields", () => {
  it("accepts an explicit Prisma client as the first argument", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1" }]) } as any;
    const repo = new VenuesRepository({} as any);
    const result = await repo.createWithLocation(client, {
      name: "A", slug: "a", districtId: "d1", category: "cafe", priceRange: "MODERATE",
      signatureItems: [], openingHours: {}, isBoutique: false, branchCount: 1, franchiseFlag: false,
      source: "MANUAL", verifiedAt: new Date(), status: "DRAFT", lat: 40.99, lng: 29.02,
    });
    expect(client.$queryRaw).toHaveBeenCalled();
    expect(result).toEqual({ id: "v1" });
  });

  it("includes googleRating/googleRatingCount/googlePlaceId/address/photos in the INSERT", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1" }]) } as any;
    const repo = new VenuesRepository({} as any);
    await repo.createWithLocation(client, {
      name: "A", slug: "a", districtId: "d1", category: "cafe", priceRange: "MODERATE",
      signatureItems: [], openingHours: {}, isBoutique: false, branchCount: 1, franchiseFlag: false,
      source: "MANUAL", verifiedAt: new Date(), status: "DRAFT", lat: 40.99, lng: 29.02,
      googleRating: 4.5, googleRatingCount: 10, googlePlaceId: "place123", address: "Adres 1", photos: ["p1"],
    });
    const call = client.$queryRaw.mock.calls[0][0];
    const sqlText = call.strings.join("");
    expect(sqlText).toContain("googleRating");
    expect(call.values).toEqual(expect.arrayContaining([4.5, 10, "place123", "Adres 1"]));
  });
});

describe("VenuesRepository.updateWithLocation — B11 zero-coordinate handling", () => {
  it("includes a lat=0/lng=0 update (does not treat 0 as falsy-and-absent)", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1" }]) } as any;
    const repo = new VenuesRepository({} as any);
    await repo.updateWithLocation(client, "v1", { lat: 0, lng: 0 });
    const call = client.$queryRaw.mock.calls[0][0];
    expect(call.strings.join("")).toContain("location");
    expect(call.values).toContain(0);
  });

  it("accepts explicit null for nullable fields (needed by revert restoring a cleared field)", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1" }]) } as any;
    const repo = new VenuesRepository({} as any);
    await repo.updateWithLocation(client, "v1", { editorialNote: null, address: null });
    const call = client.$queryRaw.mock.calls[0][0];
    expect(call.values).toContain(null);
  });
});
```
- [ ] **Step 2:** Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts -t "client parameter|B11"` — expect FAIL (the real current `createWithLocation(input)`/`updateWithLocation(id, input)` take no client param, and don't write Google/address/photos — confirmed by reading the file).

- [ ] **Step 3: Update the interfaces in `venues.repository.ts`**
```typescript
export interface CreateVenueWithLocationInput {
  name: string;
  slug: string;
  districtId: string;
  category: string;
  cuisineType?: string;
  priceRange: string;
  signatureItems: string[];
  transportNote?: string;
  openingHours: Record<string, unknown>;
  editorialNote?: string;
  isBoutique: boolean;
  branchCount: number;
  franchiseFlag: boolean;
  source: string;
  verifiedAt: Date;
  status: string;
  lat: number;
  lng: number;
  googleRating?: number;
  googleRatingCount?: number;
  googlePlaceId?: string;
  address?: string;
  photos?: string[];
}

// Update semantics differ from create: `undefined` means "leave alone"; for the nullable-in-DB
// fields, `null` is a distinct, meaningful value ("clear this field") -- needed by revert()
// restoring a venue to a state where e.g. editorialNote was empty. Widen exactly those fields.
type NullableUpdateFields = "cuisineType" | "transportNote" | "editorialNote" | "googleRating" | "googleRatingCount" | "googlePlaceId" | "address";
export type UpdateVenueWithLocationInput = Partial<Omit<CreateVenueWithLocationInput, "lat" | "lng" | NullableUpdateFields>> & {
  lat?: number;
  lng?: number;
  cuisineType?: string | null;
  transportNote?: string | null;
  editorialNote?: string | null;
  googleRating?: number | null;
  googleRatingCount?: number | null;
  googlePlaceId?: string | null;
  address?: string | null;
  photos?: string[];
};
```
Update `ADMIN_VENUE_RETURNING` to also select `address, photos`.

- [ ] **Step 4: Rewrite `createWithLocation`**
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
Remove the constructor-injected `this.prisma` usage inside this method — it now only uses `client`.

- [ ] **Step 5: Rewrite `updateWithLocation`** — add the four new nullable assignments (Google
      fields, `address`, `photos`) alongside the existing per-field `!== undefined` checks (the
      existing `lat`/`lng` combined check at line 193 is already correct — no B11 bug there;
      verify this during implementation and only touch it if the live file differs from what was
      read), and change the signature to `(client: Pick<PrismaService, "$queryRaw">, id: string, input: UpdateVenueWithLocationInput)`,
      replacing `this.prisma.$queryRaw` with `client.$queryRaw`.
```typescript
    if (input.googleRating !== undefined) assignments.push(Prisma.sql`"googleRating" = ${input.googleRating}`);
    if (input.googleRatingCount !== undefined) assignments.push(Prisma.sql`"googleRatingCount" = ${input.googleRatingCount}`);
    if (input.googlePlaceId !== undefined) assignments.push(Prisma.sql`"googlePlaceId" = ${input.googlePlaceId}`);
    if (input.address !== undefined) assignments.push(Prisma.sql`address = ${input.address}`);
    if (input.photos !== undefined) assignments.push(Prisma.sql`photos = ${input.photos}`);
```
- [ ] **Step 6:** Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts -t "client parameter|B11"` — PASS (4 tests).

- [ ] **Step 7: Write the failing test for `findRawForSnapshot`**
```typescript
describe("VenuesRepository.findRawForSnapshot", () => {
  it("returns the full row including lat/lng via raw SQL", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1", lat: 40.99, lng: 29.02 }]) } as any;
    const repo = new VenuesRepository({} as any);
    const result = await repo.findRawForSnapshot(client, "v1");
    const sqlText = client.$queryRaw.mock.calls[0][0].strings.join("");
    expect(sqlText).toContain("ST_Y");
    expect(sqlText).toContain("ST_X");
    expect(result).toEqual({ id: "v1", lat: 40.99, lng: 29.02 });
  });
  it("throws NotFoundException when not found", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    const repo = new VenuesRepository({} as any);
    await expect(repo.findRawForSnapshot(client, "missing")).rejects.toThrow("Mekan bulunamadı");
  });
});
```
- [ ] **Step 8:** Run — FAIL, then implement:
```typescript
async findRawForSnapshot(client: Pick<PrismaService, "$queryRaw">, id: string): Promise<AdminVenueRow> {
    const rows = await client.$queryRaw<AdminVenueRow[]>(Prisma.sql`
      SELECT id, name, slug, "districtId", category, "cuisineType", "priceRange", "signatureItems",
        "transportNote", "openingHours", "editorialNote", "isBoutique", "branchCount", "franchiseFlag",
        source, "verifiedAt", status, "googleRating", "googleRatingCount", "googlePlaceId", featured,
        address, photos, "createdAt", "updatedAt",
        ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
      FROM "Venue" WHERE id = ${id}
    `);
    if (rows.length === 0) {
      const notFound = new NotFoundException({ error: { code: "VENUE_NOT_FOUND", message: "Mekan bulunamadı" } });
      notFound.message = "Mekan bulunamadı";
      throw notFound;
    }
    return rows[0];
}
```
- [ ] **Step 9:** Run — PASS (2 tests).

- [ ] **Step 10: Write the failing test for `snapshotToUpdateInput`**
```typescript
describe("snapshotToUpdateInput", () => {
  it("maps a raw snapshot row into a valid, fully-typed update input, no cast needed at the call site", () => {
    const row: AdminVenueRow = {
      id: "v1", name: "A", slug: "a", districtId: "d1", category: "cafe", cuisineType: null,
      priceRange: "MODERATE", signatureItems: [], transportNote: null, openingHours: {},
      editorialNote: null, isBoutique: false, branchCount: 1, franchiseFlag: false,
      source: "MANUAL", verifiedAt: new Date(), status: "PUBLISHED", googleRating: null,
      googleRatingCount: null, googlePlaceId: null, featured: false, address: null, photos: [],
      createdAt: new Date(), updatedAt: new Date(), lat: 40.99, lng: 29.02,
    };
    const input: UpdateVenueWithLocationInput = snapshotToUpdateInput(row);
    expect(input).toMatchObject({
      name: "A", slug: "a", districtId: "d1", category: "cafe", cuisineType: null,
      priceRange: "MODERATE", isBoutique: false, branchCount: 1, franchiseFlag: false,
      status: "PUBLISHED", googleRating: null, address: null, photos: [], lat: 40.99, lng: 29.02,
    });
  });
});
```
- [ ] **Step 11:** Run — FAIL, then implement:
```typescript
// Pure mapping, no DB access. revert() uses this to turn a VenueVersion snapshot back into a
// valid updateWithLocation input. Return type is UpdateVenueWithLocationInput directly (no `any`
// needed) because that type now accepts `null` for every field this function might restore to null.
export function snapshotToUpdateInput(row: AdminVenueRow): UpdateVenueWithLocationInput {
  return {
    name: row.name, slug: row.slug, districtId: row.districtId, category: row.category,
    cuisineType: row.cuisineType, priceRange: row.priceRange, signatureItems: row.signatureItems,
    transportNote: row.transportNote, openingHours: row.openingHours as Record<string, unknown>,
    editorialNote: row.editorialNote, isBoutique: row.isBoutique, branchCount: row.branchCount,
    franchiseFlag: row.franchiseFlag, status: row.status, googleRating: row.googleRating,
    googleRatingCount: row.googleRatingCount, googlePlaceId: row.googlePlaceId,
    address: row.address, photos: row.photos, lat: row.lat, lng: row.lng,
  };
}
```
- [ ] **Step 12:** Run — PASS.

- [ ] **Step 13: Write the failing test for `findBySlug`'s rewrite**
```typescript
describe("VenuesRepository.findBySlug — location and new fields", () => {
  it("returns lat/lng, address, photos, nested district via raw SQL, filters PUBLISHED", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{
      id: "v1", slug: "a", name: "A", lat: 40.99, lng: 29.02, address: "Adres 1", photos: ["p1"],
      district: { name: "Kadıköy", slug: "kadikoy" },
    }]) } as any;
    const repo = new VenuesRepository(prisma);
    const result = await repo.findBySlug("a");
    const sqlText = prisma.$queryRaw.mock.calls[0][0].strings.join("");
    expect(sqlText).toContain("ST_Y");
    expect(sqlText).toContain("json_build_object");
    expect(sqlText).toContain("status = 'PUBLISHED'");
    expect(result).toMatchObject({ lat: 40.99, lng: 29.02, address: "Adres 1", photos: ["p1"], district: { name: "Kadıköy", slug: "kadikoy" } });
  });
  it("returns undefined when not found", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    expect(await new VenuesRepository(prisma).findBySlug("missing")).toBeUndefined();
  });
});
```
- [ ] **Step 14:** Run — FAIL (current `findBySlug` uses `prisma.venue.findFirst`, no lat/lng),
      then replace with:
```typescript
async findBySlug(slug: string) {
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT v.id, v.slug, v.name, v.category, v."cuisineType", v."priceRange", v."signatureItems",
        v."transportNote", v."openingHours", v."editorialNote", v."isBoutique", v."verifiedAt",
        v.source, v."googleRating", v."googleRatingCount", v."googlePlaceId", v.address, v.photos,
        ST_Y(v.location::geometry) AS lat, ST_X(v.location::geometry) AS lng,
        json_build_object('name', d.name, 'slug', d.slug) AS district
      FROM "Venue" v JOIN "District" d ON d.id = v."districtId"
      WHERE v.slug = ${slug} AND v.status = 'PUBLISHED'
      LIMIT 1
    `);
    return rows[0];
}
```
- [ ] **Step 15:** Run — PASS (2 tests).

- [ ] **Step 16: Write the failing tests for `open_now`**
```typescript
describe("VenuesRepository.searchPublished — openNow", () => {
  it("adds a fail-open CASE barrier (PostgreSQL NOT(NULL) is NULL, not TRUE)", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    await new VenuesRepository(prisma).searchPublished({ sort: "newest", limit: 20, openNow: true } as any);
    const sqlText = prisma.$queryRaw.mock.calls[0][0].strings.join("");
    expect(sqlText).toContain("Europe/Istanbul");
    expect(sqlText).toMatch(/CASE\s+WHEN/i);
    expect(sqlText).toMatch(/ELSE\s+true/i);
  });
  it("adds no openNow condition when the filter is absent", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    await new VenuesRepository(prisma).searchPublished({ sort: "newest", limit: 20 } as any);
    expect(prisma.$queryRaw.mock.calls[0][0].strings.join("")).not.toContain("Europe/Istanbul");
  });
});
```
- [ ] **Step 17:** Run — FAIL.
- [ ] **Step 18: Add the internal type and condition.** Read the real `searchPublished` (shown
      above) — it currently takes `VenueListQuery` directly and computes `filters.lat`/`filters.sort`
      from it. Since Task 2 removed `lat`/`lng` from `VenueListQuery`, this signature must change
      to the internal `VenueSearchFilters` type in the SAME step (this is exactly the kind of
      in-file, same-task signature/caller pairing this task exists to guarantee):
```typescript
// Internal only. VenueListQuery no longer carries lat/lng (ADR 004) or a resolved sort;
// VenuesService.list() (Part B below) merges the header-derived location and computed sort in.
type VenueSearchFilters = Omit<VenueListQuery, "sort"> & { sort: "distance" | "newest"; lat?: number; lng?: number };
```
Change `searchPublished(filters: VenueListQuery)` to `searchPublished(filters: VenueSearchFilters)`.
Add, alongside the existing `conditions.push(...)` calls:
```typescript
    if (filters.openNow) {
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
(`ELSE true`: fail-open per PostgreSQL three-valued logic — `NOT(NULL)` is `NULL`, not `TRUE`, so a
plain `OR NOT (...)` fallback would silently exclude venues with missing/malformed hours instead
of including them as designed. The regex guards ensure the `::time` cast only runs on strings that
already match `HH:MM-HH:MM`.)
- [ ] **Step 19:** Run — PASS (2 tests).

- [ ] **Step 20:** Commit the repository-only portion so far is NOT done separately — continue to
      Part B in the same task; there is no intermediate commit inside Task 3 before every caller
      is updated (that is the entire point of merging these).

### Part B — Update every caller in the same task

- [ ] **Step 21: `apps/api/prisma/seed.ts`** — change its existing direct
      `venuesRepository.createWithLocation({...})` call to `venuesRepository.createWithLocation(prisma, {...})`.

- [ ] **Step 22: `BoutiqueService`** — write the failing test first:
```typescript
describe("BoutiqueService.evaluate — status gate", () => {
  const service = new BoutiqueService();
  it("returns false for DRAFT even if all other rules pass", () => {
    expect(service.evaluate({ branchCount: 1, franchiseFlag: false, hasEditorialNote: true, status: "DRAFT" })).toBe(false);
  });
  it("returns true for PUBLISHED meeting all rules", () => {
    expect(service.evaluate({ branchCount: 1, franchiseFlag: false, hasEditorialNote: true, status: "PUBLISHED" })).toBe(true);
  });
});
```
Run — FAIL, then update `boutique.service.ts`:
```typescript
interface BoutiqueInput { branchCount: number; franchiseFlag: boolean; hasEditorialNote: boolean; status: string; }

@Injectable()
export class BoutiqueService {
  evaluate({ branchCount, franchiseFlag, hasEditorialNote, status }: BoutiqueInput): boolean {
    if (status !== "PUBLISHED") return false;
    const maxBranches = Number(process.env.RULES_BOUTIQUE_MAX_BRANCHES ?? 3);
    return branchCount <= maxBranches && !franchiseFlag && hasEditorialNote;
  }
}
```
Run — PASS. Update any pre-existing call site in `boutique.service.spec.ts` that omits `status`.

- [ ] **Step 23: `AdminVenuesService`** — write the failing tests first:
```typescript
describe("AdminVenuesService.create — status", () => {
  it("uses input.status when provided", async () => {
    const repo = { createWithLocation: jest.fn().mockResolvedValue({ id: "v1" }) } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const service = new AdminVenuesService({} as any, boutique, repo);
    await service.create({ name: "A", slug: "a", districtId: "d1", category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: {}, branchCount: 1, franchiseFlag: false, status: "PUBLISHED" } as any);
    expect(repo.createWithLocation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "PUBLISHED" }));
  });
  it("defaults to DRAFT when status is omitted", async () => {
    const repo = { createWithLocation: jest.fn().mockResolvedValue({ id: "v1" }) } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const service = new AdminVenuesService({} as any, boutique, repo);
    await service.create({ name: "A", slug: "a", districtId: "d1", category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: {}, branchCount: 1, franchiseFlag: false } as any);
    expect(repo.createWithLocation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "DRAFT" }));
  });
});

describe("AdminVenuesService.update — atomic snapshot + write, partial-update completeness", () => {
  it("wraps snapshot + update in a single transaction and completes isBoutique inputs from the DB", async () => {
    const prisma = { $transaction: jest.fn((fn) => fn({ venueVersion: { create: jest.fn() } })) } as any;
    const repo = {
      findRawForSnapshot: jest.fn().mockResolvedValue({ id: "v1", branchCount: 2, franchiseFlag: false, editorialNote: "old note", status: "PUBLISHED" }),
      updateWithLocation: jest.fn().mockResolvedValue({ id: "v1" }),
    } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(true) } as any;
    const service = new AdminVenuesService(prisma, boutique, repo);
    await service.update("v1", { branchCount: 5 } as any);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(boutique.evaluate).toHaveBeenCalledWith({ branchCount: 5, franchiseFlag: false, hasEditorialNote: true, status: "PUBLISHED" });
    expect(repo.updateWithLocation).toHaveBeenCalled();
  });
});

describe("AdminVenuesService.revert", () => {
  it("snapshots current state, then applies the target version's snapshot via snapshotToUpdateInput", async () => {
    const targetSnapshot = { id: "v1", name: "Old Name", lat: 40.9, lng: 29.0, status: "PUBLISHED", cuisineType: null, priceRange: "MODERATE", signatureItems: [], transportNote: null, openingHours: {}, editorialNote: null, isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL", verifiedAt: new Date(), googleRating: null, googleRatingCount: null, googlePlaceId: null, featured: false, address: null, photos: [], createdAt: new Date(), updatedAt: new Date() };
    const txClient = { venueVersion: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "ver1", venueId: "v1", snapshot: targetSnapshot }), create: jest.fn().mockResolvedValue({}) } };
    const prisma = { $transaction: jest.fn((fn) => fn(txClient)) } as any;
    const repo = {
      findRawForSnapshot: jest.fn().mockResolvedValue({ id: "v1", name: "Current Name", status: "PUBLISHED" }),
      updateWithLocation: jest.fn().mockResolvedValue({ id: "v1" }),
    } as any;
    const service = new AdminVenuesService(prisma, {} as any, repo);
    await service.revert("v1", "ver1");
    expect(txClient.venueVersion.create).toHaveBeenCalledWith({ data: { venueId: "v1", snapshot: expect.objectContaining({ name: "Current Name" }), createdBy: null } });
    expect(repo.updateWithLocation).toHaveBeenCalledWith(txClient, "v1", expect.objectContaining({ name: "Old Name" }));
  });
  it("throws NotFoundException if the version doesn't belong to this venue", async () => {
    const txClient = { venueVersion: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "ver1", venueId: "OTHER", snapshot: {} }) } };
    const prisma = { $transaction: jest.fn((fn) => fn(txClient)) } as any;
    const service = new AdminVenuesService(prisma, {} as any, { findRawForSnapshot: jest.fn() } as any);
    await expect(service.revert("v1", "ver1")).rejects.toThrow("Bu mekan için böyle bir versiyon bulunamadı");
  });
});
```
Run — FAIL, then implement (this REPLACES the current `create`/`update`/`revert` shown earlier):
```typescript
import { snapshotToUpdateInput } from "../../venues/venues.repository";
// ...

create(input: AdminVenueCreateInput) {
    const status = input.status ?? "DRAFT";
    const isBoutique = this.boutique.evaluate({
      branchCount: input.branchCount, franchiseFlag: input.franchiseFlag,
      hasEditorialNote: !!input.editorialNote, status,
    });
    return this.venuesRepository.createWithLocation(this.prisma, { ...input, isBoutique, verifiedAt: new Date(), status, source: "MANUAL" });
}

async update(id: string, input: AdminVenueUpdateInput) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await this.venuesRepository.findRawForSnapshot(tx, id);
      await tx.venueVersion.create({ data: { venueId: id, snapshot: existing as unknown as Prisma.InputJsonValue, createdBy: null } });
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
      await tx.venueVersion.create({ data: { venueId, snapshot: current as unknown as Prisma.InputJsonValue, createdBy: null } });
      // `version.snapshot` is a Prisma Json column -- its static type is `Prisma.JsonValue`, which
      // structurally cannot carry the domain knowledge that this particular snapshot was produced
      // by findRawForSnapshot's AdminVenueRow shape. This cast is the one place that knowledge is
      // asserted; snapshotToUpdateInput's own signature is fully typed from this point on.
      return this.venuesRepository.updateWithLocation(tx, venueId, snapshotToUpdateInput(version.snapshot as unknown as AdminVenueRow));
    });
}
```
(`createdBy: null` matches this codebase's existing pattern for system-initiated version rows
where the controller doesn't yet thread a reviewer id into `update`/`revert` — verify against the
live controller before finalizing; if it already passes one, use that instead.)
Run — PASS (all).

- [ ] **Step 24: Write a REAL Postgres integration test proving rollback actually happens**
      (the thing a mock cannot prove). Add to `apps/api/test/admin-venues.e2e-spec.ts` (new file,
      same pattern as the existing `app.e2e-spec.ts` — real `PrismaService` against the local
      Supabase stack):
```typescript
describe("AdminVenuesService.update — real rollback", () => {
  it("does not persist a VenueVersion snapshot when updateWithLocation fails mid-transaction", async () => {
    // Seed one real venue, then force updateWithLocation to fail (e.g. an invalid districtId FK)
    // and assert venueVersion.count for that venue is unchanged from before the call -- this is
    // the actual proof of atomicity a unit-level mock cannot provide.
    const venue = await prisma.venue.create({ /* minimal valid fields, see seed.ts for shape */ });
    const versionsBefore = await prisma.venueVersion.count({ where: { venueId: venue.id } });
    await expect(adminVenuesService.update(venue.id, { districtId: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow();
    const versionsAfter = await prisma.venueVersion.count({ where: { venueId: venue.id } });
    expect(versionsAfter).toBe(versionsBefore);
  });
});
```
Run: `cd apps/api && npx jest test/admin-venues.e2e-spec.ts` — expect PASS (requires the local
Supabase stack up; confirm with `npx supabase status` first).

- [ ] **Step 25: `AdminQueueService`** — write the failing tests first:
```typescript
describe("AdminQueueService.approve — REPORT vs EDIT branching", () => {
  it("REPORT: only flips ContributionQueue status, never touches Venue or VenueVersion", async () => {
    const item = { id: "c1", type: "REPORT", venueId: "v1", status: "PENDING" };
    const txClient = {
      contributionQueue: { findUniqueOrThrow: jest.fn().mockResolvedValue(item), update: jest.fn().mockResolvedValue({}) },
      venue: { update: jest.fn() }, venueVersion: { create: jest.fn() },
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

  it("EDIT: takes a location-inclusive snapshot via findRawForSnapshot, bumps verifiedAt", async () => {
    const item = { id: "c2", type: "EDIT", venueId: "v1", status: "PENDING" };
    const snapshot = { id: "v1", lat: 40.99, lng: 29.02 };
    const txMock = {
      contributionQueue: { findUniqueOrThrow: jest.fn().mockResolvedValue(item), update: jest.fn().mockResolvedValue({}) },
      venue: { update: jest.fn().mockResolvedValue({}) }, venueVersion: { create: jest.fn().mockResolvedValue({}) },
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
Run — FAIL, then replace the current `approve()` (which calls `tx.venue.findUniqueOrThrow` — a
Prisma Client read that structurally cannot see the `location` column, ADR 002 — with a snapshot
that also unconditionally runs for `REPORT` items, the exact A3/A4 bug):
```typescript
constructor(private prisma: PrismaService, private venuesRepository: VenuesRepository) {}

async approve(id: string, reviewerId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const item = await tx.contributionQueue.findUniqueOrThrow({ where: { id } });
      if (item.status !== "PENDING") throw alreadyProcessedError();
      if (item.type === "EDIT" && item.venueId) {
        const snapshot = await this.venuesRepository.findRawForSnapshot(tx, item.venueId);
        await tx.venueVersion.create({ data: { venueId: item.venueId, snapshot, createdBy: reviewerId } });
        await tx.venue.update({ where: { id: item.venueId }, data: { verifiedAt: new Date() } });
      }
      // REPORT: intentionally does NOT touch Venue/VenueVersion -- approving a "this info is
      // wrong" report means "we've reviewed it," not "we've confirmed it's accurate." Any actual
      // correction happens through AdminVenuesService.update(), which is what genuinely bumps
      // verifiedAt and records a version (Step 23 above).
      return tx.contributionQueue.update({ where: { id }, data: { status: "APPROVED", reviewedBy: reviewerId, reviewedAt: new Date() } });
    });
}
```
In `admin-queue.module.ts`, add `import { VenuesModule } from "../../venues/venues.module";` and
`imports: [VenuesModule]` so `VenuesRepository` can be injected.
Run — PASS (all, including the pre-existing EDIT-path test in this file — update its constructor
call to inject `venuesRepository`).

- [ ] **Step 26: Verify the module boots** (catches the DI wiring change unit tests can't):
Run: `cd apps/api && npx jest test/app.e2e-spec.ts` — PASS.

### Part C — Location header (ADR 004) and its callers

- [ ] **Step 27: Write the failing test — `user-location.decorator.spec.ts`** (new file)
```typescript
import { parseUserLocationHeader } from "./user-location.decorator";

describe("parseUserLocationHeader", () => {
  it("parses 'lat,lng'", () => expect(parseUserLocationHeader("40.99,29.02")).toEqual({ lat: 40.99, lng: 29.02 }));
  it("undefined header -> undefined", () => expect(parseUserLocationHeader(undefined)).toBeUndefined());
  it("malformed (empty parts, Number('')===0 footgun) -> undefined", () => {
    expect(parseUserLocationHeader(",")).toBeUndefined();
    expect(parseUserLocationHeader("40.99,")).toBeUndefined();
  });
  it("out-of-range -> undefined", () => expect(parseUserLocationHeader("999,29.02")).toBeUndefined());
});
```
- [ ] **Step 28:** Run — FAIL, then create `apps/api/src/common/user-location.decorator.ts`:
```typescript
import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface UserLocation { lat: number; lng: number; }

export function parseUserLocationHeader(header: string | undefined): UserLocation | undefined {
  if (typeof header !== "string") return undefined;
  const parts = header.split(",");
  if (parts.length !== 2 || parts.some((p) => p.trim() === "")) return undefined;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  return { lat, lng };
}

export const UserLocationParam = createParamDecorator((_: unknown, ctx: ExecutionContext): UserLocation | undefined => {
  const req = ctx.switchToHttp().getRequest();
  return parseUserLocationHeader(req.headers["x-user-location"]);
});
```
Run — PASS (4 tests).

- [ ] **Step 29: `VenuesService.list` sort-default** — write the failing test:
```typescript
describe("VenuesService.list — sort default", () => {
  it("defaults to distance when location is provided and sort is unset", async () => {
    const repo = { searchPublished: jest.fn().mockResolvedValue({ items: [], nextCursor: null }) } as any;
    await new VenuesService(repo).list({ limit: 20 } as any, { lat: 40.99, lng: 29.02 });
    expect(repo.searchPublished).toHaveBeenCalledWith(expect.objectContaining({ sort: "distance", lat: 40.99, lng: 29.02 }));
  });
  it("defaults to newest when no location is provided", async () => {
    const repo = { searchPublished: jest.fn().mockResolvedValue({ items: [], nextCursor: null }) } as any;
    await new VenuesService(repo).list({ limit: 20 } as any, undefined);
    expect(repo.searchPublished).toHaveBeenCalledWith(expect.objectContaining({ sort: "newest" }));
  });
  it("an explicit sort=distance with no location still calls searchPublished with sort=distance and lat/lng undefined -- the repository's own WHERE-clause guards (see searchPublished) fall back to createdAt ordering when lat/lng are absent regardless of the requested sort, so no separate error path is needed here", async () => {
    const repo = { searchPublished: jest.fn().mockResolvedValue({ items: [], nextCursor: null }) } as any;
    await new VenuesService(repo).list({ limit: 20, sort: "distance" } as any, undefined);
    expect(repo.searchPublished).toHaveBeenCalledWith(expect.objectContaining({ sort: "distance", lat: undefined, lng: undefined }));
  });
});
```
- [ ] **Step 30:** Run — FAIL, then update `VenuesService.list`:
```typescript
list(query: VenueListQuery, location?: UserLocation) {
    const sort = query.sort ?? (location ? "distance" : "newest");
    return this.repo.searchPublished({ ...query, sort, lat: location?.lat, lng: location?.lng });
}
```
(This is safe against the round-2-flagged "explicit sort=distance without a header" case because
`searchPublished`'s own `orderBy`/`distanceSelect` logic — read the real file — already guards
with `filters.lat && filters.lng`, i.e. it silently falls back to `createdAt DESC` when they're
absent, regardless of what `sort` says. No separate validation is needed; the third test above
documents this existing fallback explicitly so a future change to that guard doesn't silently
break the contract.)
Run — PASS (3 tests).

- [ ] **Step 31: `VenuesController`** — read the real current file (shown above: method-level
      `@UsePipes(new ZodValidationPipe(VenueListQuerySchema))` on `list`, confirmed). Replace with
      parameter-scoped validation and add the location param:
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
Remove the old `@UsePipes(...)` decorator on this method — at method scope it would try to
validate `location`'s return value against `VenueListQuerySchema` too and corrupt it.
Write a controller test:
```typescript
describe("VenuesController.list — pipe scoping doesn't corrupt the location param", () => {
  it("passes the validated query and the raw location object through unmangled", async () => {
    const venuesService = { list: jest.fn().mockResolvedValue({ items: [], nextCursor: null }) } as any;
    const controller = new VenuesController(venuesService);
    await controller.list({ limit: 20 } as any, { lat: 40.99, lng: 29.02 });
    expect(venuesService.list).toHaveBeenCalledWith({ limit: 20 }, { lat: 40.99, lng: 29.02 });
  });
});
```
Run: `cd apps/api && npx jest src/venues/venues.controller.spec.ts` — PASS.

- [ ] **Step 32: `DistrictsController.findNearest`** — write the failing test, then require the header:
```typescript
describe("DistrictsController.findNearest — header required", () => {
  it("throws 400 LOCATION_REQUIRED when absent", () => {
    const districtsService = { findNearest: jest.fn() } as any;
    const controller = new DistrictsController(districtsService);
    expect(() => controller.findNearest(undefined)).toThrow(BadRequestException);
    expect(districtsService.findNearest).not.toHaveBeenCalled();
  });
  it("calls the service with the header's lat/lng when present", () => {
    const districtsService = { findNearest: jest.fn().mockReturnValue("ok") } as any;
    new DistrictsController(districtsService).findNearest({ lat: 40.99, lng: 29.02 });
    expect(districtsService.findNearest).toHaveBeenCalledWith(40.99, 29.02);
  });
});
```
```typescript
@Get("nearest")
@RateLimit(100, 60)
findNearest(@UserLocationParam() location?: UserLocation) {
  if (!location) throw new BadRequestException({ error: { code: "LOCATION_REQUIRED", message: "Konum bilgisi gerekli" } });
  return this.districts.findNearest(location.lat, location.lng);
}
```
Remove the old `@Query("lat")`/`@Query("lng")` params and their `parseFloat` calls.
Run: `cd apps/api && npx jest src/districts/districts.controller.spec.ts` — PASS.

### Part D — Whole-task acceptance gate

- [ ] **Step 33: Run the FULL `apps/api` test suite and typecheck.** This is the first point where
      it is honestly a valid gate — every caller of every changed repository/service signature was
      updated in this same task.
Run: `cd apps/api && npx jest && npx tsc --noEmit`
Expected: all pass, zero type errors.

- [ ] **Step 34: Commit — one commit for this entire task, since it is atomic by design**
```bash
git add apps/api/src/venues apps/api/src/common/user-location.decorator.ts apps/api/src/common/user-location.decorator.spec.ts apps/api/src/districts apps/api/src/admin/venues apps/api/src/admin/queue apps/api/src/rule-engine/boutique.service.ts apps/api/src/rule-engine/boutique.service.spec.ts apps/api/prisma/seed.ts apps/api/test
git commit -m "feat(api): transaction-aware VenuesRepository, location header (ADR 004), status-aware admin writes, REPORT/EDIT queue branching, open_now filter

Single atomic commit by design: the repository signature change and every
one of its callers (VenuesService, VenuesController, DistrictsController,
AdminVenuesService, seed.ts, AdminQueueService) land together so no
intermediate state fails to compile. Fixes audit findings A1 (admin
create respects status), A3 (REPORT approval no longer mutates Venue),
A4 (update/revert/EDIT-approval snapshots are transactional and
location-inclusive), B5 (boutique rule requires PUBLISHED), B11 (0-valued
coordinates), plus the open_now filter and the X-User-Location header."
```

---

## Task 4: CSV import defaults to PUBLISHED, passes `status`/`address` through

**Files:**
- Modify: `apps/api/src/admin/venues/admin-venues.service.ts` (`importRows`)
- Test: `apps/api/src/admin/venues/csv-import.service.spec.ts` (append — real parser test),
  `apps/api/src/admin/venues/admin-venues.service.spec.ts` (append)

**Interfaces:**
- Consumes: Task 2's `CsvVenueStatusSchema`/`address`, Task 3's `create()`
- Produces: CSV-imported venues default to `PUBLISHED` unless the row says `DRAFT`; `address` reaches `createWithLocation`.

- [ ] **Step 1: Write a real test against the actual `CsvImportService.parseRows`**
      (`apps/api/src/admin/venues/csv-import.service.ts`, confirmed real file/method — no
      placeholder), appended to its existing spec file:
```typescript
describe("CsvImportService.parseRows — status/address columns", () => {
  it("parses a CSV with one row omitting status and one row setting DRAFT + address", () => {
    const csv =
      "name,slug,districtSlug,category,priceRange,branchCount,franchiseFlag,lat,lng,openingHours,status,address\n" +
      'A,a,kadikoy,cafe,MODERATE,1,false,40.99,29.02,"{""mon_fri"":""09:00-18:00""}",,\n' +
      'B,b,kadikoy,cafe,MODERATE,1,false,40.98,29.01,"{""mon_fri"":""09:00-18:00""}",DRAFT,"Bahariye Cd. No:1"\n';
    const service = new CsvImportService();
    const { valid, errors } = service.parseRows(csv);
    expect(errors).toEqual([]);
    expect(valid[0].data.status).toBeUndefined();
    expect(valid[1].data.status).toBe("DRAFT");
    expect(valid[1].data.address).toBe("Bahariye Cd. No:1");
  });
});
```
- [ ] **Step 2:** Run: `cd apps/api && npx jest src/admin/venues/csv-import.service.spec.ts` —
      expect FAIL (Task 2 already added `status`/`address` to `CsvVenueImportRowSchema`, which
      `parseRows` uses via `CsvVenueImportRowSchema.safeParse(record)` — this test should mostly
      already pass once Task 2 landed; if it does not, the gap is in `csv-parse`'s column handling
      for the trailing empty `status` cell, not the Zod schema — investigate with a `console.log(records)`
      before the `safeParse` call if it fails unexpectedly).
- [ ] **Step 3:** Fix whatever the actual gap is, run again — PASS.

- [ ] **Step 4: Write the failing test for `importRows`'s status/address default**
```typescript
describe("AdminVenuesService.importRows — status/address default", () => {
  it("defaults to PUBLISHED when the CSV row has no status", async () => {
    const prisma = { venue: { findUnique: jest.fn().mockResolvedValue(null) }, district: { findUnique: jest.fn().mockResolvedValue({ id: "d1" }) } } as any;
    const repo = { createWithLocation: jest.fn().mockResolvedValue({ id: "v1" }) } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const service = new AdminVenuesService(prisma, boutique, repo);
    await service.importRows([{ row: 1, data: { name: "A", slug: "a", districtSlug: "kadikoy", category: "cafe", priceRange: "MODERATE", branchCount: 1, franchiseFlag: false, lat: 40.99, lng: 29.02, openingHours: {} } as any }]);
    expect(repo.createWithLocation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "PUBLISHED" }));
  });
  it("respects an explicit DRAFT status and passes address through", async () => {
    const prisma = { venue: { findUnique: jest.fn().mockResolvedValue(null) }, district: { findUnique: jest.fn().mockResolvedValue({ id: "d1" }) } } as any;
    const repo = { createWithLocation: jest.fn().mockResolvedValue({ id: "v1" }) } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const service = new AdminVenuesService(prisma, boutique, repo);
    await service.importRows([{ row: 1, data: { name: "A", slug: "a", districtSlug: "kadikoy", category: "cafe", priceRange: "MODERATE", branchCount: 1, franchiseFlag: false, lat: 40.99, lng: 29.02, openingHours: {}, status: "DRAFT", address: "Bahariye Cd. No:1" } as any }]);
    expect(repo.createWithLocation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "DRAFT", address: "Bahariye Cd. No:1" }));
  });
});
```
- [ ] **Step 5:** Run — FAIL, then in `importRows`'s existing `this.create({...})` call (shown
      above at line 106-118), add:
```typescript
          status: row.status ?? "PUBLISHED",
          address: row.address,
```
- [ ] **Step 6:** Run — PASS (all).
- [ ] **Step 7:** Commit
```bash
git add apps/api/src/admin/venues/admin-venues.service.ts apps/api/src/admin/venues/csv-import.service.spec.ts
git commit -m "feat(api): CSV import defaults venues to PUBLISHED, passes status/address through"
```

---

## Task 5: Favorites and nearest-district PUBLISHED checks (B9, B10)

**Files:**
- Modify: `apps/api/src/favorites/favorites.service.ts`
- Modify: `apps/api/src/districts/districts.repository.ts` (or wherever `findNearestDistrict` lives)
- Test: corresponding `.spec.ts` files (append)

**Interfaces:**
- Consumes: nothing new
- Produces: `FavoritesService.addVenue` rejects non-`PUBLISHED` venues (404); `findNearestDistrict`
  filters `status='PUBLISHED'` and returns `cityId`/`slug`.

- [ ] **Step 1: Write the failing test**
```typescript
describe("FavoritesService.addVenue — PUBLISHED check", () => {
  it("rejects adding a DRAFT venue with 404", async () => {
    const prisma = {
      favoriteList: { findUnique: jest.fn().mockResolvedValue({ id: "l1", userId: "u1" }) },
      venue: { findUnique: jest.fn().mockResolvedValue({ id: "v1", status: "DRAFT" }) },
    } as any;
    await expect(new FavoritesService(prisma).addVenue("u1", "l1", "v1")).rejects.toThrow("Mekan bulunamadı");
  });
});
```
- [ ] **Step 2:** Run — FAIL, then add before the existing `upsert` call in `addVenue`:
```typescript
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue || venue.status !== "PUBLISHED") {
      const notFound = new NotFoundException({ error: { code: "VENUE_NOT_FOUND", message: "Mekan bulunamadı" } });
      notFound.message = "Mekan bulunamadı";
      throw notFound;
    }
```
- [ ] **Step 3:** Run — PASS.

- [ ] **Step 4: Write the failing test for `findNearestDistrict`**
```typescript
describe("DistrictsRepository.findNearestDistrict — full projection + status filter", () => {
  it("selects cityId and slug, filters PUBLISHED venues", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ id: "d1", name: "Kadıköy", cityId: "c1", slug: "kadikoy" }]) } as any;
    const result = await new DistrictsRepository(prisma).findNearestDistrict(40.99, 29.02);
    const sqlText = prisma.$queryRaw.mock.calls[0][0].strings.join("");
    expect(sqlText).toContain("cityId");
    expect(sqlText).toContain("PUBLISHED");
    expect(result).toEqual({ id: "d1", name: "Kadıköy", cityId: "c1", slug: "kadikoy" });
  });
});
```
- [ ] **Step 5:** Run — FAIL, then update:
```typescript
export interface NearestDistrictRow { id: string; name: string; cityId: string; slug: string; }

async findNearestDistrict(lat: number, lng: number): Promise<NearestDistrictRow | undefined> {
    const rows = await this.prisma.$queryRaw<NearestDistrictRow[]>(Prisma.sql`
        SELECT d.id, d.name, d."cityId", d.slug
        FROM "District" d JOIN "Venue" v ON v."districtId" = d.id
        WHERE v.status = 'PUBLISHED'
        ORDER BY v.location <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        LIMIT 1
    `);
    return rows[0];
}
```
- [ ] **Step 6:** Run — PASS.
- [ ] **Step 7:** Commit
```bash
git add apps/api/src/favorites apps/api/src/districts
git commit -m "fix(api): favorites and nearest-district only consider PUBLISHED venues"
```

---

## Task 6: bbox and UUID path-param validation (B12)

**Files:**
- Modify: `packages/shared/src/schemas/venue.schema.ts` (bbox schema)
- Modify: `apps/api/src/venues/venues.controller.ts` (bbox)
- Modify: `apps/api/src/admin/queue/admin-queue.controller.ts` (`approve`/`reject` `:id`)
- Modify: `apps/api/src/admin/users/admin-users.controller.ts` (`assignRole` `:id`)
- Modify: `apps/api/src/admin/venues/admin-venues.controller.ts` (`update` `:id`, `revert` `:id`/`:versionId`)
- Modify: `apps/api/src/favorites/favorites.controller.ts` (`addVenue` `:id`)
- Modify: `apps/api/src/reports/reports.controller.ts` (`submit` `:id`)
- Test: corresponding `.spec.ts` files (append)

**Interfaces:**
- Consumes: nothing new
- Produces: `BboxQuerySchema`; every `:id`/`:versionId` path param above validated as a UUID
  (`venues.controller.ts`'s `:slug` is NOT touched — it is a slug, not a UUID).

- [ ] **Step 1: Add `BboxQuerySchema`** to `packages/shared/src/schemas/venue.schema.ts`:
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
- [ ] **Step 2: Write the test**
```typescript
describe("BboxQuerySchema", () => {
  it("rejects a malformed bbox string", () => expect(BboxQuerySchema.safeParse({ bbox: "not,numbers,here" }).success).toBe(false));
  it("rejects only 3 parts", () => expect(BboxQuerySchema.safeParse({ bbox: "29.0,40.9,29.1" }).success).toBe(false));
  it("accepts a well-formed bbox", () => {
    const r = BboxQuerySchema.parse({ bbox: "29.0,40.9,29.1,41.0" });
    expect(r.bbox).toEqual([29.0, 40.9, 29.1, 41.0]);
  });
});
```
Run: `cd packages/shared && npx vitest run src/schemas/venue.schema.spec.ts` — PASS.

- [ ] **Step 3: Wire it into `VenuesController.mapView`** — read the real current code (shown
      above: `mapView(@Query("bbox") bbox: string) { const parts = bbox.split(",").map(Number)... }`)
      and replace with:
```typescript
@Get("map")
@RateLimit(100, 60)
mapView(@Query(new ZodValidationPipe(BboxQuerySchema)) query: { bbox: [number, number, number, number] }) {
  return this.venues.mapView(query.bbox);
}
```
Write a controller test confirming a malformed bbox throws via the pipe (same pattern as Step 9
of the old Task 4 in earlier plan drafts — a real `ZodValidationPipe(BboxQuerySchema).transform()`
call, not a placeholder).
Run: `cd apps/api && npx jest src/venues/venues.controller.spec.ts` — PASS.

- [ ] **Step 4: Add `ParseUUIDPipe` to every path param confirmed above.** For each, write a
      failing test asserting a non-UUID `:id` throws `BadRequestException`, then apply the pipe:
```typescript
// admin-queue.controller.ts
approve(@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string, @Req() req: any) { ... }
reject(@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string, @Req() req: any) { ... }

// admin-users.controller.ts
assignRole(@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string, @Body("role") role: string) { ... }

// admin-venues.controller.ts
update(@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string, ...) { ... }
revert(
  @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
  @Param("versionId", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) versionId: string,
) { ... }

// favorites.controller.ts
addVenue(@Req() req: any, @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) listId: string, @Body("venueId") venueId: string) { ... }

// reports.controller.ts
submit(@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) venueId: string, @Body(...) body: CreateReport) { ... }
```
(`venues.controller.ts`'s `detail(@Param("slug") slug: string)` is unchanged — a slug, not a UUID.)
Run each affected controller's spec file — PASS.

- [ ] **Step 5:** Run: `cd apps/api && npx jest src/venues src/admin src/favorites src/reports`
      Expected: all pass.
- [ ] **Step 6:** Commit
```bash
git add packages/shared/src/schemas/venue.schema.ts apps/api/src/venues apps/api/src/admin apps/api/src/favorites apps/api/src/reports
git commit -m "fix(api): bbox and UUID path-param validation (B12), Zod-driven bbox errors instead of PostGIS crashes"
```

---

## Task 7: `RolesGuard` 401 vs 403 split (B13)

**Files:**
- Modify: `apps/api/src/auth/roles.guard.ts`
- Test: `apps/api/src/auth/roles.guard.spec.ts` (append/modify)

**Interfaces:**
- Consumes: nothing new
- Produces: `RolesGuard.canActivate` throws `UnauthorizedException` (401, no user) vs
  `ForbiddenException` (403, wrong role) instead of a bare boolean.

- [ ] **Step 1: Write the failing test**
```typescript
describe("RolesGuard — 401 vs 403", () => {
  const makeCtx = (user: unknown) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }), getHandler: () => ({}), getClass: () => ({}) } as any);
  it("throws UnauthorizedException when there is no user", () => {
    const guard = new RolesGuard({ getAllAndOverride: jest.fn().mockReturnValue(["curator"]) } as any);
    expect(() => guard.canActivate(makeCtx(undefined))).toThrow(UnauthorizedException);
  });
  it("throws ForbiddenException when the role is insufficient", () => {
    const guard = new RolesGuard({ getAllAndOverride: jest.fn().mockReturnValue(["curator"]) } as any);
    expect(() => guard.canActivate(makeCtx({ role: "user" }))).toThrow(ForbiddenException);
  });
  it("allows access when the role matches", () => {
    const guard = new RolesGuard({ getAllAndOverride: jest.fn().mockReturnValue(["curator"]) } as any);
    expect(guard.canActivate(makeCtx({ role: "curator" }))).toBe(true);
  });
});
```
- [ ] **Step 2:** Run — FAIL (current `canActivate` returns `!!user && requiredRoles.includes(user.role)`,
      confirmed by reading the file), then replace with:
```typescript
canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new UnauthorizedException({ error: { code: "UNAUTHORIZED", message: "Giriş gerekli" } });
    if (!requiredRoles.includes(user.role)) throw new ForbiddenException({ error: { code: "FORBIDDEN", message: "Yetkiniz yok" } });
    return true;
}
```
- [ ] **Step 3:** Run — PASS, then run `cd apps/api && grep -rl "RolesGuard" src --include=*.spec.ts`
      and update every other test file that asserted a bare `false`/generic-403 return for the
      no-user case to expect `UnauthorizedException` (401) instead.
- [ ] **Step 4:** Run: `cd apps/api && npx jest src/auth` and every file the grep found — PASS.
- [ ] **Step 5:** Commit
```bash
git add apps/api/src/auth
git commit -m "fix(api): RolesGuard distinguishes 401 (no user) from 403 (wrong role)"
```

---

## Task 8: Full regression checkpoint

**Files:** none — verification only.

- [ ] **Step 1:** Run: `cd apps/api && npx jest && npx tsc --noEmit`
- [ ] **Step 2:** Run: `cd packages/shared && npx vitest run && npx tsc --noEmit`
Expected: all green. This is a checkpoint before the independent security/ops tasks below — every
task from here on is additive and doesn't change an existing signature, so each can be reviewed
and merged independently without breaking this baseline.

---

## Task 9: Re-verify cron actually runs

**Files:**
- Modify: `apps/api/package.json`, `pnpm-lock.yaml` (regenerated)
- Modify: `apps/api/src/rule-engine/rule-engine.module.ts`, `re-verify.service.ts`
- Test: `apps/api/src/rule-engine/re-verify.service.spec.ts` (append)

**Interfaces:**
- Consumes: nothing new
- Produces: `ReVerifyService` runs daily via a named cron job `"re-verify-stale"`.

- [ ] **Step 1:** Run: `cd apps/api && pnpm add @nestjs/schedule` (regenerates the lockfile — include it in this commit).
- [ ] **Step 2: Write the failing test**
```typescript
import { Test } from "@nestjs/testing";
import { SchedulerRegistry, ScheduleModule } from "@nestjs/schedule";
import { ReVerifyService } from "./re-verify.service";
import { PrismaService } from "../prisma/prisma.service";

describe("ReVerifyService — cron registration", () => {
  it("registers a named daily cron job", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ScheduleModule.forRoot()], providers: [ReVerifyService, { provide: PrismaService, useValue: {} }] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    expect(app.get(SchedulerRegistry).getCronJob("re-verify-stale")).toBeDefined();
    await app.close();
  });
});
```
- [ ] **Step 3:** Run — FAIL, then add `ScheduleModule.forRoot()` to `RuleEngineModule`'s imports
      and add to `re-verify.service.ts`:
```typescript
import { Cron, CronExpression } from "@nestjs/schedule";
// ...
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: "re-verify-stale" })
  async handleCron() { await this.enqueueStale(); }
```
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Run: `cd apps/api && npx jest test/app.e2e-spec.ts` — PASS (confirms `ScheduleModule` doesn't break bootstrap).
- [ ] **Step 6:** Commit
```bash
git add apps/api/package.json apps/api/pnpm-lock.yaml apps/api/src/rule-engine
git commit -m "feat(api): wire re-verify stale-venue job to a real daily cron"
```

---

## Task 10: Rate limits read from env (B7)

**Files:**
- Create: `apps/api/src/common/rate-limit.config.ts`
- Modify: `apps/api/src/reports/reports.controller.ts`, `venues.controller.ts`,
  `districts.controller.ts`, `favorites.controller.ts`, `apps/api/.env.example`, `apps/api/src/main.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `RATE_LIMITS` config object read from env with documented fallbacks; a boot-time
  warning (not a hard failure — see rejected-findings note above) when running with
  `NODE_ENV=production` and the env vars are unset.

- [ ] **Step 1: Write the test**
```typescript
describe("RATE_LIMITS — env override", () => {
  const original = process.env.RATE_LIMIT_READ_PER_MINUTE;
  afterEach(() => { process.env.RATE_LIMIT_READ_PER_MINUTE = original; jest.resetModules(); });
  it("uses the env value when set", () => {
    process.env.RATE_LIMIT_READ_PER_MINUTE = "42";
    jest.resetModules();
    expect(require("./rate-limit.config").RATE_LIMITS.read.limit).toBe(42);
  });
  it("falls back to 100 when unset", () => {
    delete process.env.RATE_LIMIT_READ_PER_MINUTE;
    jest.resetModules();
    expect(require("./rate-limit.config").RATE_LIMITS.read.limit).toBe(100);
  });
});
```
- [ ] **Step 2:** Run — FAIL, then create `rate-limit.config.ts`:
```typescript
export const RATE_LIMITS = {
  read: { limit: Number(process.env.RATE_LIMIT_READ_PER_MINUTE ?? 100), windowSeconds: 60 },
  report: { limit: Number(process.env.RATE_LIMIT_REPORT_PER_DAY ?? 10), windowSeconds: 86400 },
};
```
- [ ] **Step 3:** Run — PASS. Replace every hardcoded `@RateLimit(100, 60)` /
      `@RateLimit(10, 86400)` across the four controllers with
      `@RateLimit(RATE_LIMITS.read.limit, RATE_LIMITS.read.windowSeconds)` /
      `@RateLimit(RATE_LIMITS.report.limit, RATE_LIMITS.report.windowSeconds)`.
      Add `RATE_LIMIT_READ_PER_MINUTE=100` / `RATE_LIMIT_REPORT_PER_DAY=10` to `.env.example`.
- [ ] **Step 4: Add a boot-time warning in `main.ts`** (addresses the rejected-finding's own
      mitigation — env unset in production shouldn't be silent):
```typescript
  if (process.env.NODE_ENV === "production" && (!process.env.RATE_LIMIT_READ_PER_MINUTE || !process.env.RATE_LIMIT_REPORT_PER_DAY)) {
    console.warn("RATE_LIMIT_* env vars not set in production -- using defaults (100/min, 10/day)");
  }
```
- [ ] **Step 5:** Run: `cd apps/api && npx jest src/common src/venues src/districts src/favorites src/reports` — PASS.
- [ ] **Step 6:** Commit
```bash
git add apps/api/src/common apps/api/src/reports apps/api/src/venues apps/api/src/districts apps/api/src/favorites apps/api/src/main.ts apps/api/.env.example
git commit -m "feat(api): rate limit values read from env with a production boot-time warning if unset"
```

---

## Task 11: Admin role assignment restricted to curator (B14)

**Files:**
- Modify: `apps/api/src/admin/users/admin-users.service.ts`
- Test: `apps/api/src/admin/users/admin-users.service.spec.ts` (append)

**Interfaces:**
- Consumes: nothing new
- Produces: `AdminUsersService.assignRole` rejects any role outside `["curator"]` in MVP.

- [ ] **Step 1: Write the failing test**
```typescript
describe("AdminUsersService.assignRole — MVP restricts to curator only", () => {
  it("rejects assigning the admin role in MVP", async () => {
    const service = new AdminUsersService({ user: { update: jest.fn() } } as any);
    await expect(service.assignRole("u1", "admin")).rejects.toThrow("Bu rol MVP'de kullanılamaz (Faz 2)");
  });
});
```
- [ ] **Step 2:** Run — FAIL, then change `MVP_ASSIGNABLE_ROLES` (or introduce it if it doesn't
      exist yet — read the current file) to `["curator"]`.
- [ ] **Step 3:** Run — PASS.
- [ ] **Step 4:** Commit
```bash
git add apps/api/src/admin/users
git commit -m "fix(api): restrict admin role assignment to curator only in MVP"
```

---

## Task 12: Swagger disabled in production (B15)

**Files:**
- Modify: `apps/api/src/main.ts`
- Test: `apps/api/src/main.spec.ts` (new)

**Interfaces:**
- Consumes: nothing new
- Produces: an exported, independently-callable `bootstrap(app: NestFastifyApplication)` split out
  of the current inline `bootstrap()` (confirmed real file, shown above) so Swagger's
  production-guard can be unit tested without spawning a real process.

- [ ] **Step 1: Refactor `main.ts` to extract the Swagger-setup portion into its own function**
```typescript
export function setupSwagger(app: NestFastifyApplication) {
  const config = new DocumentBuilder().setTitle("GurmeGo API").setVersion("1.0").build();
  const document = SwaggerModule.createDocument(app, config);
  if (process.env.EXPORT_OPENAPI) {
    writeFileSync("openapi.json", JSON.stringify(document));
    process.exit(0);
  }
  if (process.env.NODE_ENV !== "production") {
    SwaggerModule.setup("docs", app, document);
  }
}
```
Call `setupSwagger(app)` from `bootstrap()` in place of the current inline Swagger block.

- [ ] **Step 2: Write the test** (new file `apps/api/src/main.spec.ts`)
```typescript
import { setupSwagger } from "./main";

describe("setupSwagger — production guard", () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = originalEnv; });

  it("does not call SwaggerModule.setup when NODE_ENV=production", () => {
    process.env.NODE_ENV = "production";
    const setupSpy = jest.spyOn(require("@nestjs/swagger").SwaggerModule, "setup");
    setupSwagger({} as any);
    expect(setupSpy).not.toHaveBeenCalled();
    setupSpy.mockRestore();
  });

  it("calls SwaggerModule.setup when NODE_ENV is not production", () => {
    process.env.NODE_ENV = "development";
    const setupSpy = jest.spyOn(require("@nestjs/swagger").SwaggerModule, "setup").mockImplementation(() => {});
    setupSwagger({} as any);
    expect(setupSpy).toHaveBeenCalled();
    setupSpy.mockRestore();
  });
});
```
- [ ] **Step 3:** Run: `cd apps/api && npx jest src/main.spec.ts` — expect FAIL before Step 1, PASS after.
- [ ] **Step 4:** Run: `cd apps/api && npx jest test/app.e2e-spec.ts` (confirms `bootstrap()` still
      boots correctly with the extracted function) — PASS.
- [ ] **Step 5:** Commit
```bash
git add apps/api/src/main.ts apps/api/src/main.spec.ts
git commit -m "fix(api): disable Swagger docs in production, extract setupSwagger for testability"
```

---

## Task 13: Global exception filter delegates HttpException to Nest (B16)

**Files:**
- Create: `apps/api/src/common/all-exceptions.filter.ts`
- Modify: `apps/api/src/main.ts`
- Test: `apps/api/src/common/all-exceptions.filter.spec.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `AllExceptionsFilter extends BaseExceptionFilter` — for any `HttpException`, delegates
  to `super.catch()` (Nest's own exception-handling pipeline, which is what actually sets
  `Retry-After` on 429s and every other status-specific header/body Nest already knows how to
  produce); only a non-`HttpException` gets this filter's own 500 handling. This directly answers
  round 2's finding that the previous `@Catch()`-with-manual-`send()` version couldn't prove it
  preserved Nest-managed header behavior — this version doesn't touch that behavior at all.

- [ ] **Step 1: Write the test**
```typescript
import { ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { AllExceptionsFilter } from "./all-exceptions.filter";

describe("AllExceptionsFilter", () => {
  it("delegates HttpException handling to BaseExceptionFilter.catch (Nest's own pipeline)", () => {
    const superCatchSpy = jest.spyOn(require("@nestjs/core").BaseExceptionFilter.prototype, "catch").mockImplementation(() => {});
    const filter = new AllExceptionsFilter({ httpAdapter: {} } as HttpAdapterHost);
    const original = new HttpException({ error: { code: "TOO_MANY_REQUESTS", message: "Yavaşlayın" } }, HttpStatus.TOO_MANY_REQUESTS);
    const host = {} as ArgumentsHost;
    filter.catch(original, host);
    expect(superCatchSpy).toHaveBeenCalledWith(original, host);
    superCatchSpy.mockRestore();
  });

  it("converts an unhandled non-HttpException error to a 500 envelope without calling super.catch", () => {
    const superCatchSpy = jest.spyOn(require("@nestjs/core").BaseExceptionFilter.prototype, "catch").mockImplementation(() => {});
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });
    const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as unknown as ArgumentsHost;
    const filter = new AllExceptionsFilter({ httpAdapter: {} } as HttpAdapterHost);
    filter.catch(new Error("boom"), host);
    expect(superCatchSpy).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(send).toHaveBeenCalledWith({ error: { code: "INTERNAL_ERROR", message: "Beklenmeyen bir hata oluştu" } });
    superCatchSpy.mockRestore();
  });
});
```
- [ ] **Step 2:** Run — FAIL (file doesn't exist), then implement:
```typescript
import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { BaseExceptionFilter, HttpAdapterHost } from "@nestjs/core";

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(httpAdapterHost: HttpAdapterHost) {
    super(httpAdapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof HttpException) {
      // Let Nest's own pipeline handle every HttpException it already knows how to render --
      // including Retry-After on 429s and any other status-specific header/body logic. This
      // filter must never reimplement that; it only exists to catch what nothing else does.
      super.catch(exception, host);
      return;
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    const response = host.switchToHttp().getResponse();
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ error: { code: "INTERNAL_ERROR", message: "Beklenmeyen bir hata oluştu" } });
  }
}
```
- [ ] **Step 3:** Run — PASS (2 tests).
- [ ] **Step 4: Wire it globally in `main.ts`**, using Nest's DI to obtain `HttpAdapterHost` (the
      constructor now requires it — this cannot be `new AllExceptionsFilter()` with no arguments):
```typescript
import { HttpAdapterHost } from "@nestjs/core";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
// ... inside bootstrap(), before app.listen():
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
```
- [ ] **Step 5: Run the full test suite to confirm no existing endpoint's observable status/body
      changed, especially the Retry-After header on 429 from Plan 1**
Run: `cd apps/api && npx jest`
Expected: all pass unchanged — since `HttpException` now goes through `super.catch()` (Nest's
real pipeline) rather than this filter's own `send()` call, this is actually MORE likely to
preserve exact existing behavior than the round-2-flagged version, not less.
- [ ] **Step 6:** Commit
```bash
git add apps/api/src/common/all-exceptions.filter.ts apps/api/src/common/all-exceptions.filter.spec.ts apps/api/src/main.ts
git commit -m "feat(api): global exception filter delegates HttpException to Nest's own pipeline, only handles unhandled non-HttpException errors"
```

---

## Task 14: Final full regression and manual smoke verification

**Files:** none.

- [ ] **Step 1:** Run: `cd apps/api && npx jest && cd ../../packages/shared && npx vitest run`
- [ ] **Step 2:** Run: `pnpm exec turbo run typecheck lint --filter=@gurmego/api... --filter=@gurmego/shared`
- [ ] **Step 3: Manual verification (NOT an automated gate)** — with a real curator JWT from the
      actual login flow and a real district id (`SELECT id FROM "District" LIMIT 1`):
```bash
curl -X POST http://localhost:3001/v1/admin/venues -H "Authorization: Bearer <real-curator-jwt>" -H "Content-Type: application/json" -d '{"name":"Smoke Test Cafe","slug":"smoke-test-cafe","districtId":"<real-district-id>","category":"cafe","priceRange":"MODERATE","openingHours":{"mon_fri":"09:00-18:00"},"branchCount":1,"franchiseFlag":false,"lat":40.99,"lng":29.02,"status":"PUBLISHED"}'
curl http://localhost:3001/v1/venues
```
Expected: "Smoke Test Cafe" appears in the second response. The automated proof of A1 is Task 3's
(`AdminVenuesService.create` respecting `status`) and Task 4's (CSV defaulting to `PUBLISHED`)
test suites — this manual step is a one-time confidence check, not the acceptance criterion.
- [ ] **Step 4:** Update `docs/STATE.md` and `docs/SESSION-LOG-2026-07-26.md`: Plan 4b complete,
      ready for the final whole-branch review (Superpowers reviewer + mandatory `cross-model-review`).

---

## Self-Review Notes (round 3, after two YENİDEN BÖL verdicts)

- **The structural objection is now actually resolved, not relabeled:** Task 3 changes every
  repository signature AND updates every one of its callers (VenuesService, VenuesController,
  DistrictsController, AdminVenuesService, seed.ts, AdminQueueService, BoutiqueService) before its
  own single commit and single acceptance gate. No other task in this plan changes a signature
  with callers living outside itself.
- **Type consistency:** `UpdateVenueWithLocationInput`'s nullable fields now explicitly accept
  `null` (not just `undefined`), so `snapshotToUpdateInput()`'s return type matches without an
  `any` escape hatch; the only remaining casts (`as unknown as AdminVenueRow` for a Prisma `Json`
  column read-back, `as unknown as Prisma.InputJsonValue` for the write) are narrow, one-directional,
  and commented with why no narrower type is structurally possible.
- **Placeholder scan:** the CSV parser test now targets the real
  `apps/api/src/admin/venues/csv-import.service.ts`'s `CsvImportService.parseRows`, read directly
  from the file rather than guessed; the Swagger test now targets a real exported `setupSwagger`
  function; the `AllExceptionsFilter` test now verifies actual delegation to
  `BaseExceptionFilter.prototype.catch` instead of asserting a hand-rolled `send()` call; the B12
  UUID task lists the exact five controllers/six methods found via `grep -rn "@Param(" apps/api/src`.
- **Task 8/10 (round 2's "too much bundled")** split into five independent tasks (8 regression
  checkpoint, 9 cron, 10 rate limits, 11 role restriction, 12 Swagger, 13 exception filter) — each
  changes only additive, non-breaking surface, so none of them can invalidate another's baseline.
