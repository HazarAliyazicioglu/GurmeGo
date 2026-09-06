# GurmeGo — Plan 4b: Backend Kritik Düzeltmeler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every backend finding from `docs/AUDIT-2026-07-26.md` so the pilot can actually
function — most critically, make it possible to publish a venue at all, and stop the location
header contract / data-integrity / security gaps documented in
`docs/superpowers/specs/2026-07-26-backend-fixes-design.md` (HAZIR after 5 idea-red-team rounds).

## Red-team geçmişi (3 tur, Codex)

**Round 1 — YENİDEN BÖL:** repository imza değişikliği callers'ı 2-3 task sonra düzeltiyordu,
aradaki `tsc`/`jest` iddiaları yalandı.

**Round 2 — YENİDEN BÖL:** Round 1'in düzeltmesi sorunu **etiketlemişti, çözmemişti** — aynı
yapı korunmuş, sadece "bu ara adımda test çalıştırma" notu eklenmişti.

**Round 3 — YENİDEN BÖL, ama artık farklı bir sınıf bulgu:** Gerçek kod okunup tüm callers'ı tek
atomik task'ta (o zamanki Task 3) birleştirme girişimi **başarılı oldu** — Codex'in kendi ifadesiyle
"Round 2'nin ana sorunu... dar anlamda çözülmüş." Kalan bulgular artık sözleşme-kırılması değil,
somut hatalar ve aşırı büyümüş bir task:
1. `searchPublished`'ın `distanceSelect`/`radiusFilter`/`orderBy`'ı hâlâ `filters.lat && filters.lng`
   (truthiness) kullanıyordu — B11 güncelleme tarafında değil ARAMA tarafında hâlâ kırıktı.
2. `AdminVenueRow` arayüzüne `address`/`photos` eklenmemişti (yalnızca Create/Update input'larına
   eklenmişti) — fixture'lar excess-property hatası verirdi.
3. `snapshotToUpdateInput()` `source` alanını atlıyordu — revert tam durumu geri yüklemiyordu.
4. `AdminQueueService.approve()` hâlâ `tx: any` kullanıyordu.
5. Task 3, 34 adımda repository+versioning+arama+header+ilçe+queue+boutique'i tek inceleme
   birimine yığmıştı — "her çağıranı aynı atomik değişimde güncelle" ilkesi doğruydu, ama bununla
   ilgisiz başka düzeltmeleri de aynı task'a katmak gerekmiyordu.
6. Swagger testi hâlâ çalıştırılamazdı: `main.ts`'in gerçek dosyası `bootstrap()`'ı modül
   yüklenirken koşulsuz çağırıyor (`bootstrap();` dosya sonunda) — `setupSwagger`'ı import etmek
   gerçek uygulamayı ayağa kaldırırdı.
7. Rollback testi (Step 24) hâlâ placeholder'dı (`/* minimal valid fields */`) ve ADR 002 gereği
   zaten `prisma.venue.create()` PostGIS `location` sütununu yazamaz.
8. UUID pipe testleri controller metodunu doğrudan çağırıyordu — bu, gerçek `ParseUUIDPipe`'ı hiç
   çalıştırmaz.
9. Admin-queue şema testi ve `OptionalTrueFlag` testi placeholder/eksik-import içeriyordu.

**Bu round (4): tüm bu somut hatalar düzeltildi, tek dev task ikiye bölündü.**
- Eski Task 3, gerçek bağımlılık grafiğine göre ikiye ayrıldı: **Task 3 (yazma/versiyonlama
  yolu)** — `createWithLocation`/`updateWithLocation`/`findRawForSnapshot`/`snapshotToUpdateInput`
  + bunların TEK doğrudan çağıranları (`AdminVenuesService`, `seed.ts`, `BoutiqueService`,
  `AdminQueueService`) — ve **Task 4 (okuma/arama yolu)** — `searchPublished` (B11 dahil, artık
  gerçekten `!== undefined`) + `VenuesService.list` + `VenuesController` + konum header decorator'ı
  + `DistrictsController`. Bu ikisi birbirinin çağıranı değil, aynı task'ta olmalarını gerektiren
  bir sözleşme yok.
- `findBySlug` yeniden yazımı ayrı, küçük bir task (Task 5) — hiçbir çağıranın imzası değişmiyor,
  yalnızca döndürdüğü veri zenginleşiyor.
- `AdminVenueRow`'a `address: string | null` / `photos: string[]` artık Task 3'ün açık bir adımı.
- `snapshotToUpdateInput()` artık `source`'u da taşıyor; `revert()` mapping'den sonra
  `verifiedAt: new Date()` ile açıkça üzerine yazıyor (eski zaman damgasını geri yüklemek yerine
  revert'i de bir "yeniden doğrulama" olarak ele alıyor — `update()`'in yaptığı gibi).
- `AdminQueueService.approve()`'daki `tx: any` → `Prisma.TransactionClient`.
- `main.ts` artık `if (require.main === module) { bootstrap(); }` koruması kullanıyor — `setupSwagger`
  import edilirken gerçek uygulama ayağa kalkmıyor; Swagger testi hem `createDocument` hem `setup`'ı
  mock'luyor.
- Step 24'ün placeholder rollback testi kaldırıldı; yerine ADR 002'yi hesaba katan gerçek bir
  entegrasyon testi (mevcut seed verisiyle çalışan, `venuesRepository.createWithLocation` kullanan)
  kondu.
- UUID testleri artık `new ParseUUIDPipe(...).transform(value, metadata)`'ı doğrudan çağırıyor —
  gerçek pipe'ın kendisini test ediyor, controller'ı değil.
- Admin-queue şema testi gerçek `AdminQueueItemSchema`/`MutationResultSchema` alan listesine
  (`packages/shared/src/schemas/admin-queue.schema.ts`, okunmuş) karşı yazıldı.
- `districts.repository.ts` — gerçek dosya yolu doğrulandı, "or wherever" ifadeleri kaldırıldı.

**Reddedilen bulgular (gerekçeli, tüm roundlar):**
- "ADR 001'in Postgres seçimi MVP'de daha iyi değil" — reddedildi (ADR 001'in kendi p95 sinyaliyle
  yakalanır bir risk, restart-persistence avantajı gerçek).
- "ADR 004 için geohash değerlendirilmeliydi" — kısmen kabul (riskler ADR'ye zaten işli), kısmen ret
  (kapsam orantısız genişler).
- "Rate limit `?? 100` fallback'i hardcode kuralına aykırı" — reddedildi, env-önce + prod-uyarısı
  yeterli (Task 12).
- "`super.catch()` Nest'in kendiliğinden Retry-After ürettiği anlamına gelmez, ifade fazla iddialı"
  — kabul edildi, Task 15'in açıklaması yumuşatıldı (bkz. Task 15).
- Cursor pagination limiti, B1 JWT yorumu — kapsam dışı, `docs/CHANGELOG.md`'de zaten kayıtlı.

**Architecture:** No new modules. `VenuesRepository` becomes transaction-aware (ADR 002).
`@UserLocationParam()` reads `X-User-Location` (ADR 004). Zod schemas gain `status`/`openNow`/
corrected optional-boolean; sort-default moves from schema to `VenuesService`.

**Tech Stack:** NestJS 10 (Fastify), Prisma 5 + raw `$queryRaw`, Zod, Jest, `@nestjs/schedule`.

## Global Constraints

- TypeScript `strict: true`; `any` forbidden unless justified inline (a Prisma `Json` column
  read-back into a known shape is the only place this plan uses a cast, and each is commented).
- All API input validated via Zod schemas from `packages/shared`.
- PostGIS raw SQL only in `*.repository.ts` files (ADR 002, amended for the file pattern).
- Rule engine thresholds read from env, never hardcoded into business logic.
- `ContributionQueue` remains the only entry point for user contributions into `Venue`.
- Migration: only `prisma migrate`. Location header only, never a query param (ADR 004, NFR-04).
- No `origin` git remote — local command reproduction is the acceptance proof.
- Read `npx supabase status` for real local ports before running migrations.
- **A `tsc --noEmit`/`jest` run is only a valid acceptance step once every call site of a changed
  signature has been updated in the SAME task.** Task 3 owns `createWithLocation`/
  `updateWithLocation`/`findRawForSnapshot`/`snapshotToUpdateInput` and every one of their callers.
  Task 4 owns `searchPublished` and every one of its callers. No other task in this plan changes a
  signature with callers living outside itself.

---

## Task 1: Migration — `Venue.address` and `Venue.photos`

**Files:** Modify `apps/api/prisma/schema.prisma`; migration auto-generated.

**Interfaces:** Consumes nothing. Produces `Venue.address: String?`, `Venue.photos: String[] @default([])` — consumed by Tasks 3 and 5.

- [ ] **Step 1:** Add after `transportNote` in the `Venue` model:
```prisma
  transportNote     String?
  address           String?
  photos            String[]            @default([])
```
- [ ] **Step 2:** Run: `cd apps/api && npx prisma migrate dev --name add_venue_address_photos`
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
- Test: `admin-venue.schema.spec.ts` (new), `csv-venue-import.schema.spec.ts`, `venue.schema.spec.ts`,
  `admin-queue.schema.spec.ts` (append)

**Interfaces:**
- Consumes: nothing
- Produces: `AdminVenueCreateSchema`/`UpdateSchema` with `status`/`address`/`photos`;
  `CsvVenueStatusSchema = z.enum(["DRAFT","PUBLISHED"])` + `address` on `CsvVenueImportRowSchema`;
  `OptionalTrueFlag` helper (defined here, NOT yet applied to `VenueListQuerySchema` — that
  happens in Task 4, atomically with its consumer `searchPublished`); `AdminQueueItemSchema`/
  `AdminQueueMutationResultSchema` with `type: "REPORT" | "EDIT"`. This task does NOT touch
  `VenueListQuerySchema` or `VenueDetailSchema` — see Step 8's note for why (both moved to their
  actual consumer's task, Task 4 and Task 5 respectively, after two separate rounds of
  plan-red-team caught the same class of cross-task acceptance-cycle bug on each).

- [ ] **Step 1: Write the failing test — `admin-venue.schema.spec.ts`** (new)
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
    const r = AdminVenueCreateSchema.safeParse({ ...BASE, status: "PUBLISHED" });
    expect(r.success && r.data.status).toBe("PUBLISHED");
  });
  it("leaves status undefined when omitted", () => {
    const r = AdminVenueCreateSchema.safeParse(BASE);
    expect(r.success && r.data.status).toBeUndefined();
  });
  it("rejects an invalid status", () => expect(AdminVenueCreateSchema.safeParse({ ...BASE, status: "PUBLISHD" }).success).toBe(false));
  it("accepts optional address/photos", () => expect(AdminVenueCreateSchema.safeParse({ ...BASE, address: "Bahariye Cd. No:1", photos: ["https://x/1.jpg"] }).success).toBe(true));
});

describe("AdminVenueUpdateSchema", () => {
  it("is fully partial, still accepts status", () => expect(AdminVenueUpdateSchema.safeParse({ status: "ARCHIVED" }).success).toBe(true));
});
```
- [ ] **Step 2:** Run: `cd packages/shared && npx vitest run src/schemas/admin-venue.schema.spec.ts` — FAIL.
- [ ] **Step 3:** In `admin-venue.schema.ts`, import `VenueStatusSchema` from `./venue.schema`, add to `AdminVenueCreateSchema`:
```typescript
  status: VenueStatusSchema.optional(),
  address: z.string().max(500).optional(),
  photos: z.array(z.string().url()).max(20).optional(),
```
- [ ] **Step 4:** Run — PASS (5 tests).

- [ ] **Step 5: Write the failing test — `csv-venue-import.schema.spec.ts`**
```typescript
import { CsvVenueImportRowSchema } from "./csv-venue-import.schema";

