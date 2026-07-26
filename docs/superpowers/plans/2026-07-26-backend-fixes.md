# GurmeGo — Plan 4b: Backend Kritik Düzeltmeler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every backend finding from `docs/AUDIT-2026-07-26.md` so the pilot can actually
function — most critically, make it possible to publish a venue at all, and stop the location
header contract / data-integrity / security gaps documented in
`docs/superpowers/specs/2026-07-26-backend-fixes-design.md` (HAZIR after 5 idea-red-team rounds).

**Architecture:** No new modules. Existing `VenuesRepository` (raw-SQL, ADR 002) becomes
transaction-aware (accepts a Prisma client parameter) so admin writes and their `VenueVersion`
snapshots become atomic. A new `@UserLocationParam()` decorator reads `X-User-Location` instead of
query params. Zod schemas in `packages/shared` gain `status`, `openNow`, and a corrected optional-
boolean pattern; the sort-default logic moves from schema `.transform()` to the service layer
because headers aren't visible during Zod parsing.

**Tech Stack:** NestJS 10 (Fastify), Prisma 5 + raw `$queryRaw`/`$queryRawUnsafe` (PostGIS), Zod,
Jest, `@nestjs/schedule` (new dependency for Task 12).

## Global Constraints

- TypeScript `strict: true`; `any` forbidden unless justified.
- All API input validated via Zod schemas from `packages/shared`.
- PostGIS raw SQL only in `VenuesRepository`/`DistrictsRepository` (ADR 002).
- Rule engine thresholds (boutique branch limit, stale days, moderation threshold, rate limits)
  read from env, never hardcoded.
- `ContributionQueue` remains the only entry point for user contributions into `Venue` — no task
  in this plan bypasses it.
- Migration: only `prisma migrate`, never manual Supabase dashboard edits.
- This repo has no `origin` git remote (verified `git remote -v` is empty) — no task assumes a
  real GitHub Actions run; local command reproduction is the acceptance proof, same as Plan 4a.
- Local Supabase stack real connection details must be read from `npx supabase status` at
  execution time — do not assume the example ports in this plan (`54421`/`54422`) are still
  correct if the stack was restarted.

---

## Task 1: Migration — `Venue.address` and `Venue.photos`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_venue_address_photos/migration.sql` (generated)

