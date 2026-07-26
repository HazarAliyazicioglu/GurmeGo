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
  `OptionalTrueFlag`; `VenueListQuerySchema` with `openNow`, corrected `isBoutique`, no `lat`/`lng`;
  `VenueDetailSchema` with `lat`/`lng`/`address`/`photos`; `AdminQueueItemSchema`/
  `AdminQueueMutationResultSchema` with `type: "REPORT" | "EDIT"`.

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
      wrapper used to test `OptionalTrueFlag` in isolation):
```typescript
import { z } from "zod";
import { OptionalTrueFlag, VenueListQuerySchema, VenueDetailSchema } from "./venue.schema";

describe("OptionalTrueFlag", () => {
  it("stays undefined when absent", () => expect(z.object({ flag: OptionalTrueFlag }).parse({}).flag).toBeUndefined());
  it("parses 'true' as true", () => expect(z.object({ flag: OptionalTrueFlag }).parse({ flag: "true" }).flag).toBe(true));
  it("rejects 'false'", () => expect(z.object({ flag: OptionalTrueFlag }).safeParse({ flag: "false" }).success).toBe(false));
});

describe("VenueListQuerySchema", () => {
  it("no longer accepts lat/lng", () => expect((VenueListQuerySchema.parse({ lat: "40.99", lng: "29.02" }) as any).lat).toBeUndefined());
  it("openNow=true parses, openNow=false rejects", () => {
    expect(VenueListQuerySchema.parse({ openNow: "true" }).openNow).toBe(true);
    expect(VenueListQuerySchema.safeParse({ openNow: "false" }).success).toBe(false);
  });
  it("isBoutique=false rejects", () => expect(VenueListQuerySchema.safeParse({ isBoutique: "false" }).success).toBe(false));
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
- [ ] **Step 9:** Run — FAIL, then in `venue.schema.ts` add:
```typescript
// z.coerce.boolean() is a footgun: Boolean("false") is true. A naive
// z.literal("true").optional().transform(v => v === "true") is ALSO wrong -- absent -> v is
// undefined -> undefined === "true" is false, collapsing "not requested" into "explicitly off".
export const OptionalTrueFlag = z.literal("true").optional().transform((v) => (v === undefined ? undefined : true));
```
Read the current file, remove `lat`/`lng` and any sort-default `.transform()` from
`VenueListQuerySchema` (moves to `VenuesService`, Task 4), replace
`isBoutique: z.coerce.boolean().optional()` with `OptionalTrueFlag`, add `openNow: OptionalTrueFlag`.
Preserve every other field exactly. Add to `VenueDetailSchema` after `district`:
```typescript
  lat: z.number(),
  lng: z.number(),
  address: z.string().nullable(),
  photos: z.array(z.string()),