describe("CsvVenueImportRowSchema status/address columns", () => {
  const BASE_ROW = {
    name: "Test", slug: "test", districtSlug: "kadikoy", category: "cafe",
    priceRange: "MODERATE" as const, branchCount: "1", franchiseFlag: "false" as const,
    lat: "40.99", lng: "29.02", openingHours: '{"mon_fri":"09:00-18:00"}',
  };
  it("empty status cell -> undefined", () => {
    const r = CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, status: "" });
    expect(r.success && r.data.status).toBeUndefined();
  });
  it("DRAFT accepted", () => {
    const r = CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, status: "DRAFT" });
    expect(r.success && r.data.status).toBe("DRAFT");
  });
  it("ARCHIVED rejected — CSV import can only produce DRAFT or PUBLISHED", () => {
    expect(CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, status: "ARCHIVED" }).success).toBe(false);
  });
  it("status column absent entirely still parses", () => expect(CsvVenueImportRowSchema.safeParse(BASE_ROW).success).toBe(true));
  it("address column: value kept, empty treated as undefined", () => {
    const r1 = CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, address: "Bahariye Cd. No:1" });
    expect(r1.success && r1.data.address).toBe("Bahariye Cd. No:1");
    const r2 = CsvVenueImportRowSchema.safeParse({ ...BASE_ROW, address: "" });
    expect(r2.success && r2.data.address).toBeUndefined();
  });
});
```
- [ ] **Step 6:** Run — FAIL, then add to `csv-venue-import.schema.ts`:
```typescript
// Narrower than VenueStatusSchema (no ARCHIVED) -- CSV import only creates new venues.
export const CsvVenueStatusSchema = z.enum(["DRAFT", "PUBLISHED"]);
```
and to the row object:
```typescript
  status: z.preprocess((v) => (v === "" ? undefined : v), CsvVenueStatusSchema.optional()),
  address: z.preprocess((v) => (v === "" ? undefined : v), z.string().max(500).optional()),
```
- [ ] **Step 7:** Run — PASS (5 tests).

- [ ] **Step 8: Write the failing test — `venue.schema.spec.ts`** (add `import { z } from "zod";` at
      the top of this test file alongside the other imports — needed for the inline `z.object(...)`
      wrapper used to test `OptionalTrueFlag` in isolation). **This step deliberately does NOT
      touch `VenueListQuerySchema`'s `lat`/`lng`/`isBoutique`/`openNow` fields, NOR
      `VenueDetailSchema`'s new fields** — round 4's plan-red-team found the `VenueListQuery`
      instance of this problem (removing `lat`/`lng` here breaks `searchPublished`, which isn't
      fixed until Task 4); round 5 found the SAME CLASS of bug on `VenueDetailSchema`: making
      `lat`/`lng`/`address`/`photos` REQUIRED here, before `findBySlug` (Task 5) actually produces
      them, means every `GET /venues/:slug` request between this task and Task 5 would fail Zod
      validation at runtime (`VenuesService.detail()` parses `findBySlug`'s result against this
      schema) — a regression window this plan itself would introduce, worse than a caught
      `tsc` error because nothing here is a compile-time check. Both schema changes now happen
      in their consumer's own task (`VenueListQuerySchema` in Task 4, `VenueDetailSchema` in
      Task 5). This step only adds the `OptionalTrueFlag` helper, a pure addition:
```typescript
import { z } from "zod";
import { OptionalTrueFlag } from "./venue.schema";

describe("OptionalTrueFlag", () => {
  it("stays undefined when absent", () => expect(z.object({ flag: OptionalTrueFlag }).parse({}).flag).toBeUndefined());
  it("parses 'true' as true", () => expect(z.object({ flag: OptionalTrueFlag }).parse({ flag: "true" }).flag).toBe(true));
  it("rejects 'false'", () => expect(z.object({ flag: OptionalTrueFlag }).safeParse({ flag: "false" }).success).toBe(false));
});
```
- [ ] **Step 9:** Run — FAIL, then in `venue.schema.ts` add ONLY:
```typescript
// z.coerce.boolean() is a footgun: Boolean("false") is true. A naive
// z.literal("true").optional().transform(v => v === "true") is ALSO wrong -- absent -> v is
// undefined -> undefined === "true" is false, collapsing "not requested" into "explicitly off".
// Not yet applied to VenueListQuerySchema here -- see this task's Step 8 note; that happens
// atomically with its consumer in Task 4.
export const OptionalTrueFlag = z.literal("true").optional().transform((v) => (v === undefined ? undefined : true));
```
That is the ONLY production-code change in this step. Do not also touch `VenueListQuerySchema`
(Task 4 removes its `lat`/`lng`, replaces `isBoutique: z.coerce.boolean().optional()` with
`OptionalTrueFlag`, adds `openNow: OptionalTrueFlag`) or `VenueDetailSchema` (Task 5 adds
`lat`/`lng`/`address`/`photos`, atomically with `findBySlug`) — both are deliberately deferred to
their consumer's own task, per Step 8's note above.
- [ ] **Step 10:** Run — PASS.

- [ ] **Step 11: Write the failing test — `admin-queue.schema.spec.ts`**, matching the REAL
      current schema's fields exactly (`packages/shared/src/schemas/admin-queue.schema.ts`, read
      in full — `AdminQueueItemSchema` requires `id`, `type`, `venueId`, `payload`, `submittedBy`,
      `status`, `reviewedBy`, `reviewedAt`, `createdAt`, `venue`, `urgent`;
      `AdminQueueMutationResultSchema` requires `id`, `type`, `venueId`, `payload`, `submittedBy`,
      `status`, `reviewedBy`, `reviewedAt`, `createdAt` — no `venue`/`urgent`):
```typescript
describe("AdminQueueItemSchema / AdminQueueMutationResultSchema type enum", () => {
  const itemBase = {
    id: "d290f1ee-6c54-4b01-90e6-d701748f0851", venueId: "d290f1ee-6c54-4b01-90e6-d701748f0852",
    payload: { kind: "re_verify" }, submittedBy: null, status: "PENDING" as const,
    reviewedBy: null, reviewedAt: null, createdAt: "2026-07-24T00:00:00.000Z",
    venue: { name: "X", slug: "x" }, urgent: false,
  };
  const mutationBase = {
    id: itemBase.id, venueId: itemBase.venueId, payload: itemBase.payload,
    submittedBy: null, status: "PENDING" as const, reviewedBy: null, reviewedAt: null,
    createdAt: itemBase.createdAt,
  };
  it("AdminQueueItemSchema accepts type EDIT, not just REPORT", () => {
    expect(AdminQueueItemSchema.safeParse({ ...itemBase, type: "EDIT" }).success).toBe(true);
  });
  it("AdminQueueMutationResultSchema accepts type EDIT, not just REPORT", () => {
    expect(AdminQueueMutationResultSchema.safeParse({ ...mutationBase, type: "EDIT" }).success).toBe(true);
  });
});
```
- [ ] **Step 12:** Run — FAIL, then change both schemas' `type` field from `z.literal("REPORT")`
      to `z.enum(["REPORT", "EDIT"])`. Update the stale comment above `AdminQueueItemSchema.type`
      — it currently says "this app only ever queries type=REPORT," which conflates two different
      things: `AdminQueueService.list()`/`getQueue()` still filters by `type=REPORT` by design
      (the design doc's queue UI is REPORT-focused; this is unchanged), but an individual item
      fetched or mutated by id (`approve`/`reject`, Task 3) can now genuinely be an `EDIT` item.
      Reword the comment to state that distinction rather than deleting the REPORT-only claim
      about `list()`/`getQueue()`, which remains true.
- [ ] **Step 13:** Run — PASS.

- [ ] **Step 14:** Run: `cd packages/shared && npx vitest run && npx tsc --noEmit` — all pass.
- [ ] **Step 15:** Commit
```bash
git add packages/shared/src/schemas
git commit -m "feat(shared): add status/address/photos fields, fix optional-boolean pattern, widen admin-queue type enum"
```

---

## Task 3: Write/versioning path — `VenuesRepository` writes + every direct caller (atomic)

Owns: `createWithLocation`, `updateWithLocation`, `findRawForSnapshot`, `snapshotToUpdateInput`.
These four are used (directly or transitively) ONLY by `AdminVenuesService`, `seed.ts`,
`BoutiqueService` (via `AdminVenuesService`), and `AdminQueueService` — none of them are used by
the read/query path (Task 4). This is the actual dependency boundary the prior round's "task too
big" finding was pointing at.

**Files:**
- Modify: `apps/api/src/venues/venues.repository.ts` (write methods only — `searchPublished`/
  `findBySlug` untouched here, see Tasks 4/5), `apps/api/src/admin/venues/admin-venues.service.ts`,
  `apps/api/prisma/seed.ts`, `apps/api/src/rule-engine/boutique.service.ts`,
  `apps/api/src/admin/queue/admin-queue.service.ts`, `admin-queue.module.ts`
- Test: `venues.repository.spec.ts`, `admin-venues.service.spec.ts`, `boutique.service.spec.ts`,
  `admin-queue.service.spec.ts`, `apps/api/test/app.e2e-spec.ts` (append), a new
  `apps/api/test/admin-venues-rollback.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 2's `AdminVenueCreateInput`/`UpdateInput`
- Produces: as above, plus `AdminVenuesService.create/update/revert` (status-aware, transactional),
  `AdminQueueService.approve` (REPORT/EDIT branching), `BoutiqueService.evaluate` (status-gated).

- [ ] **Step 1: Write the failing tests for client-param + Google fields + B11 (update side)**
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
    expect(call.strings.join("")).toContain("googleRating");
    expect(call.values).toEqual(expect.arrayContaining([4.5, 10, "place123", "Adres 1"]));
  });
});

describe("VenuesRepository.updateWithLocation — zero-coordinate and explicit-null handling", () => {
  it("includes a lat=0/lng=0 update", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1" }]) } as any;
    await new VenuesRepository({} as any).updateWithLocation(client, "v1", { lat: 0, lng: 0 });
    const call = client.$queryRaw.mock.calls[0][0];
    expect(call.strings.join("")).toContain("location");
    expect(call.values).toContain(0);
  });
  it("accepts explicit null for nullable fields (needed by revert restoring a cleared field)", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1" }]) } as any;
    await new VenuesRepository({} as any).updateWithLocation(client, "v1", { editorialNote: null, address: null });
    expect(client.$queryRaw.mock.calls[0][0].values).toContain(null);
  });
});
```
- [ ] **Step 2:** Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts -t "client parameter|zero-coordinate"` — FAIL (real `createWithLocation(input)`/`updateWithLocation(id, input)` take no client param, don't write Google/address/photos — confirmed by reading the file).

- [ ] **Step 3: Update the interfaces in `venues.repository.ts`**, including `AdminVenueRow`
      itself (the prior round missed this — every fixture typed as `AdminVenueRow` that includes
      `address`/`photos` would otherwise fail an excess-property check):
```typescript
export interface AdminVenueRow {
  id: string;
  name: string;
  slug: string;
  districtId: string;
  category: string;
  cuisineType: string | null;
  priceRange: string;
  signatureItems: string[];
  transportNote: string | null;
  openingHours: Prisma.JsonValue;
  editorialNote: string | null;
  isBoutique: boolean;
  branchCount: number;
  franchiseFlag: boolean;
  source: string;
  verifiedAt: Date;
  status: string;
  googleRating: number | null;
  googleRatingCount: number | null;
  googlePlaceId: string | null;
  featured: boolean;
  address: string | null;
  photos: string[];
  createdAt: Date;
  updatedAt: Date;
  lat: number;
  lng: number;
}

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

// Update semantics differ from create: `undefined` means "leave alone"; for nullable-in-DB fields,
// `null` is a distinct, meaningful value ("clear this field") -- needed by revert() restoring a
// venue to a state where e.g. editorialNote was empty.
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
Remove the constructor-injected `this.prisma` usage inside this method — it uses `client` only.

- [ ] **Step 5: Rewrite `updateWithLocation`** — same signature change, add FIVE new assignments
      (Google fields, `address`, AND `photos` — round 4's plan-red-team caught that an earlier
      draft of this step added `address` but silently dropped `photos`, meaning
      `UpdateVenueWithLocationInput.photos` would type-check but never actually reach the
      database); the existing `lat`/`lng` combined check (`input.lat !== undefined && input.lng !== undefined`,
      confirmed already correct in the real file — this is NOT the B11 bug, that's on the search
      side, fixed in Task 4) stays as-is. Add a test for `photos` alongside the existing
      Google-fields test from Step 1, since this exact omission has no other coverage:
```typescript
  it("includes photos in the UPDATE (round 4 catch: previously silently dropped)", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1" }]) } as any;
    await new VenuesRepository({} as any).updateWithLocation(client, "v1", { photos: ["p1", "p2"] });
    const call = client.$queryRaw.mock.calls[0][0];
    expect(call.strings.join("")).toContain("photos");
    expect(call.values).toEqual(expect.arrayContaining([["p1", "p2"]]));
  });