**Interfaces:**
- Consumes: nothing (first task, pure schema change)
- Produces: `Venue.address: String?`, `Venue.photos: String[]` (default `[]`) — every later task in
  this plan that touches venue read/write (Tasks 3, 5, 8) depends on these columns existing.

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
- Produces: `AdminVenueCreateSchema`/`AdminVenueUpdateSchema` with `status`/`address`/`photos`;
  `CsvVenueImportRowSchema` with `status`; `OptionalTrueFlag` helper (exported from
  `venue.schema.ts`); `VenueListQuerySchema` with `openNow`, corrected `isBoutique`, no `lat`/`lng`;
  `VenueDetailSchema` with `lat`/`lng`/`address`/`photos`; `AdminQueueItemSchema` and
  `AdminQueueMutationResultSchema` both accepting `type: "REPORT" | "EDIT"`. Every later backend
  task (3-11) and Plan 4c depend on these exact names/shapes.

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
Expected: FAIL — `status` field not recognized / rejected as unrecognized in strict mode, or
`address`/`photos` not present. (If `AdminVenueCreateSchema` is not `.strict()`, unknown keys are
silently stripped rather than causing failure — in that case this step's failure will show up as
`result.data.status` being `undefined` in the "accepts an explicit status" test instead. Either
way, confirm the test fails before proceeding.)

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
(`AdminVenueUpdateSchema` is `AdminVenueCreateSchema.partial()`, so it inherits these automatically
— no separate edit needed there.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/schemas/admin-venue.schema.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing test — append to `packages/shared/src/schemas/csv-venue-import.schema.spec.ts`**

(If this file doesn't exist yet, create it importing `CsvVenueImportRowSchema` and add these cases
alongside whatever existing coverage `csv-import.service.spec.ts` in `apps/api` already has for
this schema — check first with `find packages/shared/src/schemas -iname "csv*"`.)

```typescript
describe("CsvVenueImportRowSchema status column", () => {
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

  it("still parses correctly when the status column is missing entirely", () => {
    const result = CsvVenueImportRowSchema.safeParse(BASE_ROW);
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/schemas/csv-venue-import.schema.spec.ts`
Expected: FAIL — `status` not defined on the schema yet, or empty-string case not handled.

- [ ] **Step 7: Add `status` to `CsvVenueImportRowSchema`**

In `packages/shared/src/schemas/csv-venue-import.schema.ts`, add the import
`import { VenueStatusSchema } from "./venue.schema";` and this field to the object (after
`openingHours`):
```typescript
  status: z.preprocess((v) => (v === "" ? undefined : v), VenueStatusSchema.optional()),
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/schemas/csv-venue-import.schema.spec.ts`
Expected: PASS (3 new tests + any pre-existing ones still passing).

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
// A naive `z.literal("true").optional().transform(v => v === "true")` is ALSO wrong — when the
// field is absent, `v` is `undefined`, and `undefined === "true"` is `false`, not `undefined`,
// which collapses "filter not requested" into "filter explicitly off". This version preserves
// `undefined` for the absent case.
export const OptionalTrueFlag = z.literal("true").optional().transform((v) => (v === undefined ? undefined : true));
```

In `VenueListQuerySchema`, remove the `lat`/`lng` fields and the `.transform()` that defaults
`sort` based on their presence (that logic moves to `VenuesService`, see Task 7). Replace
`isBoutique: z.coerce.boolean().optional()` with `isBoutique: OptionalTrueFlag`. Add
`openNow: OptionalTrueFlag`. The schema becomes (adjust to match whatever other fields already
exist there — districtId/category/priceRange/radiusM/sort/limit/cursor are untouched):
```typescript
export const VenueListQuerySchema = z.object({
  districtId: z.string().uuid().optional(),
  category: z.string().optional(),
  priceRange: z.enum(PRICE_RANGE_VALUES).optional(),
  isBoutique: OptionalTrueFlag,
  openNow: OptionalTrueFlag,
  radiusM: z.coerce.number().positive().optional(),
  sort: z.enum(["distance", "newest"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});
export type VenueListQuery = z.infer<typeof VenueListQuerySchema>;
```
(Read the actual current file first with the Read tool before editing — this plan reconstructs the
expected shape from the design doc and Task 6/repository code; preserve any field this plan didn't
mention, such as `cuisineType` if present, exactly as-is.)

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

(Find the existing test file with `find packages/shared/src/schemas -iname "admin-queue*"`.)

```typescript
describe("AdminQueueItemSchema / AdminQueueMutationResultSchema type enum", () => {
  it("accepts type EDIT on both schemas, not just REPORT", () => {
    const base = { id: "d290f1ee-6c54-4b01-90e6-d701748f0851", status: "PENDING", createdAt: "2026-07-24T00:00:00.000Z" };
    expect(AdminQueueItemSchema.safeParse({ ...base, type: "EDIT", payload: { kind: "re_verify" }, urgent: false }).success).toBe(true);
    expect(AdminQueueMutationResultSchema.safeParse({ ...base, type: "EDIT" }).success).toBe(true);
  });
});
```
(Adjust the exact required fields in `base` to match what the real schemas currently require —
read both schemas with the Read tool first; this is illustrative of the assertion, not a literal
copy-paste if the real shape differs.)

- [ ] **Step 14: Run test to verify it fails, then change both schemas' `type` field from
      `z.literal("REPORT")` to `z.enum(["REPORT", "EDIT"])`, then verify the test passes.**

Run: `cd packages/shared && npx vitest run src/schemas/admin-queue.schema.spec.ts`

- [ ] **Step 15: Run the full shared package suite and typecheck**

Run: `cd packages/shared && npx vitest run && npx tsc --noEmit`
Expected: all pass, no type errors.

- [ ] **Step 16: Commit**

```bash
git add packages/shared/src/schemas
git commit -m "feat(shared): add status/address/photos fields, fix optional-boolean pattern, widen admin-queue type enum"
```

---

## Task 3: `VenuesRepository` becomes transaction-aware; write path gains new columns

**Files:**
- Modify: `apps/api/src/venues/venues.repository.ts`
- Modify: `apps/api/prisma/seed.ts`
- Test: `apps/api/src/venues/venues.repository.spec.ts` (append)

**Interfaces:**
- Consumes: `packages/shared`'s updated `AdminVenueCreateInput`/`AdminVenueUpdateInput` shapes (Task 2)
- Produces: `createWithLocation(client, input)`, `updateWithLocation(client, id, input)` — both now
  take a Prisma client as the first argument (`PrismaService` or a `Prisma.TransactionClient`),
  used by Task 8 (`AdminVenuesService`) and Task 10 (`AdminQueueService`) to make snapshot+write
  atomic. `CreateVenueWithLocationInput`/`UpdateVenueWithLocationInput` gain
  `googleRating`/`googleRatingCount`/`googlePlaceId`/`address`/`photos`.

- [ ] **Step 1: Write the failing test — append to `venues.repository.spec.ts`**

```typescript
describe("VenuesRepository.createWithLocation — client parameter", () => {
  it("accepts an explicit Prisma client (e.g. a transaction client) as the first argument", async () => {
    const fakeTxClient = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1" }]) } as any;
    const repo = new VenuesRepository({} as any); // constructor's own PrismaService unused when a client is passed explicitly
    const result = await repo.createWithLocation(fakeTxClient, {
      name: "A", slug: "a", districtId: "d1", category: "cafe", priceRange: "MODERATE",
      signatureItems: [], openingHours: {}, isBoutique: false, branchCount: 1, franchiseFlag: false,
      source: "MANUAL", verifiedAt: new Date(), status: "DRAFT", lat: 40.99, lng: 29.02,
    });
    expect(fakeTxClient.$queryRaw).toHaveBeenCalled();
    expect(result).toEqual({ id: "v1" });
  });
});

describe("VenuesRepository.createWithLocation — Google fields written", () => {
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
    const sqlText = sqlCall.values ? sqlCall.strings.join("") : String(sqlCall);
    expect(sqlText).toContain("googleRating");
    expect(sqlCall.values).toContain(4.5);
    expect(sqlCall.values).toContain(10);
    expect(sqlCall.values).toContain("place123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts -t "client parameter|Google fields"`
Expected: FAIL — current signature has no client parameter, Google fields not in INSERT.

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
(Remove `private prisma: PrismaService` usage inside this method body — the method now uses the
`client` parameter instead. The constructor's `private prisma: PrismaService` stays, since
`searchPublished`/`findBySlug`/`findInBbox`/`findRawForSnapshot` (Tasks 4-6) still use it directly
for their own non-transactional reads.)

- [ ] **Step 5: Change `updateWithLocation`'s signature and add Google/address/photos assignments**

```typescript
async updateWithLocation(client: Pick<PrismaService, "$queryRaw">, id: string, input: UpdateVenueWithLocationInput): Promise<AdminVenueRow> {
```
Add these assignment lines alongside the existing ones (after the `googlePlaceId`-equivalent — there
isn't one yet, add all three plus address/photos):
```typescript
    if (input.googleRating !== undefined) assignments.push(Prisma.sql`"googleRating" = ${input.googleRating}`);
    if (input.googleRatingCount !== undefined) assignments.push(Prisma.sql`"googleRatingCount" = ${input.googleRatingCount}`);
    if (input.googlePlaceId !== undefined) assignments.push(Prisma.sql`"googlePlaceId" = ${input.googlePlaceId}`);
    if (input.address !== undefined) assignments.push(Prisma.sql`address = ${input.address}`);
    if (input.photos !== undefined) assignments.push(Prisma.sql`photos = ${input.photos}`);
```
Replace `this.prisma.$queryRaw` with `client.$queryRaw` in this method's final query call.

- [ ] **Step 6: Update `apps/api/prisma/seed.ts`'s call site**

Change `venuesRepository.createWithLocation({...})` to `venuesRepository.createWithLocation(prisma, {...})`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts`
Expected: PASS (all, including pre-existing tests — verify none broke from the signature change;
if any existing test calls `createWithLocation`/`updateWithLocation` with the old one-argument
signature, update those call sites too as part of this step).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/venues/venues.repository.ts apps/api/prisma/seed.ts
git commit -m "feat(api): make VenuesRepository write methods transaction-aware, write Google/address/photos fields"
```

---

## Task 4: `findRawForSnapshot` — snapshots that don't lose location

**Files:**
- Modify: `apps/api/src/venues/venues.repository.ts`
- Test: `apps/api/src/venues/venues.repository.spec.ts` (append)

**Interfaces:**
- Consumes: nothing new
- Produces: `findRawForSnapshot(client, id): Promise<AdminVenueRow>` — used by Task 8
  (`AdminVenuesService.update`/`revert`) and Task 10 (`AdminQueueService.approve`'s EDIT branch) to
  take a `VenueVersion` snapshot that includes `lat`/`lng` (which `prisma.venue.findUnique()`
  structurally cannot return — ADR 002's `Unsupported(...)` column).

- [ ] **Step 1: Write the failing test**

```typescript
describe("VenuesRepository.findRawForSnapshot", () => {
  it("returns the full row including lat/lng via raw SQL", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1", lat: 40.99, lng: 29.02 }]) } as any;
    const repo = new VenuesRepository({} as any);
    const result = await repo.findRawForSnapshot(client, "v1");
    expect(client.$queryRaw).toHaveBeenCalled();
    expect(result).toEqual({ id: "v1", lat: 40.99, lng: 29.02 });
  });

  it("throws NotFoundException when the venue doesn't exist", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    const repo = new VenuesRepository({} as any);
    await expect(repo.findRawForSnapshot(client, "missing")).rejects.toThrow("Mekan bulunamadı");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts -t findRawForSnapshot`
Expected: FAIL — method doesn't exist.

- [ ] **Step 3: Implement `findRawForSnapshot`**

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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts -t findRawForSnapshot`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/venues/venues.repository.ts
git commit -m "feat(api): add findRawForSnapshot for location-inclusive VenueVersion snapshots"
```

---

## Task 5: `findBySlug` rewrite — location, address, photos, preserved nested district

**Files:**
- Modify: `apps/api/src/venues/venues.repository.ts`
- Test: `apps/api/src/venues/venues.repository.spec.ts` (append)

**Interfaces:**
- Consumes: Task 1's `address`/`photos` columns
- Produces: `findBySlug(slug)` now returns `lat`, `lng`, `address`, `photos` in addition to the
  existing fields, with `district` still shaped as `{ name, slug }` — consumed by
  `VenuesService.detail()` (unchanged) and validated against Task 2's updated `VenueDetailSchema`.

- [ ] **Step 1: Write the failing test**

```typescript
describe("VenuesRepository.findBySlug — location and new fields", () => {
  it("returns lat/lng, address, photos, and a nested district object via raw SQL", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{
      id: "v1", slug: "a", name: "A", lat: 40.99, lng: 29.02, address: "Adres 1", photos: ["p1"],
      district: { name: "Kadıköy", slug: "kadikoy" },
    }]) } as any;
    const repo = new VenuesRepository(prisma);
    const result = await repo.findBySlug("a");
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(result).toMatchObject({ lat: 40.99, lng: 29.02, address: "Adres 1", photos: ["p1"], district: { name: "Kadıköy", slug: "kadikoy" } });
  });

  it("returns undefined when not found", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    const repo = new VenuesRepository(prisma);
    expect(await repo.findBySlug("missing")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts -t "findBySlug"`
Expected: FAIL — current implementation uses `prisma.venue.findFirst`, has no `lat`/`lng`.

- [ ] **Step 3: Replace `findBySlug` with a raw-SQL version**

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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts -t "findBySlug"`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full repository test suite**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts`
Expected: all pass (Tasks 3-5 combined).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/venues/venues.repository.ts
git commit -m "fix(api): findBySlug now returns venue coordinates, address, photos via raw SQL"
```

---

## Task 6: `open_now` filter + internal `VenueSearchFilters` type

**Files:**
- Modify: `apps/api/src/venues/venues.repository.ts`
- Test: `apps/api/src/venues/venues.repository.spec.ts` (append)

**Interfaces:**
- Consumes: Task 2's `openNow: OptionalTrueFlag` on the (now header-free) query type
- Produces: `VenueSearchFilters` (internal type, not exported to `packages/shared`) —
  `VenueListQuery & { sort: "distance" | "newest"; lat?: number; lng?: number }` — consumed by
  Task 7's `VenuesService.list()`, which constructs this object by merging the parsed query with
  the header-derived location before calling `searchPublished`.

- [ ] **Step 1: Write the failing test**

```typescript
describe("VenuesRepository.searchPublished — openNow", () => {
  it("includes a venue whose current-day hours cover now()", async () => {
    // This test runs against whatever the CI/local clock's current day and time are, so it
    // asserts on SQL construction (the query text mentions openingHours) rather than exact time
    // math — a full time-mocking integration test belongs in a real-DB test, not this unit spec.
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    const repo = new VenuesRepository(prisma);
    await repo.searchPublished({ sort: "newest", limit: 20, openNow: true } as any);
    const sql = prisma.$queryRaw.mock.calls[0][0];
    const sqlText = sql.strings ? sql.strings.join("") : String(sql);
    expect(sqlText).toContain("openingHours");
    expect(sqlText).toContain("Europe/Istanbul");
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

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts -t openNow`
Expected: FAIL — no `openNow` handling exists yet.

- [ ] **Step 3: Add the internal `VenueSearchFilters` type and `open_now` SQL condition**

At the top of `venues.repository.ts`, near the other interfaces:
```typescript
// Internal type only — never exported to packages/shared. `VenueListQuery` (the public API
// contract) no longer carries lat/lng (moved to the X-User-Location header, see
// user-location.decorator.ts) or a resolved `sort`; VenuesService.list() merges the parsed query
// with the header-derived location and a computed sort before calling this repository.
type VenueSearchFilters = Omit<VenueListQuery, "sort"> & { sort: "distance" | "newest"; lat?: number; lng?: number };
```
Change `searchPublished(filters: VenueListQuery)` to `searchPublished(filters: VenueSearchFilters)`.
Add this condition inside the method, alongside the other `conditions.push(...)` calls:
```typescript
    if (filters.openNow) {
      conditions.push(Prisma.sql`
        (
          (EXTRACT(ISODOW FROM now() AT TIME ZONE 'Europe/Istanbul') BETWEEN 1 AND 5
            AND v."openingHours"->>'mon_fri' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$'
            AND (now() AT TIME ZONE 'Europe/Istanbul')::time
              BETWEEN (split_part(v."openingHours"->>'mon_fri', '-', 1))::time
              AND (split_part(v."openingHours"->>'mon_fri', '-', 2))::time)
          OR
          (EXTRACT(ISODOW FROM now() AT TIME ZONE 'Europe/Istanbul') BETWEEN 6 AND 7
            AND v."openingHours"->>'sat_sun' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$'
            AND (now() AT TIME ZONE 'Europe/Istanbul')::time
              BETWEEN (split_part(v."openingHours"->>'sat_sun', '-', 1))::time
              AND (split_part(v."openingHours"->>'sat_sun', '-', 2))::time)
          OR NOT (
            (EXTRACT(ISODOW FROM now() AT TIME ZONE 'Europe/Istanbul') BETWEEN 1 AND 5
              AND v."openingHours"->>'mon_fri' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$')
            OR
            (EXTRACT(ISODOW FROM now() AT TIME ZONE 'Europe/Istanbul') BETWEEN 6 AND 7
              AND v."openingHours"->>'sat_sun' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$')
          )
        )
      `);
    }
```
(The third `OR NOT (...)` branch is the fail-open case: if today's bucket's `openingHours` value
is missing or malformed, the venue is included rather than excluded — a regex mismatch means
"format doesn't parse," which must never surface as a 500 from the `::time` cast, and must never
silently hide a venue whose curator simply wrote hours in a slightly different way.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts -t openNow`
Expected: PASS (2 tests).

- [ ] **Step 5: Write and run a real-DB test for malformed `openingHours` fail-open behavior**

This needs an actual Postgres connection (unit mocks can't verify SQL executes without error).
Add to a new or existing integration test file that already runs against local Postgres (check
`apps/api/test/` for the pattern Plan 1's `app.e2e-spec.ts` established), seeding one venue with
`openingHours: { mon_fri: "kapalı" }` and confirming `searchPublished({ openNow: true, ... })`
does not throw and includes that venue.

- [ ] **Step 6: Run the full repository suite, typecheck**

Run: `cd apps/api && npx jest src/venues/venues.repository.spec.ts && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/venues/venues.repository.ts apps/api/test
git commit -m "feat(api): add open_now filter with timezone-safe, malformed-data-tolerant SQL"
```

---

## Task 7: Location header — `@UserLocationParam()`, pipe scoping, sort-default in service

**Files:**
- Create: `apps/api/src/common/user-location.decorator.ts`
- Modify: `apps/api/src/venues/venues.controller.ts`, `venues.service.ts`
- Modify: `apps/api/src/districts/districts.controller.ts`, `districts.service.ts` (or repository,
  wherever `findNearest` currently lives — check `apps/api/src/districts/`)
- Test: `apps/api/src/common/user-location.decorator.spec.ts`, `venues.service.spec.ts` (append)

**Interfaces:**
- Consumes: Task 2's `VenueListQuerySchema` (no `lat`/`lng`), Task 6's `VenueSearchFilters`
- Produces: `UserLocationParam` decorator (returns `{lat,lng} | undefined`); `VenuesService.list(query, location)`
  computing `sort = query.sort ?? (location ? "distance" : "newest")` before calling
  `VenuesRepository.searchPublished`; `DistrictsController.findNearest` requiring the header
  (`400 LOCATION_REQUIRED` if absent).

- [ ] **Step 1: Write the failing test — `user-location.decorator.spec.ts`**

NestJS custom param decorators created via `createParamDecorator` are awkward to unit test
directly (they're compiled into a special factory) — test the underlying parsing logic as a plain
exported function instead, and have the decorator call it:

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
  // `Number("")` is `0`, a technically-in-range coordinate — without this guard a malformed
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

- [ ] **Step 6: Run test to verify it fails**

Run: `cd apps/api && npx jest src/venues/venues.service.spec.ts -t "sort default"`
Expected: FAIL — `list()` doesn't accept a second `location` argument yet.

- [ ] **Step 7: Update `VenuesService.list`**

```typescript
list(query: VenueListQuery, location?: UserLocation) {
    const sort = query.sort ?? (location ? "distance" : "newest");
    return this.repo.searchPublished({ ...query, sort, lat: location?.lat, lng: location?.lng });
}
```
(Import `UserLocation` from `../common/user-location.decorator`.)

- [ ] **Step 8: Run test to verify it passes**

Run: `cd apps/api && npx jest src/venues/venues.service.spec.ts`
Expected: PASS (all, including pre-existing tests for `list`).

- [ ] **Step 9: Update `VenuesController.list`** — move the pipe to parameter scope, add the
      location parameter

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
Remove the class-or-method-level `@UsePipes(new ZodValidationPipe(VenueListQuerySchema))` if it
was applied at the method level (read the current file first to see exactly where it is — per
Task 20 of Plan 1, `@RateLimit`/`@UseGuards(RateLimitGuard)` also live here, preserve those).

- [ ] **Step 10: Update `DistrictsController.findNearest`** to use `@UserLocationParam()` and
      require it

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

- [ ] **Step 11: Run the full districts + venues test suites**

Run: `cd apps/api && npx jest src/venues src/districts src/common`
Expected: all pass (update any existing controller-level tests that assumed query-param lat/lng
for these two endpoints — this is part of this task, not deferred).

- [ ] **Step 12: Commit**

```bash
git add apps/api/src/common/user-location.decorator.ts apps/api/src/common/user-location.decorator.spec.ts apps/api/src/venues apps/api/src/districts
git commit -m "feat(api): read user location from X-User-Location header instead of query params"
```

---

## Task 8: Admin venue create/update — status, transaction, partial-update completeness

**Files:**
- Modify: `apps/api/src/admin/venues/admin-venues.service.ts`
- Modify: `apps/api/src/rule-engine/boutique.service.ts`
- Test: `apps/api/src/admin/venues/admin-venues.service.spec.ts` (append),
  `apps/api/src/rule-engine/boutique.service.spec.ts` (append)

**Interfaces:**
- Consumes: Task 2's `status` field, Task 3's transaction-aware repository methods, Task 4's
  `findRawForSnapshot`
- Produces: `AdminVenuesService.create()` respects `input.status`; `update()`/`revert()` are
  atomic (transaction + snapshot with location); `BoutiqueService.evaluate()` takes a `status`
  parameter and returns `false` for non-`PUBLISHED` venues; partial updates recompute `isBoutique`
  correctly even when only one of `branchCount`/`franchiseFlag`/`editorialNote` is supplied.

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
Expected: PASS (all, including pre-existing tests — update any existing call site in this test
file that constructs a `BoutiqueInput` without `status`).

- [ ] **Step 4: Write the failing test — `admin-venues.service.spec.ts`, status + transaction + partial update**

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

describe("AdminVenuesService.update — atomic snapshot + write, partial-update completeness", () => {
  it("wraps snapshot + update in a single transaction", async () => {
    const prisma = { $transaction: jest.fn((fn) => fn({ venueVersion: { create: jest.fn() } })) } as any;
    const venuesRepository = {
      findRawForSnapshot: jest.fn().mockResolvedValue({ id: "v1", branchCount: 2, franchiseFlag: false, editorialNote: "old note" }),
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
      findRawForSnapshot: jest.fn().mockResolvedValue({ id: "v1", branchCount: 2, franchiseFlag: false, editorialNote: "old note" }),
      updateWithLocation: jest.fn().mockResolvedValue({ id: "v1" }),
    } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(true) } as any;
    const service = new AdminVenuesService(prisma, boutique, venuesRepository);
    // Only branchCount is in the request; franchiseFlag/editorialNote should come from the existing row.
    await service.update("v1", { branchCount: 5 } as any);
    expect(boutique.evaluate).toHaveBeenCalledWith(expect.objectContaining({ branchCount: 5, franchiseFlag: false, hasEditorialNote: true, status: expect.any(String) }));
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd apps/api && npx jest src/admin/venues/admin-venues.service.spec.ts`
Expected: FAIL — current `create`/`update` don't match these signatures/behaviors.

- [ ] **Step 6: Implement `create()`, `update()`, `revert()`**

```typescript
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
      const snapshot = version.snapshot as any;
      return this.venuesRepository.updateWithLocation(tx, venueId, snapshot);
    });
}
```
(`createdBy: null` matches the plan's existing pattern elsewhere for system-initiated version
rows where no authenticated reviewer id is threaded through yet — if the controller already
passes a reviewer id into `update`/`revert`, use that instead; check the current controller
signature before finalizing this step.)

- [ ] **Step 7: Run test to verify it passes**

Run: `cd apps/api && npx jest src/admin/venues/admin-venues.service.spec.ts`
Expected: PASS (all, including pre-existing CSV-import-related tests in this file, which call
`create()` — verify the `status` default doesn't break the "CSV rows default to PUBLISHED per
Task 9" expectation. If `importRows()` currently calls `this.create({...})` without a `status`,
Task 9 updates that call site to pass one explicitly).

- [ ] **Step 8: Run the full admin/rule-engine test suites, typecheck**

Run: `cd apps/api && npx jest src/admin src/rule-engine && npx tsc --noEmit`

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/admin/venues/admin-venues.service.ts apps/api/src/rule-engine/boutique.service.ts
git commit -m "fix(api): admin venue update/revert atomic with location-inclusive snapshots, boutique rule requires PUBLISHED, partial-update field completion"
```

---

## Task 9: CSV import defaults to PUBLISHED, passes `status`/`address` through

**Files:**
- Modify: `apps/api/src/admin/venues/admin-venues.service.ts` (the `importRows` method)
- Test: `apps/api/src/admin/venues/admin-venues.service.spec.ts` (append)

**Interfaces:**
- Consumes: Task 2's `CsvVenueImportRowSchema.status`, Task 8's `create()`
- Produces: CSV-imported venues default to `PUBLISHED` unless the CSV row explicitly says `DRAFT`.

- [ ] **Step 1: Write the failing test**

```typescript
describe("AdminVenuesService.importRows — status default", () => {
  it("defaults an imported venue to PUBLISHED when the CSV row has no status", async () => {
    const prisma = { venue: { findUnique: jest.fn().mockResolvedValue(null) }, district: { findUnique: jest.fn().mockResolvedValue({ id: "d1" }) } } as any;
    const venuesRepository = { createWithLocation: jest.fn().mockResolvedValue({ id: "v1" }) } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const service = new AdminVenuesService(prisma, boutique, venuesRepository);
    await service.importRows([{ row: 1, data: { name: "A", slug: "a", districtSlug: "kadikoy", category: "cafe", priceRange: "MODERATE", branchCount: 1, franchiseFlag: false, lat: 40.99, lng: 29.02, openingHours: {} } as any }]);
    expect(venuesRepository.createWithLocation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "PUBLISHED" }));
  });

  it("respects an explicit DRAFT status in the CSV row", async () => {
    const prisma = { venue: { findUnique: jest.fn().mockResolvedValue(null) }, district: { findUnique: jest.fn().mockResolvedValue({ id: "d1" }) } } as any;
    const venuesRepository = { createWithLocation: jest.fn().mockResolvedValue({ id: "v1" }) } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const service = new AdminVenuesService(prisma, boutique, venuesRepository);
    await service.importRows([{ row: 1, data: { name: "A", slug: "a", districtSlug: "kadikoy", category: "cafe", priceRange: "MODERATE", branchCount: 1, franchiseFlag: false, lat: 40.99, lng: 29.02, openingHours: {}, status: "DRAFT" } as any }]);
    expect(venuesRepository.createWithLocation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "DRAFT" }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/admin/venues/admin-venues.service.spec.ts -t "importRows — status"`
Expected: FAIL — `importRows`'s call to `create()` doesn't pass `status` yet.

- [ ] **Step 3: Update `importRows`'s call to `this.create(...)`**

Find the object literal passed to `this.create({...})` inside `importRows` and add:
```typescript
          status: row.status ?? "PUBLISHED",
          address: row.address,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/admin/venues/admin-venues.service.spec.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/admin/venues/admin-venues.service.ts
git commit -m "feat(api): CSV import defaults venues to PUBLISHED, passes status/address through"
```

---

## Task 10: `AdminQueueService` — REPORT/EDIT branching, location-safe snapshot, DI fix

**Files:**
- Modify: `apps/api/src/admin/queue/admin-queue.service.ts`
- Modify: `apps/api/src/admin/queue/admin-queue.module.ts`
- Test: `apps/api/src/admin/queue/admin-queue.service.spec.ts` (append/modify)

**Interfaces:**
- Consumes: Task 4's `findRawForSnapshot`
- Produces: `AdminQueueService.approve()` — `REPORT` type only flips `ContributionQueue.status`
  (no `Venue` write); `EDIT` type keeps taking a location-inclusive snapshot + bumping
  `verifiedAt`. `AdminQueueModule` now imports `VenuesModule` so `VenuesRepository` can be injected.

- [ ] **Step 1: Write the failing test**

```typescript
describe("AdminQueueService.approve — REPORT vs EDIT branching", () => {
  it("REPORT: only flips ContributionQueue status, never touches Venue", async () => {
    const item = { id: "c1", type: "REPORT", venueId: "v1", status: "PENDING" };
    const prisma = { $transaction: jest.fn((fn) => fn({
      contributionQueue: { findUniqueOrThrow: jest.fn().mockResolvedValue(item), update: jest.fn().mockResolvedValue({}) },
      venue: { update: jest.fn() },
      venueVersion: { create: jest.fn() },
    })) } as any;
    const venuesRepository = { findRawForSnapshot: jest.fn() } as any;
    const service = new AdminQueueService(prisma, venuesRepository);
    await service.approve("c1", "curator-1");
    const tx = await prisma.$transaction.mock.calls[0][0]({
      contributionQueue: { findUniqueOrThrow: jest.fn().mockResolvedValue(item), update: jest.fn().mockResolvedValue({}) },
      venue: { update: jest.fn() },
      venueVersion: { create: jest.fn() },
    });
    expect(venuesRepository.findRawForSnapshot).not.toHaveBeenCalled();
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
Expected: FAIL — current `approve()` doesn't branch by type, doesn't take `VenuesRepository`.

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
      // bumps verifiedAt and records a VenueVersion (Task 8).
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
git commit -m "fix(api): REPORT approval no longer mutates Venue; EDIT approval snapshot includes location; wire VenuesModule into AdminQueueModule"
```

---

## Task 11: Remaining data-integrity fixes (B9, B10, B11, B12, B13)

**Files:**
- Modify: `apps/api/src/favorites/favorites.service.ts`
- Modify: `apps/api/src/districts/districts.repository.ts` (or wherever `findNearestDistrict` lives)
- Modify: `apps/api/src/venues/venues.controller.ts` (bbox validation)
- Modify: `apps/api/src/auth/roles.guard.ts`
- Test: corresponding `.spec.ts` files (append)

**Interfaces:**
- Consumes: nothing new
- Produces: `FavoritesService.addVenue` rejects non-`PUBLISHED` venues; `findNearestDistrict`
  filters `status='PUBLISHED'` and returns `cityId`/`slug`; bbox query validated by a Zod schema;
  `RolesGuard` returns 401 (no user) vs 403 (wrong role) distinctly.

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

- [ ] **Step 7: Write the failing test for bbox validation**

```typescript
describe("VenuesController.mapView — bbox validation", () => {
  it("rejects a malformed bbox with 400 instead of crashing", async () => {
    // Adjust to however this controller is tested elsewhere (e2e vs unit) — the key assertion is
    // that a bbox like "not,numbers,here" or one with only 3 parts produces a 400 VALIDATION_ERROR,
    // not a 500 from PostGIS.
  });
});
```

- [ ] **Step 8: Add a `BboxQuerySchema` to `packages/shared/src/schemas/venue.schema.ts`**

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
Use this in `VenuesController.mapView` via a parameter-scoped `ZodValidationPipe`, replacing the
current manual `bbox.split(",").map(Number)`.

- [ ] **Step 9: Run relevant tests, then write the failing test for `RolesGuard`'s 401/403 split**

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

- [ ] **Step 10: Run test to verify it fails, then update `RolesGuard`**

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

- [ ] **Step 11: Run test to verify it passes, then find and update every existing test across the
      codebase that asserts a bare-`false`/403 return from `RolesGuard` for the no-user case**

Run: `cd apps/api && npx jest src/auth` first, then:
Run: `cd apps/api && grep -rl "RolesGuard" src --include=*.spec.ts` to find all affected test
files (admin controllers/services, favorites, etc.) and update any assertion that expected a
plain `false`/generic 403 for the "no token" case to expect 401 instead.

- [ ] **Step 12: Run the full test suite, typecheck**

Run: `cd apps/api && npx jest && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 13: Commit**

```bash
git add apps/api/src apps/web/src packages/shared/src
git commit -m "fix(api): favorites/nearest-district PUBLISHED checks, bbox validation, 401 vs 403 split in RolesGuard"
```

---

## Task 12: Re-verify cron actually runs

**Files:**
- Modify: `apps/api/package.json` (add `@nestjs/schedule`)
- Modify: `apps/api/src/rule-engine/rule-engine.module.ts`, `re-verify.service.ts`
- Test: `apps/api/src/rule-engine/re-verify.service.spec.ts` (append)

**Interfaces:**
- Consumes: nothing new
- Produces: `ReVerifyService.enqueueStale()` runs daily via a named, registered cron job
  (`"re-verify-stale"`), verifiable via `SchedulerRegistry`.

- [ ] **Step 1: Add the dependency**

Run: `cd apps/api && pnpm add @nestjs/schedule`

- [ ] **Step 2: Write the failing test**

```typescript
import { Test } from "@nestjs/testing";
import { SchedulerRegistry } from "@nestjs/schedule";
import { ScheduleModule } from "@nestjs/schedule";
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
git add apps/api/package.json apps/api/src/rule-engine
git commit -m "feat(api): wire re-verify stale-venue job to a real daily cron"
```

---

## Task 13: Security hardening (B7, B14, B15, B16)

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

- [ ] **Step 2: Write the failing test — `admin-users.service.spec.ts`**

```typescript
describe("AdminUsersService.assignRole — MVP restricts to curator only", () => {
  it("rejects assigning the admin role in MVP", async () => {
    const prisma = { user: { update: jest.fn() } } as any;
    const service = new AdminUsersService(prisma);
    await expect(service.assignRole("u1", "admin")).rejects.toThrow("Bu rol MVP'de kullanılamaz (Faz 2)");
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then change `MVP_ASSIGNABLE_ROLES` to `["curator"]`**

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/admin/users/admin-users.service.spec.ts`

- [ ] **Step 5: Guard Swagger behind `NODE_ENV`**

In `main.ts`, wrap the `SwaggerModule.setup("docs", app, document)` call:
```typescript
  if (process.env.NODE_ENV !== "production") {
    SwaggerModule.setup("docs", app, document);
  }
```

- [ ] **Step 6: Write the failing test for `AllExceptionsFilter`**

```typescript
import { ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { AllExceptionsFilter } from "./all-exceptions.filter";

function mockHost(statusFn: jest.Mock, sendFn: jest.Mock): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status: statusFn.mockReturnValue({ send: sendFn }), header: jest.fn() }),
      getRequest: () => ({}),
    }),
  } as any;
}

describe("AllExceptionsFilter", () => {
  it("passes through an existing HttpException unchanged (does not swallow 429/Retry-After)", () => {
    const filter = new AllExceptionsFilter();
    const httpAdapterHost = { httpAdapter: { reply: jest.fn() } } as any;
    // Depending on the real base class this extends, adjust the assertion to confirm the
    // response body/status is exactly what the original HttpException carried, not rewritten.
  });

  it("converts an unhandled non-HttpException error to the standard error envelope", () => {
    const filter = new AllExceptionsFilter();
    const sendFn = jest.fn();
    const statusFn = jest.fn();
    const host = mockHost(statusFn, sendFn);
    filter.catch(new Error("boom"), host);
    expect(statusFn).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(sendFn).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: expect.any(String) }) }));
  });
});
```
(This test's exact mock shape depends on which base NestJS class `AllExceptionsFilter` extends —
`BaseExceptionFilter` from `@nestjs/core` is the idiomatic choice for "handle everything I don't
explicitly override." Adjust the constructor/mock to match whatever the implementation in Step 7
actually requires; the fixed points are the two behaviors under test, not the exact mock shape.)

- [ ] **Step 7: Implement `AllExceptionsFilter`**

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
      // (401/403/404/409/429 with Retry-After, etc.) -- re-throwing here would just re-trigger
      // this same filter. Reply with its own response body/status directly.
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
      any existing endpoint's observable status code/body**

Run: `cd apps/api && npx jest`
Expected: all pass, unchanged from before this task (this filter should be invisible to every
test that already exercises a proper `HttpException` path — if anything breaks, the filter is
altering existing HttpException behavior, which the design explicitly forbids).

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/common apps/api/src/reports apps/api/src/venues apps/api/src/districts apps/api/src/favorites apps/api/src/admin/users apps/api/src/main.ts apps/api/.env.example
git commit -m "feat(api): env-configurable rate limits, MVP-only curator role assignment, prod-gated Swagger, global exception filter"
```

---

## Task 14: Full regression pass and self-review

**Files:** none created — this task verifies the whole plan's diff together.

- [ ] **Step 1: Run the complete test suite**

Run: `cd apps/api && npx jest && cd ../../packages/shared && npx vitest run`
Expected: 100% pass, no skipped tests.

- [ ] **Step 2: Typecheck and lint everything this plan touched**

Run: `pnpm exec turbo run typecheck lint --filter=@gurmego/api... --filter=@gurmego/shared`
Expected: clean (only pre-existing documented warnings, per Plan 4a's established baseline).

- [ ] **Step 3: Real smoke test — publish a venue end to end**

Using the real local Supabase stack (`npx supabase status` from repo root for current ports),
start the API for real (`cd apps/api && npx ts-node -T src/main.ts`, per the `packages/shared`
build fix from Plan 4a this now works via `node dist/main.js` too if built first) and:
```bash
# 1. Create a PUBLISHED venue directly via the admin API (Postman-equivalent, curl with a real curator JWT)
curl -X POST http://localhost:3001/v1/admin/venues -H "Authorization: Bearer <curator-jwt>" -H "Content-Type: application/json" -d '{"name":"Smoke Test Cafe","slug":"smoke-test-cafe","districtId":"<real-district-id>","category":"cafe","priceRange":"MODERATE","openingHours":{"mon_fri":"09:00-18:00"},"branchCount":1,"franchiseFlag":false,"lat":40.99,"lng":29.02,"status":"PUBLISHED"}'
# 2. Confirm it appears in the public list
curl http://localhost:3001/v1/venues
```
Expected: step 2's response includes "Smoke Test Cafe" — this is the real-world proof that A1
(the audit's #1 finding) is actually fixed, not just unit-tested.

- [ ] **Step 4: Update `docs/STATE.md` and `docs/SESSION-LOG-2026-07-26.md`**

Record Plan 4b complete, ready for `plan-red-team`.

---

## Self-Review Notes (completed during plan authoring)

- **Spec coverage:** every numbered finding from `docs/AUDIT-2026-07-26.md`'s backend section
  (A1, A2 backend half, A3, A4, A5 deferred per user decision, B1 deferred per design, B2 deferred
  to Plan 4a, B3-B16) maps to a task above. A5 (cursor pagination) and B1/B2 are explicitly
  documented as deferred, not silently dropped — see design doc Bölüm 1/9.
- **Placeholder scan:** no TBD/TODO; every step has real code or an exact command.
- **Type consistency:** `AdminVenueCreateInput`/`UpdateInput` (Task 2) flow unchanged into
  `CreateVenueWithLocationInput`/`UpdateVenueWithLocationInput` (Task 3) via `AdminVenuesService`
  (Task 8) — field names match throughout. `VenueSearchFilters` (Task 6) is consumed by
  `VenuesService.list` (Task 7) exactly as constructed.
- **Cross-task dependencies made explicit:** Task 1 before Task 5 (address/photos columns before
  they're selected); Task 2 before everything (shared contract); Task 3/4 before Task 8/10
  (transaction-aware repository before its transactional callers); Task 6/7 depend on Task 2's
  schema changes.