```
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
      to `z.enum(["REPORT", "EDIT"])` (update the stale comment above `AdminQueueItemSchema.type`
      that says "this app only ever queries type=REPORT" — it no longer will after Task 3).
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

- [ ] **Step 5: Rewrite `updateWithLocation`** — same signature change, add the four new
      assignments (Google fields, `address`); the existing `lat`/`lng` combined check
      (`input.lat !== undefined && input.lng !== undefined`, confirmed already correct in the
      real file — this is NOT the B11 bug, that's on the search side, fixed in Task 4) stays as-is:
```typescript
async updateWithLocation(client: Pick<PrismaService, "$queryRaw">, id: string, input: UpdateVenueWithLocationInput): Promise<AdminVenueRow> {
    // ...existing per-field assignments unchanged, plus:
    if (input.googleRating !== undefined) assignments.push(Prisma.sql`"googleRating" = ${input.googleRating}`);
    if (input.googleRatingCount !== undefined) assignments.push(Prisma.sql`"googleRatingCount" = ${input.googleRatingCount}`);
    if (input.googlePlaceId !== undefined) assignments.push(Prisma.sql`"googlePlaceId" = ${input.googlePlaceId}`);
    if (input.address !== undefined) assignments.push(Prisma.sql`address = ${input.address}`);
    // ...replace this.prisma.$queryRaw with client.$queryRaw in the final query call
```
- [ ] **Step 6:** Run — PASS (4 tests).

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
      New file `apps/api/test/admin-venues-rollback.e2e-spec.ts`, using the real local Supabase
      stack (same pattern as `apps/api/test/app.e2e-spec.ts`) and the repository's own
      `createWithLocation` (never `prisma.venue.create` — ADR 002 means the Prisma Client's model
      API cannot write the required `location` column, so seeding for this test must go through
      the repository, not a bare `prisma.venue.create`):
```typescript
describe("AdminVenuesService.update — real rollback", () => {
  it("does not persist a VenueVersion snapshot when updateWithLocation fails mid-transaction", async () => {
    const district = await prisma.district.findFirstOrThrow();
    const venue = await venuesRepository.createWithLocation(prisma, {
      name: "Rollback Test Venue", slug: `rollback-test-${Date.now()}`, districtId: district.id,
      category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: {},
      isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
      verifiedAt: new Date(), status: "DRAFT", lat: 40.99, lng: 29.02,
    });
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
Supabase stack up; confirm with `npx supabase status` first).

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
(This is NOT yet a full-project gate — `VenuesController`/`VenuesService`/`DistrictsController`
still reference the pre-Task-4 `searchPublished` shape, which Task 4 hasn't touched yet, so they
remain unaffected and already compile. The `tsc --noEmit` above should already be fully green,
since nothing outside this task's own files referenced the signatures changed here.)
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
- Modify: `apps/api/src/venues/venues.repository.ts` (search method only), `venues.service.ts`,
  `venues.controller.ts`
- Create: `apps/api/src/common/user-location.decorator.ts`
- Modify: `apps/api/src/districts/districts.controller.ts`
- Test: `venues.repository.spec.ts`, `venues.service.spec.ts`, `venues.controller.spec.ts`,
  `common/user-location.decorator.spec.ts`, `districts.controller.spec.ts`

**Interfaces:**
- Consumes: Task 2's `VenueListQuerySchema` (no `lat`/`lng`, has `openNow`)
- Produces: `searchPublished(filters: VenueSearchFilters)` with the internal
  `VenueSearchFilters` type and a real `openNow` filter; `UserLocationParam`/
  `parseUserLocationHeader`; `VenuesService.list(query, location)` with sort-default logic.

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

- [ ] **Step 8: Real-DB test for malformed `openingHours` fail-open**
      New/append to `apps/api/test/app.e2e-spec.ts` or a new `apps/api/test/venues-open-now.e2e-spec.ts`:
```typescript
describe("GET /venues?openNow=true — fail-open on malformed data", () => {
  it("includes venues with unparseable or missing openingHours instead of excluding them", async () => {
    const district = await prisma.district.findFirstOrThrow();
    const malformed = await venuesRepository.createWithLocation(prisma, {
      name: "Malformed Hours Venue", slug: `malformed-hours-${Date.now()}`, districtId: district.id,
      category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: { mon_fri: "kapalı" },
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
    expect(items.map((i: any) => i.id)).toEqual(expect.arrayContaining([malformed.id, missing.id]));
  });
});
```
Run — PASS (requires local Supabase stack).

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
Run: `cd apps/api && npx jest src/venues/venues.controller.spec.ts` — PASS. (This test exercises
the controller method as a plain function, which is sufficient to prove the pipe-scoping fix
didn't change the method's own argument-passing behavior; it does not exercise Nest's actual
runtime pipe execution — that is covered instead by `test/app.e2e-spec.ts`'s existing real-HTTP
coverage of this endpoint, which continues to run unmodified after this change.)

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
Run: `cd apps/api && npx jest src/venues src/districts src/common && npx tsc --noEmit`
```bash
git add apps/api/src/venues apps/api/src/common/user-location.decorator.ts apps/api/src/common/user-location.decorator.spec.ts apps/api/src/districts apps/api/test
git commit -m "feat(api): X-User-Location header (ADR 004) replaces lat/lng query params, open_now filter, B11 fix on the search side

searchPublished's distanceSelect/radiusFilter/orderBy used truthiness
checks on lat/lng, silently dropping location for lat=0/lng=0 -- fixed to
!== undefined. Single atomic commit: searchPublished's signature change
and its only callers (VenuesService, VenuesController, DistrictsController)
land together."
```

---

## Task 5: `findBySlug` rewrite (independent — no caller signature change)

**Files:** Modify `apps/api/src/venues/venues.repository.ts` (`findBySlug` only). Test: `venues.repository.spec.ts`.

**Interfaces:** Consumes Task 1's `address`/`photos` columns. Produces `findBySlug(slug)` now
returning `lat`/`lng`/`address`/`photos`/nested `district: {name, slug}`. `VenuesService.detail()`
already calls this method with no arity change and passes the result straight through to
`VenueDetailSchema` (Task 2) — no caller code changes, only richer data flows through.

- [ ] **Step 1: Write the failing test**
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
- [ ] **Step 3:** Run — PASS (2 tests).
- [ ] **Step 4:** Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts src/venues/venues.service.spec.ts` — confirm `VenuesService.detail()`'s existing tests still pass unchanged.
- [ ] **Step 5:** Commit
```bash
git add apps/api/src/venues/venues.repository.ts
git commit -m "fix(api): findBySlug returns venue coordinates, address, photos via raw SQL"
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
- [ ] **Step 7:** Commit
```bash
git add apps/api/src/admin/venues/admin-venues.service.ts apps/api/src/admin/venues/csv-import.service.spec.ts
git commit -m "feat(api): CSV import defaults venues to PUBLISHED, passes status/address through"
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
- [ ] **Step 6:** Run: `cd apps/api && npx jest test/app.e2e-spec.ts` — confirms a real HTTP request
      with a malformed `:id` actually gets a 400 through Nest's real pipe execution (the direct
      `.transform()` test above proves the pipe class works in isolation; this proves it's wired
      up correctly at the route level).
- [ ] **Step 7:** Commit
```bash
git add packages/shared/src/schemas/venue.schema.ts apps/api/src/venues apps/api/src/admin apps/api/src/favorites apps/api/src/reports
git commit -m "fix(api): bbox and UUID path-param validation (B12), Zod-driven bbox errors instead of PostGIS crashes"
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
  column per ADR 002) instead of a circular mock.