```
```typescript
async updateWithLocation(client: Pick<PrismaService, "$queryRaw">, id: string, input: UpdateVenueWithLocationInput): Promise<AdminVenueRow> {
    // ...existing per-field assignments unchanged, plus:
    if (input.googleRating !== undefined) assignments.push(Prisma.sql`"googleRating" = ${input.googleRating}`);
    if (input.googleRatingCount !== undefined) assignments.push(Prisma.sql`"googleRatingCount" = ${input.googleRatingCount}`);
    if (input.googlePlaceId !== undefined) assignments.push(Prisma.sql`"googlePlaceId" = ${input.googlePlaceId}`);
    if (input.address !== undefined) assignments.push(Prisma.sql`address = ${input.address}`);
    if (input.photos !== undefined) assignments.push(Prisma.sql`photos = ${input.photos}`);
    // ...replace this.prisma.$queryRaw with client.$queryRaw in the final query call
```
- [ ] **Step 6:** Run — PASS (5 tests: the 4 from Step 1 + the `photos` test above).

- [ ] **Step 7: Write the failing test for `findRawForSnapshot`**
```typescript
describe("VenuesRepository.findRawForSnapshot", () => {
  it("returns the full row including lat/lng via raw SQL", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1", lat: 40.99, lng: 29.02 }]) } as any;
    const result = await new VenuesRepository({} as any).findRawForSnapshot(client, "v1");
    const sqlText = client.$queryRaw.mock.calls[0][0].strings.join("");
    expect(sqlText).toContain("ST_Y");
    expect(sqlText).toContain("ST_X");
    expect(result).toEqual({ id: "v1", lat: 40.99, lng: 29.02 });
  });
  it("throws NotFoundException when not found", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    await expect(new VenuesRepository({} as any).findRawForSnapshot(client, "missing")).rejects.toThrow("Mekan bulunamadı");
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

- [ ] **Step 10: Write the failing test for `snapshotToUpdateInput`** (this version includes
      `source`, closing round 3's finding that revert lost it):
```typescript
describe("snapshotToUpdateInput", () => {
  it("maps a raw snapshot row into a fully-typed update input including source, no cast needed", () => {
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
      status: "PUBLISHED", source: "MANUAL", googleRating: null, address: null, photos: [], lat: 40.99, lng: 29.02,
    });
  });
});
```
- [ ] **Step 11:** Run — FAIL, then implement:
```typescript
// Pure mapping, no DB access. revert() uses this to turn a VenueVersion snapshot back into a
// valid updateWithLocation input. `source` is included (round 3 finding: it was omitted, meaning
// revert lost that field). `verifiedAt` is deliberately NOT copied here -- revert() sets a fresh
// timestamp itself, treating a revert as a re-verification event, same as update().
export function snapshotToUpdateInput(row: AdminVenueRow): UpdateVenueWithLocationInput {
  return {
    name: row.name, slug: row.slug, districtId: row.districtId, category: row.category,
    cuisineType: row.cuisineType, priceRange: row.priceRange, signatureItems: row.signatureItems,
    transportNote: row.transportNote, openingHours: row.openingHours as Record<string, unknown>,
    editorialNote: row.editorialNote, isBoutique: row.isBoutique, branchCount: row.branchCount,
    franchiseFlag: row.franchiseFlag, status: row.status, source: row.source,
    googleRating: row.googleRating, googleRatingCount: row.googleRatingCount,
    googlePlaceId: row.googlePlaceId, address: row.address, photos: row.photos,
    lat: row.lat, lng: row.lng,
  };
}
```
- [ ] **Step 12:** Run — PASS.

- [ ] **Step 13: `apps/api/prisma/seed.ts`** — change its existing direct call
      `venuesRepository.createWithLocation({...})` to `venuesRepository.createWithLocation(prisma, {...})`.

- [ ] **Step 14: `BoutiqueService`** — write the failing test, then update:
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
Run — PASS. Update any pre-existing call site in `boutique.service.spec.ts` missing `status`.

- [ ] **Step 15: `AdminVenuesService`** — write the failing tests, then implement:
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
  it("wraps snapshot + update in a single transaction, completes isBoutique inputs from the DB", async () => {
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
  it("snapshots current state, applies the target version's snapshot via snapshotToUpdateInput, sets a fresh verifiedAt", async () => {
    const targetSnapshot = {
      id: "v1", name: "Old Name", lat: 40.9, lng: 29.0, status: "PUBLISHED", source: "MANUAL",
      cuisineType: null, priceRange: "MODERATE", signatureItems: [], transportNote: null,
      openingHours: {}, editorialNote: null, isBoutique: false, branchCount: 1, franchiseFlag: false,
      verifiedAt: new Date(), googleRating: null, googleRatingCount: null, googlePlaceId: null,
      featured: false, address: null, photos: [], createdAt: new Date(), updatedAt: new Date(),
    };
    const txClient = { venueVersion: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "ver1", venueId: "v1", snapshot: targetSnapshot }), create: jest.fn().mockResolvedValue({}) } };
    const prisma = { $transaction: jest.fn((fn) => fn(txClient)) } as any;
    const repo = {
      findRawForSnapshot: jest.fn().mockResolvedValue({ id: "v1", name: "Current Name", status: "PUBLISHED" }),
      updateWithLocation: jest.fn().mockResolvedValue({ id: "v1" }),
    } as any;
    const service = new AdminVenuesService(prisma, {} as any, repo);
    await service.revert("v1", "ver1");
    expect(txClient.venueVersion.create).toHaveBeenCalledWith({ data: { venueId: "v1", snapshot: expect.objectContaining({ name: "Current Name" }), createdBy: null } });
    expect(repo.updateWithLocation).toHaveBeenCalledWith(txClient, "v1", expect.objectContaining({ name: "Old Name", source: "MANUAL", verifiedAt: expect.any(Date) }));
  });
  it("throws NotFoundException if the version doesn't belong to this venue", async () => {
    const txClient = { venueVersion: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "ver1", venueId: "OTHER", snapshot: {} }) } };
    const prisma = { $transaction: jest.fn((fn) => fn(txClient)) } as any;
    const service = new AdminVenuesService(prisma, {} as any, { findRawForSnapshot: jest.fn() } as any);
    await expect(service.revert("v1", "ver1")).rejects.toThrow("Bu mekan için böyle bir versiyon bulunamadı");
  });
});
```
Run — FAIL, then replace the current `create`/`update`/`revert`:
```typescript
import { snapshotToUpdateInput } from "../../venues/venues.repository";
// ...

create(input: AdminVenueCreateInput) {
    const status = input.status ?? "DRAFT";
    const isBoutique = this.boutique.evaluate({ branchCount: input.branchCount, franchiseFlag: input.franchiseFlag, hasEditorialNote: !!input.editorialNote, status });
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
      // `version.snapshot` is a Prisma Json column -- its static type (Prisma.JsonValue) cannot
      // carry the domain knowledge that THIS snapshot was produced by findRawForSnapshot's
      // AdminVenueRow shape. This is the one place that knowledge is asserted; every field after
      // this cast flows through snapshotToUpdateInput's fully-typed signature.
      const restored = snapshotToUpdateInput(version.snapshot as unknown as AdminVenueRow);
      return this.venuesRepository.updateWithLocation(tx, venueId, { ...restored, verifiedAt: new Date() });
    });
}
```
(`createdBy: null` matches this codebase's existing pattern for system-initiated version rows —
verify against the live controller before finalizing; if it already threads a reviewer id into
`update`/`revert`, use that instead.)
Run — PASS.

- [ ] **Step 16: Write a real integration test proving the transaction actually rolls back**
      (a mock cannot prove this — the prior round correctly rejected the mock-based version).
      New file `apps/api/test/admin-venues-rollback.e2e-spec.ts`, using a real `PrismaClient`
      against the local Supabase stack directly (this avoids depending on `app.e2e-spec.ts`'s
      internal harness shape, which this plan hasn't read) and the repository's own
      `createWithLocation` (never `prisma.venue.create` — ADR 002 means the Prisma Client's model
      API cannot write the required `location` column, so seeding for this test must go through
      the repository):
```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { VenuesRepository } from "../src/venues/venues.repository";
import { AdminVenuesService } from "../src/admin/venues/admin-venues.service";
import { BoutiqueService } from "../src/rule-engine/boutique.service";

describe("AdminVenuesService.update — real rollback", () => {
  let prisma: PrismaClient;
  let venuesRepository: VenuesRepository;
  let adminVenuesService: AdminVenuesService;
  let seededVenueIds: string[] = [];

  beforeAll(() => {
    prisma = new PrismaService();
    venuesRepository = new VenuesRepository(prisma as unknown as PrismaService);
    adminVenuesService = new AdminVenuesService(prisma as unknown as PrismaService, new BoutiqueService(), venuesRepository);
  });

  afterEach(async () => {
    if (seededVenueIds.length > 0) {
      await prisma.venueVersion.deleteMany({ where: { venueId: { in: seededVenueIds } } });
      await prisma.venue.deleteMany({ where: { id: { in: seededVenueIds } } });
      seededVenueIds = [];
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("does not persist a VenueVersion snapshot when updateWithLocation fails mid-transaction", async () => {
    const district = await prisma.district.findFirstOrThrow();
    const venue = await venuesRepository.createWithLocation(prisma, {
      name: "Rollback Test Venue", slug: `rollback-test-${Date.now()}`, districtId: district.id,
      category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: {},
      isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
      verifiedAt: new Date(), status: "DRAFT", lat: 40.99, lng: 29.02,
    });
    seededVenueIds.push(venue.id);
    const versionsBefore = await prisma.venueVersion.count({ where: { venueId: venue.id } });
    // An invalid districtId FK forces updateWithLocation's UPDATE statement to fail after the
    // snapshot has already been created inside the same transaction -- this is the exact ordering
    // update() uses in production.
    await expect(adminVenuesService.update(venue.id, { districtId: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow();
    const versionsAfter = await prisma.venueVersion.count({ where: { venueId: venue.id } });
    expect(versionsAfter).toBe(versionsBefore);
  });
});
```
Run: `cd apps/api && npx jest test/admin-venues-rollback.e2e-spec.ts` — PASS (requires the local
Supabase stack up; confirm with `npx supabase status` first, and confirm `PrismaService`'s real
constructor signature takes no required arguments before using `new PrismaService()` directly —
adjust if it does).

- [ ] **Step 17: `AdminQueueService`** — write the failing tests, then implement (this closes the
      round-3 `tx: any` finding by typing the transaction client properly):
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
Prisma Client read that cannot see the `location` column per ADR 002 — unconditionally, even for
`REPORT` items, the exact A3/A4 bug):
```typescript
constructor(private prisma: PrismaService, private venuesRepository: VenuesRepository) {}

async approve(id: string, reviewerId: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const item = await tx.contributionQueue.findUniqueOrThrow({ where: { id } });
      if (item.status !== "PENDING") throw alreadyProcessedError();
      if (item.type === "EDIT" && item.venueId) {
        const snapshot = await this.venuesRepository.findRawForSnapshot(tx, item.venueId);
        await tx.venueVersion.create({ data: { venueId: item.venueId, snapshot: snapshot as unknown as Prisma.InputJsonValue, createdBy: reviewerId } });
        await tx.venue.update({ where: { id: item.venueId }, data: { verifiedAt: new Date() } });
      }
      // REPORT: intentionally does NOT touch Venue/VenueVersion -- approving a "this info is
      // wrong" report means "we've reviewed it," not "we've confirmed it's accurate." Any actual
      // correction happens through AdminVenuesService.update() (Step 15 above).
      return tx.contributionQueue.update({ where: { id }, data: { status: "APPROVED", reviewedBy: reviewerId, reviewedAt: new Date() } });
    });
}
```
In `admin-queue.module.ts`, add `import { VenuesModule } from "../../venues/venues.module";` and
`imports: [VenuesModule]`. Run — PASS (update the pre-existing EDIT-path test's constructor call
to inject `venuesRepository`).

- [ ] **Step 18:** Run: `cd apps/api && npx jest test/app.e2e-spec.ts` — PASS (confirms the DI change boots).

- [ ] **Step 19: Run this task's full scoped suite and commit**
Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts src/admin/venues src/rule-engine/boutique.service.spec.ts src/admin/queue test/app.e2e-spec.ts test/admin-venues-rollback.e2e-spec.ts && npx tsc --noEmit`
Expected: this whole-project `tsc --noEmit` is a legitimately valid gate at this exact point,
because Task 2 (packages/shared) deliberately did NOT remove `lat`/`lng` from `VenueListQuery` or
touch `isBoutique`/`openNow` on it yet — round 4's plan-red-team caught that an earlier draft
removed them in Task 2 while `VenuesRepository.searchPublished` (which reads `filters.lat`/
`filters.lng` off exactly that type) wasn't fixed until Task 4, which would have made this exact
step's `tsc --noEmit` claim false. That removal now happens in Task 4, atomically with
`searchPublished`'s rewrite. `VenuesController`/`VenuesService`/`DistrictsController` are
therefore genuinely untouched and already compiling at this point in the plan — nothing outside
this task's own files (`venues.repository.ts`'s write methods, `AdminVenuesService`, `seed.ts`,
`BoutiqueService`, `AdminQueueService`) referenced a signature changed here.
```bash
git add apps/api/src/venues/venues.repository.ts apps/api/src/admin/venues apps/api/src/admin/queue apps/api/src/rule-engine/boutique.service.ts apps/api/src/rule-engine/boutique.service.spec.ts apps/api/prisma/seed.ts apps/api/test
git commit -m "feat(api): transaction-aware venue writes, status-aware admin create/update/revert, REPORT/EDIT queue branching

Fixes A1 (admin create respects status), A3 (REPORT approval no longer
mutates Venue), A4 (update/revert/EDIT-approval snapshots are
transactional and location-inclusive, real rollback proven against
Postgres), B5 (boutique rule requires PUBLISHED). Single atomic commit:
createWithLocation/updateWithLocation/findRawForSnapshot/
snapshotToUpdateInput and every one of their callers land together."
```

---

## Task 4: Read/query path — `searchPublished` + every direct caller (atomic)

Owns: `searchPublished` (including the real B11 fix, on the search side this time — round 3 found
the prior draft only fixed the already-correct `updateWithLocation` side and missed the actually
broken `distanceSelect`/`radiusFilter`/`orderBy` truthiness checks). Its only callers are
`VenuesService.list`, which is only called by `VenuesController.list`; the location header
decorator is introduced here because `VenuesService.list`'s new second parameter is exactly what
it produces. `DistrictsController` is included because it's the other consumer of the same header
decorator, not because it depends on `searchPublished`.

**Files:**
- Modify: `packages/shared/src/schemas/venue.schema.ts` (`VenueListQuerySchema` — moved here from
  Task 2, see below), `apps/api/src/venues/venues.repository.ts` (search method only),
  `venues.service.ts`, `venues.controller.ts`
- Create: `apps/api/src/common/user-location.decorator.ts`
- Modify: `apps/api/src/districts/districts.controller.ts`
- Test: `packages/shared/src/schemas/venue.schema.spec.ts` (append), `venues.repository.spec.ts`,
  `venues.service.spec.ts`, `venues.controller.spec.ts`, `common/user-location.decorator.spec.ts`,
  `districts.controller.spec.ts`

**Interfaces:**
- Consumes: Task 2's `OptionalTrueFlag` helper (defined but not yet applied to
  `VenueListQuerySchema` — Task 2's Step 8 deliberately left this schema untouched; round 4's
  plan-red-team found that removing `lat`/`lng` in Task 2 broke `searchPublished` (which reads
  them) until this task ran, making Task 2/3's own acceptance gates false in between)
- Produces: `VenueListQuerySchema` with `lat`/`lng` removed, `isBoutique`/`openNow` on
  `OptionalTrueFlag`; `searchPublished(filters: VenueSearchFilters)` with the internal
  `VenueSearchFilters` type and a real `openNow` filter; `UserLocationParam`/
  `parseUserLocationHeader`; `VenuesService.list(query, location)` with sort-default logic.

- [ ] **Step 0: Write the failing test and change `VenueListQuerySchema`** (this is the schema
      change round 4 required be co-located with its consumer, not left in Task 2)
```typescript
// packages/shared/src/schemas/venue.schema.spec.ts (append)
describe("VenueListQuerySchema", () => {
  it("no longer accepts lat/lng", () => expect((VenueListQuerySchema.parse({ lat: "40.99", lng: "29.02" }) as any).lat).toBeUndefined());
  it("openNow=true parses, openNow=false rejects", () => {
    expect(VenueListQuerySchema.parse({ openNow: "true" }).openNow).toBe(true);
    expect(VenueListQuerySchema.safeParse({ openNow: "false" }).success).toBe(false);
  });
  it("isBoutique=false rejects", () => expect(VenueListQuerySchema.safeParse({ isBoutique: "false" }).success).toBe(false));
});
```
Run: `cd packages/shared && npx vitest run src/schemas/venue.schema.spec.ts` — FAIL, then read the
current `VenueListQuerySchema`, remove `lat`/`lng` and any sort-default `.transform()` (moves to
`VenuesService.list`, Step 11 below), replace `isBoutique: z.coerce.boolean().optional()` with
`OptionalTrueFlag` (defined in Task 2), add `openNow: OptionalTrueFlag`. Preserve every other
field (`districtId`/`category`/`priceRange`/`radiusM`/`sort`/`limit`/`cursor`) exactly. Run again
— PASS. This is the moment `searchPublished` (still reading `filters.lat`/`filters.lng` off this
type) breaks — fixed in the very next steps of this same task, before this task's own commit.

- [ ] **Step 1: Write the failing tests for B11 on the search side**
```typescript
describe("VenuesRepository.searchPublished — B11 zero-coordinate handling", () => {
  it("still applies distance sort and radius filter when lat=0/lng=0 (not falsy-and-ignored)", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    await new VenuesRepository(prisma).searchPublished({ sort: "distance", limit: 20, lat: 0, lng: 0, radiusM: 500 } as any);
    const sqlText = prisma.$queryRaw.mock.calls[0][0].strings.join("");
    expect(sqlText).toContain("ST_Distance");
    expect(sqlText).toContain("ST_DWithin");
    expect(sqlText).toMatch(/ORDER BY v\.location <->/);
  });
});
```
- [ ] **Step 2:** Run — FAIL (real code uses `filters.lat && filters.lng` for `distanceSelect`,
      `radiusFilter`, and `orderBy` — confirmed by reading `venues.repository.ts`; `lat: 0` is
      falsy in JS, so all three silently degrade to "no location provided").

- [ ] **Step 3: Fix all three truthiness checks to `!== undefined`**
```typescript
    const hasLocation = filters.lat !== undefined && filters.lng !== undefined;
    const distanceSelect = hasLocation
      ? Prisma.sql`, ST_Distance(v.location, ST_SetSRID(ST_MakePoint(${filters.lng}, ${filters.lat}), 4326)::geography) AS distance_m`
      : Prisma.sql``;
    const radiusFilter = hasLocation && filters.radiusM
      ? Prisma.sql`AND ST_DWithin(v.location, ST_SetSRID(ST_MakePoint(${filters.lng}, ${filters.lat}), 4326)::geography, ${filters.radiusM})`
      : Prisma.sql``;
    const orderBy = filters.sort === "distance" && hasLocation
      ? Prisma.sql`ORDER BY v.location <-> ST_SetSRID(ST_MakePoint(${filters.lng}, ${filters.lat}), 4326)::geography ASC`
      : Prisma.sql`ORDER BY v."createdAt" DESC`;
```
- [ ] **Step 4:** Run — PASS.

- [ ] **Step 5: Write the failing test for `isBoutique` (existing truthiness check confirmed
      already correct at `filters.isBoutique !== undefined` — no change needed there; this step
      just documents that verification), then write the failing tests for `openNow`**
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
- [ ] **Step 6:** Run — FAIL, then add the internal type and condition. Since Task 2 removed
      `lat`/`lng` from the public `VenueListQuery`, `searchPublished`'s parameter type must change
      in this same step:
```typescript
// Internal only. VenueListQuery no longer carries lat/lng (ADR 004) or a resolved sort;
// VenuesService.list() (below) merges the header-derived location and computed sort in.
type VenueSearchFilters = Omit<VenueListQuery, "sort"> & { sort: "distance" | "newest"; lat?: number; lng?: number };
```
Change `searchPublished(filters: VenueListQuery)` to `searchPublished(filters: VenueSearchFilters)`.
Add:
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
- [ ] **Step 7:** Run — PASS (2 tests).

- [ ] **Step 7b: Unit test the regex boundary directly** (round 4 finding: the "00-23 regex" and
      the design doc's explicit `""`/`"29:00-10:00"` malformed-value examples had no dedicated
      test — add them as pure regex assertions, independent of which day the suite runs on):
```typescript
describe("open_now opening-hours format regex (extracted for direct testing)", () => {
  const HOURS_FORMAT = /^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$/;
  it("accepts a valid HH:MM-HH:MM range", () => expect(HOURS_FORMAT.test("09:00-18:00")).toBe(true));
  it("accepts the boundary hour 23", () => expect(HOURS_FORMAT.test("00:00-23:59")).toBe(true));
  it("rejects an out-of-range hour", () => expect(HOURS_FORMAT.test("29:00-10:00")).toBe(false));
  it("rejects an empty string", () => expect(HOURS_FORMAT.test("")).toBe(false));
  it("rejects a non-numeric value", () => expect(HOURS_FORMAT.test("kapalı")).toBe(false));
});
```
(This regex is inlined directly into the SQL in Step 6, not extracted to a shared TS constant —
this test exists to prove the pattern itself is correct in isolation, copy-pasted identically.)

- [ ] **Step 8: Real-DB test for malformed `openingHours` fail-open — day-independent**
      New/append to `apps/api/test/app.e2e-spec.ts` or a new `apps/api/test/venues-open-now.e2e-spec.ts`.
      Round 4's plan-red-team correctly flagged that a fixed `openingHours: { mon_fri: "kapalı" }`
      fixture only actually exercises the fail-open path on Mon-Fri; run on a Saturday, the SQL
      evaluates the `sat_sun` branch instead, the malformed `mon_fri` value is never looked at, and
      the venue passes for the wrong reason (missing `sat_sun` key → `ELSE true`, not because the
      malformed-value regex-mismatch path was exercised). Fix: compute which bucket is "today" in
      the test itself and put the malformed value there, so the test is deterministic on every day:
```typescript
describe("GET /venues?openNow=true — fail-open on malformed data", () => {
  it("includes venues with unparseable or missing openingHours instead of excluding them", async () => {
    const district = await prisma.district.findFirstOrThrow();
    // ISODOW: 1=Monday...7=Sunday. Match the SQL's own bucket selection exactly so the malformed
    // value actually lands in the branch the query will evaluate today, on any day of the week.
    const isoDow = ((new Date().getDay() + 6) % 7) + 1; // JS getDay(): 0=Sunday -> ISODOW 7
    const todaysBucket: "mon_fri" | "sat_sun" = isoDow >= 1 && isoDow <= 5 ? "mon_fri" : "sat_sun";

    const malformed = await venuesRepository.createWithLocation(prisma, {
      name: "Malformed Hours Venue", slug: `malformed-hours-${Date.now()}`, districtId: district.id,
      category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: { [todaysBucket]: "kapalı" },
      isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
      verifiedAt: new Date(), status: "PUBLISHED", lat: 40.99, lng: 29.02,
    });
    const emptyString = await venuesRepository.createWithLocation(prisma, {
      name: "Empty String Hours Venue", slug: `empty-hours-${Date.now()}`, districtId: district.id,
      category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: { [todaysBucket]: "" },
      isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
      verifiedAt: new Date(), status: "PUBLISHED", lat: 40.99, lng: 29.02,
    });
    const outOfRange = await venuesRepository.createWithLocation(prisma, {
      name: "Out Of Range Hours Venue", slug: `oor-hours-${Date.now()}`, districtId: district.id,
      category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: { [todaysBucket]: "29:00-10:00" },
      isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
      verifiedAt: new Date(), status: "PUBLISHED", lat: 40.99, lng: 29.02,
    });
    const missing = await venuesRepository.createWithLocation(prisma, {
      name: "Missing Hours Venue", slug: `missing-hours-${Date.now()}`, districtId: district.id,
      category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: {},
      isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
      verifiedAt: new Date(), status: "PUBLISHED", lat: 40.99, lng: 29.02,
    });
    const { items } = await venuesRepository.searchPublished({ sort: "newest", limit: 50, openNow: true } as any);
    const ids = items.map((i: any) => i.id);
    expect(ids).toEqual(expect.arrayContaining([malformed.id, emptyString.id, outOfRange.id, missing.id]));
  });
});
```
Run — PASS (requires local Supabase stack up; confirm with `npx supabase status` first). This
test is now correct regardless of which day of the week it happens to run on.

- [ ] **Step 9: Write the failing test — `user-location.decorator.spec.ts`** (new)
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
- [ ] **Step 10:** Run — FAIL, then create `apps/api/src/common/user-location.decorator.ts`:
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

- [ ] **Step 11: `VenuesService.list` sort-default** — write the failing test, then update:
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
  it("an explicit sort=distance with no header still reaches the repository as sort=distance -- the repository's own hasLocation guard (Step 3) is what actually falls back to createdAt ordering, not this service", async () => {
    const repo = { searchPublished: jest.fn().mockResolvedValue({ items: [], nextCursor: null }) } as any;
    await new VenuesService(repo).list({ limit: 20, sort: "distance" } as any, undefined);
    expect(repo.searchPublished).toHaveBeenCalledWith(expect.objectContaining({ sort: "distance", lat: undefined, lng: undefined }));
  });
});
```
```typescript
list(query: VenueListQuery, location?: UserLocation) {
    const sort = query.sort ?? (location ? "distance" : "newest");
    return this.repo.searchPublished({ ...query, sort, lat: location?.lat, lng: location?.lng });
}
```
Run — PASS (3 tests).

- [ ] **Step 12: `VenuesController.list`** — read the real current file (method-level
      `@UsePipes(new ZodValidationPipe(VenueListQuerySchema))`, confirmed). Replace with
      parameter-scoped validation plus the location param:
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
Remove the old method-level `@UsePipes(...)` — at method scope it would try to validate
`location`'s return value against `VenueListQuerySchema` too and corrupt it.
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
Run: `cd apps/api && npx jest src/venues/venues.controller.spec.ts` — PASS. This test exercises the
controller method as a plain function, which proves the method's own argument-passing didn't
change — it does NOT exercise Nest's actual runtime pipe execution. Round 4's plan-red-team
correctly rejected assuming `app.e2e-spec.ts` already covers this without checking; add a real
HTTP test instead of assuming it exists:
```typescript
// apps/api/test/app.e2e-spec.ts (append)
describe("GET /v1/venues — header doesn't get corrupted by the query pipe", () => {
  it("returns 200 with both a query filter and the X-User-Location header present", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/venues?limit=5")
      .set("X-User-Location", "40.99,29.02");
    expect(response.status).toBe(200);
  });
});
```
(Match this to whatever HTTP client `app.e2e-spec.ts` already uses — read it first.) Run:
`cd apps/api && npx jest test/app.e2e-spec.ts` — PASS. A 500 here would mean the method-level
`@UsePipes` bug (Task 4's whole reason for existing) is still present.

- [ ] **Step 13: `DistrictsController.findNearest`** — write the failing test, then require the header:
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

- [ ] **Step 14: Run this task's full scoped suite and commit**
Run: `cd packages/shared && npx vitest run && npx tsc --noEmit && cd ../../apps/api && npx jest src/venues src/districts src/common test/app.e2e-spec.ts && npx tsc --noEmit`
```bash
git add packages/shared/src/schemas/venue.schema.ts apps/api/src/venues apps/api/src/common/user-location.decorator.ts apps/api/src/common/user-location.decorator.spec.ts apps/api/src/districts apps/api/test
git commit -m "feat(api): X-User-Location header (ADR 004) replaces lat/lng query params, open_now filter, B11 fix on the search side

searchPublished's distanceSelect/radiusFilter/orderBy used truthiness
checks on lat/lng, silently dropping location for lat=0/lng=0 -- fixed to
!== undefined. Single atomic commit: searchPublished's signature change
and its only callers (VenuesService, VenuesController, DistrictsController)
land together."
```

---

## Task 5: `findBySlug` rewrite + `VenueDetailSchema`'s new required fields (atomic)

Owns both the producer (`findBySlug`) and its schema contract (`VenueDetailSchema`) in the same
task — round 5's plan-red-team found the same class of cross-task acceptance cycle here that
round 4 found for `VenueListQuerySchema`/`searchPublished`: making `lat`/`lng`/`address`/`photos`
required on `VenueDetailSchema` in Task 2, before `findBySlug` actually produced them, would mean
every `GET /venues/:slug` request in between fails Zod validation at runtime. Both changes now
land together.

**Files:**
- Modify: `apps/api/src/venues/venues.repository.ts` (`findBySlug` only)
- Modify: `packages/shared/src/schemas/venue.schema.ts` (`VenueDetailSchema`)
- Test: `venues.repository.spec.ts`, `packages/shared/src/schemas/venue.schema.spec.ts` (append)

**Interfaces:** Consumes Task 1's `address`/`photos` columns. Produces `findBySlug(slug)` now
returning `lat`/`lng`/`address`/`photos`/nested `district: {name, slug}`, AND
`VenueDetailSchema` requiring those same fields — both in this one commit.
`VenuesService.detail()` calls `findBySlug` with no arity change and passes the result straight
through to `VenueDetailSchema`; no caller code changes, only richer data flows through, and the
schema is only made stricter at the exact moment the data backing it exists.

- [ ] **Step 0: Write the failing test for `VenueDetailSchema`, then add the fields**
```typescript
// packages/shared/src/schemas/venue.schema.spec.ts (append)
describe("VenueDetailSchema", () => {
  const FULL = {
    id: "d290f1ee-6c54-4b01-90e6-d701748f0851", slug: "x", name: "X", category: "cafe",
    cuisineType: null, priceRange: "MODERATE", signatureItems: [], transportNote: null,
    openingHours: {}, editorialNote: null, isBoutique: false,
    verifiedAt: "2026-07-24T00:00:00.000Z", source: "MANUAL", googleRating: null,
    googleRatingCount: null, googlePlaceId: null, district: { name: "Kadıköy", slug: "kadikoy" },
    lat: 40.99, lng: 29.02, address: null, photos: [],
  };
  it("accepts the full shape", () => expect(VenueDetailSchema.safeParse(FULL).success).toBe(true));
  it("rejects when lat/lng are missing (proves required, not silently stripped)", () => {
    const { lat, lng, ...rest } = FULL;
    expect(VenueDetailSchema.safeParse(rest).success).toBe(false);
  });
  it("round-trips address/photos (proves captured, not stripped)", () => {
    const parsed = VenueDetailSchema.parse({ ...FULL, address: "Bahariye Cd. No:1", photos: ["p1"] });
    expect(parsed.address).toBe("Bahariye Cd. No:1");
    expect(parsed.photos).toEqual(["p1"]);
  });
});
```
Run: `cd packages/shared && npx vitest run src/schemas/venue.schema.spec.ts` — FAIL, then add to
`VenueDetailSchema` after `district`:
```typescript
  lat: z.number(),
  lng: z.number(),
  address: z.string().nullable(),
  photos: z.array(z.string()),
```
Run again — PASS. **Do not run `cd packages/shared && npx tsc --noEmit` as this task's acceptance
gate in isolation** — the meaningful gate is Step 4 below, after `findBySlug` actually produces
these fields, at which point `packages/shared`'s own build is unaffected either way (Zod schema
requiredness is a runtime concern, not a type-level one here since `findBySlug`'s return type
was already loosely typed) but the API's actual runtime behavior is what round 5 was correcting.

- [ ] **Step 1: Write the failing test for `findBySlug`**
```typescript
describe("VenuesRepository.findBySlug — location and new fields", () => {
  it("returns lat/lng, address, photos, nested district via raw SQL, filters PUBLISHED", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{
      id: "v1", slug: "a", name: "A", lat: 40.99, lng: 29.02, address: "Adres 1", photos: ["p1"],
      district: { name: "Kadıköy", slug: "kadikoy" },
    }]) } as any;
    const result = await new VenuesRepository(prisma).findBySlug("a");
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
- [ ] **Step 2:** Run — FAIL (current `findBySlug` uses `prisma.venue.findFirst`, no lat/lng),
      then replace with a named row type instead of `$queryRaw<any[]>` (round 4's plan-red-team
      correctly flagged `any[]` here as an unjustified use of the forbidden type — this row shape
      is exactly enumerable from the `SELECT` list, so there is no reason not to name it):
```typescript
interface VenueDetailRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  cuisineType: string | null;
  priceRange: string;
  signatureItems: string[];
  transportNote: string | null;
  openingHours: Prisma.JsonValue;
  editorialNote: string | null;
  isBoutique: boolean;
  verifiedAt: Date;
  source: string;
  googleRating: number | null;
  googleRatingCount: number | null;
  googlePlaceId: string | null;
  address: string | null;
  photos: string[];
  lat: number;
  lng: number;
  district: { name: string; slug: string };
}

async findBySlug(slug: string): Promise<VenueDetailRow | undefined> {
    const rows = await this.prisma.$queryRaw<VenueDetailRow[]>(Prisma.sql`
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
- [ ] **Step 3:** Run — PASS (2 tests). Confirm `VenuesService.detail()`'s existing call site
      still compiles against the new `VenueDetailRow | undefined` return type (it should — this is
      strictly narrower than the previous untyped `any`, not a shape change).
- [ ] **Step 4:** Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts src/venues/venues.service.spec.ts` — confirm `VenuesService.detail()`'s existing tests still pass unchanged, and now genuinely exercise the required `lat`/`lng`/`address`/`photos` fields end-to-end (schema + producer landed together in this task).
- [ ] **Step 5:** Commit
```bash
git add apps/api/src/venues/venues.repository.ts packages/shared/src/schemas/venue.schema.ts
git commit -m "fix(api): findBySlug returns venue coordinates, address, photos via raw SQL, VenueDetailSchema requires them atomically"
```

---

## Task 6: CSV import defaults to PUBLISHED, passes `status`/`address` through

**Files:**
- Modify: `apps/api/src/admin/venues/admin-venues.service.ts` (`importRows`)
- Test: `apps/api/src/admin/venues/csv-import.service.spec.ts` (append),
  `apps/api/src/admin/venues/admin-venues.service.spec.ts` (append)

**Interfaces:** Consumes Task 2's `CsvVenueStatusSchema`/`address`, Task 3's `create()`. Produces
CSV-imported venues defaulting to `PUBLISHED` unless the row says `DRAFT`; `address` reaches `createWithLocation`.

- [ ] **Step 1: Write a confirming test against the real `CsvImportService.parseRows`**
      (`apps/api/src/admin/venues/csv-import.service.ts`). Note this is a confirming test, not a
      red-green cycle in the strict sense: Task 2 already added `status`/`address` to
      `CsvVenueImportRowSchema`, which `parseRows` calls via `.safeParse(record)` — so this test
      should already pass once Task 2 has landed. Write it anyway, as the executable proof that
      the schema change actually reaches a real multi-row CSV string (not just a single parsed
      object), which is exactly what round 2 flagged as missing:
```typescript
describe("CsvImportService.parseRows — status/address columns", () => {
  it("parses a CSV with one row omitting status and one row setting DRAFT + address", () => {
    const csv =
      "name,slug,districtSlug,category,priceRange,branchCount,franchiseFlag,lat,lng,openingHours,status,address\n" +
      'A,a,kadikoy,cafe,MODERATE,1,false,40.99,29.02,"{""mon_fri"":""09:00-18:00""}",,\n' +
      'B,b,kadikoy,cafe,MODERATE,1,false,40.98,29.01,"{""mon_fri"":""09:00-18:00""}",DRAFT,"Bahariye Cd. No:1"\n';
    const { valid, errors } = new CsvImportService().parseRows(csv);
    expect(errors).toEqual([]);
    expect(valid[0].data.status).toBeUndefined();
    expect(valid[1].data.status).toBe("DRAFT");
    expect(valid[1].data.address).toBe("Bahariye Cd. No:1");
  });
});
```
- [ ] **Step 2:** Run: `cd apps/api && npx jest src/admin/venues/csv-import.service.spec.ts` —
      if this fails, the gap is in `csv-parse`'s handling of the trailing empty `status` cell or
      quoting, not the Zod schema — add a temporary `console.log(records)` right before the
      `safeParse` call inside `parseRows` to see the raw parsed object and diagnose, then remove
      the log before committing. If it already passes, proceed directly to Step 4 — this file
      needed no production code change.

- [ ] **Step 3: (only if Step 2 failed) fix the actual gap found**, then re-run to PASS.

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
- [ ] **Step 5:** Run — FAIL, then in `importRows`'s existing `this.create({...})` call add:
```typescript
          status: row.status ?? "PUBLISHED",
          address: row.address,
```
- [ ] **Step 6:** Run — PASS (all).

- [ ] **Step 6b: Write the real end-to-end proof — CSV import result is visible in `GET /venues`.**
      Round 4's plan-red-team correctly flagged that the design doc's actual acceptance criterion
      for A1 ("CSV path publishes a venue visibly") was not met by unit/mock tests alone. New file
      `apps/api/test/csv-import-visibility.e2e-spec.ts`, same real-`PrismaClient` pattern as Task
      3's rollback test:
```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { VenuesRepository } from "../src/venues/venues.repository";
import { AdminVenuesService } from "../src/admin/venues/admin-venues.service";
import { BoutiqueService } from "../src/rule-engine/boutique.service";

describe("CSV import -> GET /venues visibility", () => {
  let prisma: PrismaClient;
  let adminVenuesService: AdminVenuesService;
  let seededSlug: string;

  beforeAll(() => {
    prisma = new PrismaService();
    const venuesRepository = new VenuesRepository(prisma as unknown as PrismaService);
    adminVenuesService = new AdminVenuesService(prisma as unknown as PrismaService, new BoutiqueService(), venuesRepository);
  });

  afterEach(async () => {
    if (seededSlug) await prisma.venue.deleteMany({ where: { slug: seededSlug } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("a CSV row with no status column becomes PUBLISHED and appears in searchPublished", async () => {
    const district = await prisma.district.findFirstOrThrow();
    seededSlug = `csv-visibility-${Date.now()}`;
    const { rowErrors } = await adminVenuesService.importRows([{
      row: 1,
      data: {
        name: "CSV Visibility Test", slug: seededSlug, districtSlug: district.slug, category: "cafe",
        priceRange: "MODERATE", branchCount: 1, franchiseFlag: false, lat: 40.99, lng: 29.02,
        openingHours: {},
      } as any,
    }]);
    expect(rowErrors).toEqual([]);
    const created = await prisma.venue.findUniqueOrThrow({ where: { slug: seededSlug } });
    expect(created.status).toBe("PUBLISHED");
    const venuesRepository = new VenuesRepository(prisma as unknown as PrismaService);
    const { items } = await venuesRepository.searchPublished({ sort: "newest", limit: 50 } as any);
    expect(items.map((i: any) => i.slug)).toContain(seededSlug);
  });
});
```
Run: `cd apps/api && npx jest test/csv-import-visibility.e2e-spec.ts` — PASS (requires the local
Supabase stack up).

- [ ] **Step 7:** Commit
```bash
git add apps/api/src/admin/venues/admin-venues.service.ts apps/api/src/admin/venues/csv-import.service.spec.ts apps/api/test/csv-import-visibility.e2e-spec.ts
git commit -m "feat(api): CSV import defaults venues to PUBLISHED, passes status/address through, e2e-proven visible in GET /venues"
```

---

## Task 7: Favorites and nearest-district PUBLISHED checks (B9, B10)

**Files:**
- Modify: `apps/api/src/favorites/favorites.service.ts`, `apps/api/src/districts/districts.repository.ts`
- Test: corresponding `.spec.ts` (append)

**Interfaces:** Consumes nothing new. Produces `FavoritesService.addVenue` rejecting non-`PUBLISHED`
venues (404); `findNearestDistrict` filtering `status='PUBLISHED'`, returning `cityId`/`slug`.

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
- [ ] **Step 2:** Run — FAIL, then add before the existing `upsert` in `addVenue`:
```typescript
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue || venue.status !== "PUBLISHED") {
      const notFound = new NotFoundException({ error: { code: "VENUE_NOT_FOUND", message: "Mekan bulunamadı" } });
      notFound.message = "Mekan bulunamadı";
      throw notFound;
    }
```
- [ ] **Step 3:** Run — PASS.

- [ ] **Step 4: Write the failing test for `findNearestDistrict`** (`apps/api/src/districts/districts.repository.ts`, confirmed real path):
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

## Task 8: bbox and UUID path-param validation (B12)

**Files:**
- Modify: `packages/shared/src/schemas/venue.schema.ts` (bbox schema)
- Modify: `apps/api/src/venues/venues.controller.ts` (bbox)
- Modify: `apps/api/src/admin/queue/admin-queue.controller.ts` (`approve`/`reject` `:id`)
- Modify: `apps/api/src/admin/users/admin-users.controller.ts` (`assignRole` `:id`)
- Modify: `apps/api/src/admin/venues/admin-venues.controller.ts` (`update` `:id`, `revert` `:id`/`:versionId`)
- Modify: `apps/api/src/favorites/favorites.controller.ts` (`addVenue` `:id`)
- Modify: `apps/api/src/reports/reports.controller.ts` (`submit` `:id`)
- Test: corresponding `.spec.ts` (append) — UUID pipe tests invoke `ParseUUIDPipe` directly, not through the controller.

**Interfaces:** Consumes nothing new. Produces `BboxQuerySchema`; UUID validation on every `:id`/
`:versionId` path param listed above (`venues.controller.ts`'s `:slug` is NOT touched).

- [ ] **Step 1: Add `BboxQuerySchema`** to `packages/shared/src/schemas/venue.schema.ts`. Guard
      against empty string parts BEFORE calling `Number()` on them — `Number("")` is `0`, the same
      footgun this plan already fixed once for `parseUserLocationHeader` (Task 4); a bbox like
      `",40.9,29.1,41"` must not silently become `[0, 40.9, 29.1, 41]`:
```typescript
export const BboxQuerySchema = z.object({
  bbox: z.string().transform((s, ctx) => {
    const rawParts = s.split(",");
    if (rawParts.length !== 4 || rawParts.some((p) => p.trim() === "")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "bbox must be 4 comma-separated finite numbers" });
      return z.NEVER;
    }
    const parts = rawParts.map(Number);
    if (parts.some((n) => !Number.isFinite(n))) {
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
  it("rejects an empty leading part instead of treating it as 0 (Number('')===0 footgun)", () => expect(BboxQuerySchema.safeParse({ bbox: ",40.9,29.1,41" }).success).toBe(false));
  it("accepts a well-formed bbox", () => expect(BboxQuerySchema.parse({ bbox: "29.0,40.9,29.1,41.0" }).bbox).toEqual([29.0, 40.9, 29.1, 41.0]));
});
```
Run: `cd packages/shared && npx vitest run src/schemas/venue.schema.spec.ts` — PASS.

- [ ] **Step 3: Wire into `VenuesController.mapView`**
```typescript
@Get("map")
@RateLimit(100, 60)
mapView(@Query(new ZodValidationPipe(BboxQuerySchema)) query: { bbox: [number, number, number, number] }) {
  return this.venues.mapView(query.bbox);
}
```
Write a test that constructs the pipe directly (not through the controller):
```typescript
describe("mapView bbox validation via ZodValidationPipe", () => {
  it("throws on a malformed bbox", () => {
    expect(() => new ZodValidationPipe(BboxQuerySchema).transform({ bbox: "not,numbers,here" }, {} as any)).toThrow();
  });
});
```
Run: `cd apps/api && npx jest src/venues/venues.controller.spec.ts` — PASS.

- [ ] **Step 4: Add `ParseUUIDPipe` to every path param above.** For each, write a test that
      constructs the pipe directly and calls `.transform()` — this actually exercises
      `ParseUUIDPipe`, unlike calling the controller method directly (which bypasses Nest's pipe
      execution entirely and was round 3's finding):
```typescript
describe("UUID path-param validation", () => {
  it("ParseUUIDPipe rejects a non-UUID id with a 400-mapped exception", async () => {
    const pipe = new ParseUUIDPipe({ errorHttpStatusCode: 400 });
    await expect(pipe.transform("not-a-uuid", { type: "param", data: "id" } as any)).rejects.toThrow();
  });
  it("ParseUUIDPipe accepts a real UUID", async () => {
    const pipe = new ParseUUIDPipe({ errorHttpStatusCode: 400 });
    await expect(pipe.transform("d290f1ee-6c54-4b01-90e6-d701748f0851", { type: "param", data: "id" } as any)).resolves.toBe("d290f1ee-6c54-4b01-90e6-d701748f0851");
  });
});
```
(One such test suffices to prove `ParseUUIDPipe` itself behaves correctly; it is the same class
instance applied identically across all six methods, so this is not tested six times.) Then apply
the pipe to each parameter:
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
(`venues.controller.ts`'s `detail(@Param("slug") slug: string)` is unchanged.)

- [ ] **Step 5:** Run: `cd apps/api && npx jest src/venues src/admin src/favorites src/reports` — PASS.

- [ ] **Step 6: Add a real HTTP test proving the pipe is actually wired at the route level** —
      round 4's plan-red-team correctly noted that simply re-running the existing
      `app.e2e-spec.ts` proves nothing new about this task's change, since that file doesn't yet
      contain a request exercising these routes with a malformed id. Append one concrete case to
      `apps/api/test/app.e2e-spec.ts` (using whatever HTTP test client that file already sets up —
      read it first to match its existing request-building pattern; the shape below assumes a
      `supertest`-style `app.inject` or `request(app.getHttpServer())` call, adjust to match):
```typescript
describe("UUID path-param validation — wired at the route level", () => {
  it("GET /v1/admin/venues/not-a-uuid returns 400, not a PostGIS/Prisma error", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/admin/venues/not-a-uuid")
      .set("Authorization", `Bearer ${curatorToken}`); // reuse whatever auth setup app.e2e-spec.ts already has for admin routes
    expect(response.status).toBe(400);
  });
});
```
Run: `cd apps/api && npx jest test/app.e2e-spec.ts` — PASS. This is the test that actually proves
route-level wiring; the direct `.transform()` test in Step 4 only proves the `ParseUUIDPipe` class
itself behaves correctly in isolation.

- [ ] **Step 7:** Commit
```bash
git add packages/shared/src/schemas/venue.schema.ts apps/api/src/venues apps/api/src/admin apps/api/src/favorites apps/api/src/reports apps/api/test/app.e2e-spec.ts
git commit -m "fix(api): bbox and UUID path-param validation (B12), Zod-driven bbox errors instead of PostGIS crashes, route-level wiring proven via real HTTP test"
```

---

## Task 9: `RolesGuard` 401 vs 403 split (B13)

**Files:** Modify `apps/api/src/auth/roles.guard.ts`. Test: `roles.guard.spec.ts` (append/modify).

**Interfaces:** Consumes nothing new. Produces `RolesGuard.canActivate` throwing
`UnauthorizedException` (401, no user) vs `ForbiddenException` (403, wrong role).

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
      confirmed by reading the real file), then replace with:
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
      and update any other test file asserting a bare `false`/generic-403 for the no-user case to
      expect `UnauthorizedException` (401) instead.
- [ ] **Step 4:** Run: `cd apps/api && npx jest src/auth` and every file the grep found — PASS.
- [ ] **Step 5:** Commit
```bash
git add apps/api/src/auth
git commit -m "fix(api): RolesGuard distinguishes 401 (no user) from 403 (wrong role)"
```

---

## Task 10: Full regression checkpoint

**Files:** none.

- [ ] **Step 1:** Run: `cd apps/api && npx jest && npx tsc --noEmit`
- [ ] **Step 2:** Run: `cd packages/shared && npx vitest run && npx tsc --noEmit`
Expected: all green. Every task from here on is additive and doesn't change an existing
signature, so each can be reviewed and merged independently without breaking this baseline.

---

## Task 11: Re-verify cron actually runs

**Files:** Modify `apps/api/package.json`/`pnpm-lock.yaml`, `rule-engine.module.ts`, `re-verify.service.ts`.
Test: `re-verify.service.spec.ts` (append).

- [ ] **Step 1:** Run: `cd apps/api && pnpm add @nestjs/schedule` (include the regenerated lockfile in this commit).
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
- [ ] **Step 3:** Run — FAIL, then add `ScheduleModule.forRoot()` to `RuleEngineModule`'s imports and:
```typescript
import { Cron, CronExpression } from "@nestjs/schedule";
// ...
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: "re-verify-stale" })
  async handleCron() { await this.enqueueStale(); }
```
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Run: `cd apps/api && npx jest test/app.e2e-spec.ts` — PASS.
- [ ] **Step 6:** Commit
```bash
git add apps/api/package.json apps/api/pnpm-lock.yaml apps/api/src/rule-engine
git commit -m "feat(api): wire re-verify stale-venue job to a real daily cron"
```

---

## Task 12: Rate limits read from env (B7)

**Files:** Create `apps/api/src/common/rate-limit.config.ts`. Modify the four rate-limited
controllers, `.env.example`, `main.ts`.

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
- [ ] **Step 2:** Run — FAIL, then create:
```typescript
export const RATE_LIMITS = {
  read: { limit: Number(process.env.RATE_LIMIT_READ_PER_MINUTE ?? 100), windowSeconds: 60 },
  report: { limit: Number(process.env.RATE_LIMIT_REPORT_PER_DAY ?? 10), windowSeconds: 86400 },
};
```
- [ ] **Step 3:** Run — PASS. Replace every hardcoded `@RateLimit(100, 60)`/`@RateLimit(10, 86400)`
      across `venues.controller.ts`, `districts.controller.ts`, `favorites.controller.ts`,
      `reports.controller.ts` with the config values. Add `RATE_LIMIT_READ_PER_MINUTE=100` /
      `RATE_LIMIT_REPORT_PER_DAY=10` to `.env.example`.
- [ ] **Step 4:** In `main.ts`, add a production boot-time warning:
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

## Task 13: Admin role assignment restricted to curator (B14)

**Files:** Modify `apps/api/src/admin/users/admin-users.service.ts`. Test: append.

- [ ] **Step 1: Write the failing test**
```typescript
describe("AdminUsersService.assignRole — MVP restricts to curator only", () => {
  it("rejects assigning the admin role in MVP", async () => {
    const service = new AdminUsersService({ user: { update: jest.fn() } } as any);
    await expect(service.assignRole("u1", "admin")).rejects.toThrow("Bu rol MVP'de kullanılamaz (Faz 2)");
  });
});
```
- [ ] **Step 2:** Run — FAIL, then change `MVP_ASSIGNABLE_ROLES` (read the current file — introduce
      it if it doesn't exist yet) to `["curator"]`.
- [ ] **Step 3:** Run — PASS.
- [ ] **Step 4:** Commit
```bash
git add apps/api/src/admin/users
git commit -m "fix(api): restrict admin role assignment to curator only in MVP"
```

---

## Task 14: Swagger disabled in production (B15)

**Files:** Modify `apps/api/src/main.ts`. Test: `apps/api/src/main.spec.ts` (new).

**Interfaces:** Produces an exported, independently-callable `setupSwagger(app)`, and — the round-3
fix — `main.ts` guards its top-level `bootstrap()` call so importing the module for tests does not
boot a real application.

- [ ] **Step 1: Guard the top-level call and extract `setupSwagger`.** The real current `main.ts`
      ends with an unconditional `bootstrap();` at file scope — importing anything from this file
      for a test would trigger a real app boot as a side effect. Fix both in the same step:
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

export async function bootstrap() {
  // ...existing body, replacing the inline Swagger block with: setupSwagger(app);
}

if (require.main === module) {
  bootstrap();
}
```
- [ ] **Step 2: Write the test** (new file `apps/api/src/main.spec.ts`) — mocks BOTH
      `SwaggerModule.createDocument` and `SwaggerModule.setup`, since `setupSwagger` calls
      `createDocument` unconditionally before the production check:
```typescript
import { setupSwagger } from "./main";

describe("setupSwagger — production guard", () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = originalEnv; jest.restoreAllMocks(); });

  it("does not call SwaggerModule.setup when NODE_ENV=production", () => {
    process.env.NODE_ENV = "production";
    const swagger = require("@nestjs/swagger");
    jest.spyOn(swagger.SwaggerModule, "createDocument").mockReturnValue({} as any);
    const setupSpy = jest.spyOn(swagger.SwaggerModule, "setup").mockImplementation(() => {});
    setupSwagger({} as any);
    expect(setupSpy).not.toHaveBeenCalled();
  });

  it("calls SwaggerModule.setup when NODE_ENV is not production", () => {
    process.env.NODE_ENV = "development";
    const swagger = require("@nestjs/swagger");
    jest.spyOn(swagger.SwaggerModule, "createDocument").mockReturnValue({} as any);
    const setupSpy = jest.spyOn(swagger.SwaggerModule, "setup").mockImplementation(() => {});
    setupSwagger({} as any);
    expect(setupSpy).toHaveBeenCalled();
  });
});
```
(Importing `./main` in this test file no longer triggers a real boot, because of the
`require.main === module` guard added in Step 1 — this is the fix for round 3's finding that the
prior version's test would have booted a real app as an import side effect.)
- [ ] **Step 3:** Run: `cd apps/api && npx jest src/main.spec.ts` — FAIL before Step 1, PASS after.
- [ ] **Step 4:** Run: `cd apps/api && npx jest test/app.e2e-spec.ts` — confirms `bootstrap()` still
      boots correctly end-to-end (this test presumably invokes the compiled app directly via
      Nest's testing module, not by running `main.ts` as a script, so it is unaffected by the
      `require.main` guard).
- [ ] **Step 5:** Commit
```bash
git add apps/api/src/main.ts apps/api/src/main.spec.ts
git commit -m "fix(api): disable Swagger docs in production; guard main.ts's bootstrap() call so importing it for tests doesn't boot a real app"
```

---

## Task 15: Global exception filter delegates HttpException to Nest (B16)

**Files:** Create `apps/api/src/common/all-exceptions.filter.ts`. Modify `main.ts`.
Test: `all-exceptions.filter.spec.ts`.

**Interfaces:** Produces `AllExceptionsFilter extends BaseExceptionFilter` — for any
`HttpException`, delegates to `super.catch()` (Nest's own exception-handling pipeline, the
officially documented inheritance pattern for exception filters); only a non-`HttpException` gets
this filter's own 500 handling. (Round 3 correctly noted this phrasing must not overclaim: calling
`super.catch()` means Nest's standard `HttpException` handling path runs untouched — it is not a
claim that this filter itself produces `Retry-After`; that header, if present, is produced
wherever the 429 `HttpException` was originally thrown, same as before this filter existed.)

- [ ] **Step 1: Write the test**
```typescript
import { ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { BaseExceptionFilter, HttpAdapterHost } from "@nestjs/core";
import { AllExceptionsFilter } from "./all-exceptions.filter";

describe("AllExceptionsFilter", () => {
  it("delegates HttpException handling to BaseExceptionFilter.catch (Nest's own pipeline)", () => {
    const superCatchSpy = jest.spyOn(BaseExceptionFilter.prototype, "catch").mockImplementation(() => {});
    const filter = new AllExceptionsFilter({ httpAdapter: {} } as HttpAdapterHost);
    const original = new HttpException({ error: { code: "TOO_MANY_REQUESTS", message: "Yavaşlayın" } }, HttpStatus.TOO_MANY_REQUESTS);
    const host = {} as ArgumentsHost;
    filter.catch(original, host);
    expect(superCatchSpy).toHaveBeenCalledWith(original, host);
    superCatchSpy.mockRestore();
  });

  it("converts an unhandled non-HttpException error to a 500 envelope without calling super.catch", () => {
    const superCatchSpy = jest.spyOn(BaseExceptionFilter.prototype, "catch").mockImplementation(() => {});
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
      // Nest's own pipeline already knows how to render every HttpException correctly (status,
      // body, and whatever headers were set on the exception itself) -- this filter must never
      // reimplement that. It exists only to catch what nothing else does.
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
- [ ] **Step 4: Wire it globally in `main.ts`** (inside `bootstrap()`, using DI for `HttpAdapterHost`):
```typescript
import { HttpAdapterHost } from "@nestjs/core";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
// ... before app.listen():
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
```
- [ ] **Step 5: Run the full suite to confirm no existing endpoint's observable status/body
      changed** — in particular, re-run whatever existing test (Plan 1) asserts the `Retry-After`
      header on a 429 response, and confirm it still passes with this filter registered:
Run: `cd apps/api && npx jest`
- [ ] **Step 6:** Commit
```bash
git add apps/api/src/common/all-exceptions.filter.ts apps/api/src/common/all-exceptions.filter.spec.ts apps/api/src/main.ts
git commit -m "feat(api): global exception filter delegates HttpException to Nest's own pipeline, only handles unhandled non-HttpException errors"
```

---

## Task 16: Final full regression and manual smoke verification

**Files:** none.

- [ ] **Step 1:** Run: `cd apps/api && npx jest && cd ../../packages/shared && npx vitest run`
- [ ] **Step 2:** Run: `pnpm exec turbo run typecheck lint --filter=@gurmego/api... --filter=@gurmego/shared`
- [ ] **Step 3: Manual verification (NOT an automated gate)** — with a real curator JWT from the
      actual login flow and a real district id:
```bash
curl -X POST http://localhost:3001/v1/admin/venues -H "Authorization: Bearer <real-curator-jwt>" -H "Content-Type: application/json" -d '{"name":"Smoke Test Cafe","slug":"smoke-test-cafe","districtId":"<real-district-id>","category":"cafe","priceRange":"MODERATE","openingHours":{"mon_fri":"09:00-18:00"},"branchCount":1,"franchiseFlag":false,"lat":40.99,"lng":29.02,"status":"PUBLISHED"}'
curl http://localhost:3001/v1/venues
```
Expected: "Smoke Test Cafe" appears. The automated proof of A1 is Task 3's (`create` respecting
`status`) and Task 6's (CSV defaulting to `PUBLISHED`) test suites — this is a one-time confidence
check, not the acceptance criterion.
- [ ] **Step 4:** Update `docs/STATE.md` and `docs/SESSION-LOG-2026-07-26.md`: Plan 4b complete,
      ready for the final whole-branch review (Superpowers reviewer + mandatory `cross-model-review`).

---

## Self-Review Notes (round 4, after three YENİDEN BÖL verdicts)

- **Round 3 confirmed the structural fix held** ("Round 2'nin ana sorunu... dar anlamda
  çözülmüş") — this round's changes are bug fixes and task-size correction, not another
  structural rewrite.
- **B11 now fixed on both sides:** `updateWithLocation`'s combined `lat`/`lng` check was already
  correct (verified against the real file); `searchPublished`'s `distanceSelect`/`radiusFilter`/
  `orderBy` were the actually-broken truthiness checks, now fixed in Task 4 Step 3.
- **`AdminVenueRow` now includes `address`/`photos`** (Task 3 Step 3) — the missing piece that
  would have made every typed fixture referencing these fields fail an excess-property check.
- **`snapshotToUpdateInput` now includes `source`**; `revert()` explicitly sets a fresh
  `verifiedAt` after mapping, matching `update()`'s "revert is a re-verification event" semantics.
- **`AdminQueueService.approve`'s `tx: any` replaced with `Prisma.TransactionClient`.**
- **Task split:** the former single mega-task is now Task 3 (write/versioning path: repository
  writes + `AdminVenuesService` + `seed.ts` + `BoutiqueService` + `AdminQueueService` — these are
  the actual direct callers of the four repository methods this task owns) and Task 4 (read/query
  path: `searchPublished` + `VenuesService.list` + `VenuesController` + location header decorator
  + `DistrictsController` — the actual direct callers of `searchPublished`). `findBySlug` is its
  own tiny Task 5 since no caller's signature changes.
- **`main.ts`'s `bootstrap();` unconditional top-level call** (confirmed in the real file) now
  guarded by `require.main === module`, fixing the Swagger test's real-boot side effect; the
  Swagger test itself now mocks both `createDocument` and `setup`.
- **UUID/bbox tests now invoke the real pipe classes directly** (`ParseUUIDPipe.transform()`,
  `ZodValidationPipe.transform()`) instead of calling controller methods, which bypassed Nest's
  pipe execution entirely.
- **Admin-queue schema test now matches the real schema's exact required fields**, read in full
  from `packages/shared/src/schemas/admin-queue.schema.ts`.
- **Rollback proof is now a real Postgres integration test** seeded via the repository's own
  `createWithLocation` (never `prisma.venue.create`, which cannot write the required `location`
  column per ADR 002) instead of a circular mock, with concrete `beforeAll`/`afterEach`/`afterAll`
  setup and cleanup instead of a "same pattern as..." placeholder.

## Round 4 plan-red-team fixes (applied after this document's initial round-4 draft)

Codex's fourth pass found the write/read task split was directionally correct but still had a real
cross-task acceptance cycle, plus several smaller concrete gaps:

- **The actual remaining sözleşme bug:** Task 2 removed `lat`/`lng` from `VenueListQuerySchema`,
  but `searchPublished` (which reads them) wasn't fixed until Task 4 — meaning Task 3's own
  `tsc --noEmit` claim, sitting in between, was false. Fixed by moving the `VenueListQuerySchema`
  change itself into Task 4 (now its own Step 0), atomically with `searchPublished`'s rewrite.
  Task 2 now only adds the `OptionalTrueFlag` helper (unapplied) and `VenueDetailSchema`'s new
  fields — both purely additive, breaking nothing.
- **`updateWithLocation` was missing the `photos` assignment** (added `googleRating`/
  `googleRatingCount`/`googlePlaceId`/`address` but not `photos`, despite the type accepting it) —
  fixed with its own dedicated test.
- **`findBySlug`'s `$queryRaw<any[]>`** replaced with a named `VenueDetailRow` interface — the
  global "any forbidden unless justified" rule had no justification for this one, since the row
  shape is fully enumerable from the `SELECT` list.
- **The admin-queue schema comment instruction was wrong**: it implied `list()`/`getQueue()` would
  no longer be REPORT-only after Task 3, which contradicts the design doc — only `approve`/`reject`
  by id can now see an `EDIT` item; the list/queue view stays REPORT-focused by design. Reworded.
- **The real-DB `openNow` fail-open test was day-of-week-flaky**: a fixed `{ mon_fri: "kapalı" }`
  fixture only exercises the malformed-value path on weekdays. Fixed to compute "today's bucket"
  in the test itself, plus added the design doc's explicit empty-string and `"29:00-10:00"` cases
  and a standalone regex unit test for the 00-23 boundary.
- **Three test claims were unverified assumptions** rather than real tests: (1) Task 4's location
  header test assumed `app.e2e-spec.ts` already exercises this endpoint with the header present —
  replaced with an actual appended case; (2) Task 8's UUID validation assumed re-running the
  existing e2e suite would prove route-level wiring — replaced with an actual appended HTTP case;
  (3) the design doc's CSV-visibility acceptance criterion (imported row appears in `GET /venues`)
  had no test at all — added as Task 6's new Step 6b, a real Postgres integration test.

## Round 5 plan-red-team fixes and decision to proceed to implementation

Round 5 confirmed the `lat`/`lng` cross-task cycle was genuinely closed ("Round 4'teki `lat/lng`
acceptance döngüsünü gerçekten kapatmış") and found the **same class of bug** on a different field
pair: `VenueDetailSchema` (Task 2) made `lat`/`lng`/`address`/`photos` required before `findBySlug`
(Task 5) actually produced them — a runtime Zod-validation break on every `GET /venues/:slug` in
between, which is a real regression this plan would have introduced (worse than the earlier
`VenueListQuery` version of this bug, which was at least a caught `tsc` error). **Fixed**: moved
`VenueDetailSchema`'s new fields into Task 5, atomically with `findBySlug`. Also fixed:
`BboxQuerySchema` had the exact same `Number("")===0` footgun this plan already fixed once for
`parseUserLocationHeader` — guarded empty bbox parts before calling `Number()` on them.

**Decision: this is the last purely-textual plan-red-team round.** Round 5's remaining findings
— whether `GET /v1/admin/venues/:id` exists as a route the UUID pipe test can hit, `curatorToken`'s
actual source in `app.e2e-spec.ts`, `PrismaService`'s real constructor signature for the e2e test
files, whether `TestingModule`-based e2e tests exercise `main.ts`'s `bootstrap()` at all, whether
`featured` needs restoring on revert, and several `git add` omissions — all require reading real
files to resolve correctly, which this planning process has done selectively (venues.repository.ts,
admin-venues.service.ts, admin-queue.service.ts, roles.guard.ts, csv-import.service.ts, main.ts,
every controller's `@Param` usage) but not exhaustively for every file this plan touches. Codex's
own confidence block for round 5 named exactly this: its findings would be resolved by seeing
routes/constructors this text-only review couldn't access. Continuing further rounds against plan
text alone has reached diminishing returns; the venues that actually catch these — per-task code
review and the mandatory `cross-model-review` (both operate on real diffs against real files, not
plan prose) — are still mandatory before this plan's work is considered done, per the standing
project rule. Known limitations to verify during implementation, recorded here so they aren't
silently dropped:

- **`featured` is not restored by `revert()`.** `snapshotToUpdateInput()` omits it because neither
  `CreateVenueWithLocationInput` nor `UpdateVenueWithLocationInput` currently model it at all (it's
  set by a separate, not-yet-built admin "featured venues" mechanism outside this plan's scope —
  verify against `docs/rule-engine.md`/the live schema whether `featured` is even meant to be
  revertable, since it's plausibly a curation-team editorial flag independent of the versioned
  content fields, before deciding whether to add it).
- **Task 6's CSV-visibility test (Step 6b) calls `importRows()` directly with a pre-built row
  object, not a real CSV string through `CsvImportService.parseRows()`, and asserts against the
  repository directly, not an HTTP `GET /venues` call.** It proves the service-to-repository path
  works; it does not prove the full CSV-file-upload-to-HTTP-response path. A stronger version
  would use `request(app.getHttpServer()).post("/v1/admin/import")` with a real multipart CSV body
  and then `.get("/v1/venues")` — verify during implementation whether `apps/api/test/` already has
  a multipart-upload test pattern to follow (Plan 1's CSV import task may have established one).
- **Task 8's UUID HTTP test targets `GET /v1/admin/venues/not-a-uuid`, but this task's own file
  list only applies `ParseUUIDPipe` to `update`/`revert`, which are almost certainly `PATCH`/`PUT`
  and `POST`, not `GET`.** Read `admin-venues.controller.ts`'s real HTTP methods before writing
  this test and target an actual UUID-pipe-guarded route with its actual verb.
- **`curatorToken` and the HTTP client shape in the new e2e test snippets (Tasks 6, 8) are
  placeholders for whatever `app.e2e-spec.ts` already establishes** — read that file first and
  reuse its actual auth/request pattern instead of inventing a new one.
- **Task 14's claim that `app.e2e-spec.ts` "confirms bootstrap() still boots correctly" is not
  reliable** if that suite uses `Test.createTestingModule(...).createNestApplication()` (the
  standard NestJS pattern), which does not execute `main.ts`'s `bootstrap()` function at all —
  verify which pattern the real file uses; if it doesn't invoke `main.ts`, a separate smoke test
  that actually spawns `node dist/main.js` (or equivalent) is the only real proof this task's
  `require.main === module` guard doesn't break the real entrypoint.
- **Task 15's Retry-After regression check ("whatever existing test") needs a concrete file/test
  name** — find Plan 1's 429/rate-limit test before this task runs and reference it explicitly.
- Several commit steps' `git add` lists were found missing files across rounds (`venue.schema.ts`/
  `venue.schema.spec.ts` in Tasks 4/8, `admin-venues.service.spec.ts` in Task 6) and were fixed
  where caught; treat every task's final `git status` as the actual source of truth before
  committing, not the `git add` line as written.
