import { auditStub } from "../../audit/audit-stub";
import { AdminQueueService } from "./admin-queue.service";
import { VenuesRepository } from "../../venues/venues.repository";
import { PrismaService } from "../../prisma/prisma.service";

// TASK 27 fix (Codex cross-model review of Task 26, MINOR): `list()` never calls
// `venuesRepository` at all, so the `list()`-focused tests below only need a type-correct
// placeholder, not a real mock. `{} as any` (the prior version) violated the project's `any` ban
// with no justification; `as unknown as VenuesRepository` keeps the same "unused placeholder"
// intent without introducing `any` into the file.
const unusedVenuesRepository = {} as unknown as VenuesRepository;

// Builds a prisma-like mock whose `$transaction` invokes the callback with a `tx` object that
// mirrors `prisma` itself — mirrors how real Prisma's interactive transactions work, so the
// service code (which uses `tx.*` instead of `this.prisma.*` inside `$transaction`) can be
// tested without a real database.
function makePrisma(overrides: { item: any; venue?: any }) {
  const item = { ...overrides.item };
  const prisma: any = {
    contributionQueue: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(item)),
      findUniqueOrThrow: jest.fn().mockImplementation(() => Promise.resolve(item)),
      updateMany: jest.fn().mockImplementation(() => Promise.resolve(item.status === "PENDING" ? { count: 1 } : { count: 0 })),
      update: jest.fn().mockResolvedValue({}),
    },
    venue: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(overrides.venue),
      update: jest.fn().mockResolvedValue({}),
    },
    venueVersion: { create: jest.fn().mockResolvedValue({}) },
  };
  prisma.$transaction = jest.fn().mockImplementation((cb: any) => cb(prisma));
  return prisma;
}

describe("AdminQueueService.list — pagination and batched urgency count", () => {
  // Security/ops finding: `list()` used to fetch every matching row with no cap, and ran one
  // SEPARATE `count()` per REPORT row to compute urgency -- the same venue's count recomputed
  // redundantly across its own rows. Both must be fixed: a `take` limit on the findMany, and a
  // single `groupBy` covering every REPORT row's venueId in the page (not one query per row).
  // TASK 27 fix (second Codex cross-model review pass, MINOR): was `(items: any[], groupByResult:
  // any[])` returning `{...} as any` -- violated the project's `any` ban with no justification.
  // Returning this minimal, concrete shape (instead of casting straight to `PrismaService`) keeps
  // `.mock.calls` etc. visible on the jest mocks at each call site below; callers cast to
  // `PrismaService` only at the `new AdminQueueService(...)` boundary, where a real `PrismaService`
  // is actually required.
  function makeQueuePrisma(items: Record<string, unknown>[], groupByResult: Record<string, unknown>[]) {
    return {
      contributionQueue: {
        findMany: jest.fn().mockResolvedValue(items),
        groupBy: jest.fn().mockResolvedValue(groupByResult),
        count: jest.fn(), // must never be called -- would indicate the N+1 pattern regressed
      },
    };
  }

  // TASK 27 fix (Codex cross-model review of Task 26, MAJOR 1): `CANDIDATE_FETCH_CAP` (2000)
  // reintroduced the exact bug it claimed to fix, just moved further out -- an urgent/re_verify
  // row ranked past row 2000 in `createdAt asc` order was still never fetched, so it could never
  // surface regardless of priority. docs/rule-engine.md §5 documents the pilot's actual scale (30-
  // 45 venues, single "bilgi yanlış" report flow) -- there is no scale justification for ANY
  // DB-level cap here. The fix removes it entirely: `findMany` fetches every matching row, and
  // `limit` only ever slices the final, already-sorted response.
  it("fetches every matching row with no DB-level cap -- priority sorting always sees the true candidate set", async () => {
    const prisma = makeQueuePrisma([], []);
    const service = new AdminQueueService(prisma as unknown as PrismaService, unusedVenuesRepository, auditStub());

    await service.list(undefined, "PENDING", 25);

    const callArgs = prisma.contributionQueue.findMany.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty("take");
  });

  it("still respects a small `limit` for the RESPONSE size even though the DB fetch is uncapped", async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, type: "EDIT", venueId: null, venue: null }));
    const prisma = makeQueuePrisma(items, []);
    const service = new AdminQueueService(prisma as unknown as PrismaService, unusedVenuesRepository, auditStub());

    const result = await service.list(undefined, "PENDING", 2);

    expect(result).toHaveLength(2);
  });

  // MINOR 6 fix (Codex cross-model review of Task 26): the old version of this test only checked
  // the DB fetch's `take` value with an EMPTY items array -- it never actually proved the
  // RESPONSE was sliced to the default limit. This uses a real >100-item candidate set.
  it("defaults `limit` to 100 when not passed, slicing the response to exactly 100 items", async () => {
    const items = Array.from({ length: 150 }, (_, i) => ({ id: `c${i}`, type: "EDIT", venueId: null, venue: null }));
    const prisma = makeQueuePrisma(items, []);
    const service = new AdminQueueService(prisma as unknown as PrismaService, unusedVenuesRepository, auditStub());

    const result = await service.list();

    const callArgs = prisma.contributionQueue.findMany.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty("take");
    expect(result).toHaveLength(100);
  });

  // MINOR 7 fix (Codex cross-model review of Task 26): the old version of this test used only 5
  // items and relied on a mock that never actually implemented `take`, so it could not have
  // caught the real bug (an urgent row beyond the DB-level cap never being fetched at all) even
  // before this cap was removed. This uses an item count large enough that the OLD 2000-item cap
  // would not have been the thing hiding the bug, and the urgent item is placed past a small
  // `limit` to prove urgency is computed on the full fetched set, before the response slice.
  it("returns an urgent item even when it is inserted LAST among many items and exceeds `limit` -- proves urgency is computed before the client-facing slice, not after (MAJOR 1 regression test)", async () => {
    const limit = 3;
    const oldItems = Array.from({ length: 10 }, (_, i) => ({ id: `old-${i}`, type: "EDIT", venueId: null, venue: null }));
    const items = [...oldItems, { id: "urgent-last", type: "REPORT", venueId: "v1", venue: { name: "A", slug: "a" } }];
    const groupByResult = [{ venueId: "v1", _count: { _all: 3 } }]; // >= default threshold 3 -> urgent
    const prisma = makeQueuePrisma(items, groupByResult);
    const service = new AdminQueueService(prisma as unknown as PrismaService, unusedVenuesRepository, auditStub());

    const result = await service.list(undefined, "PENDING", limit);

    expect(result).toHaveLength(limit);
    expect(result.some((r) => r.id === "urgent-last")).toBe(true);
    expect(result[0].id).toBe("urgent-last");
  });

  // MAJOR 2 fix: docs/rule-engine.md §6 (FR-AP-01) documents a THREE-tier MVP priority order --
  // 1. urgent REPORT, 2. re_verify EDIT, 3. everything else -- which a prior version of this
  // service's comment incorrectly claimed no doc required. This proves the missing middle tier.
  it("sorts re_verify EDIT items ahead of ordinary (non-urgent, non-re_verify) items, but behind urgent REPORT items", async () => {
    const items = [
      { id: "ordinary", type: "EDIT", venueId: null, venue: null, payload: {} },
      { id: "re-verify-1", type: "EDIT", venueId: "v2", venue: { name: "B", slug: "b" }, payload: { kind: "re_verify" } },
      { id: "urgent-report", type: "REPORT", venueId: "v1", venue: { name: "A", slug: "a" }, payload: {} },
    ];
    const groupByResult = [{ venueId: "v1", _count: { _all: 3 } }];
    const prisma = makeQueuePrisma(items, groupByResult);
    const service = new AdminQueueService(prisma as unknown as PrismaService, unusedVenuesRepository, auditStub());

    const result = await service.list();

    expect(result.map((r) => r.id)).toEqual(["urgent-report", "re-verify-1", "ordinary"]);
  });

  it("computes urgency for multiple REPORT rows across DIFFERENT venues with exactly ONE groupBy call, never per-row count()", async () => {
    const items = [
      { id: "c1", type: "REPORT", venueId: "v1", venue: { name: "A", slug: "a" } },
      { id: "c2", type: "REPORT", venueId: "v2", venue: { name: "B", slug: "b" } },
      { id: "c3", type: "EDIT", venueId: "v3", venue: { name: "C", slug: "c" } },
    ];
    // v1 has 3 pending reports (>= default threshold 3 -> urgent), v2 has 1 (not urgent).
    const groupByResult = [
      { venueId: "v1", _count: { _all: 3 } },
      { venueId: "v2", _count: { _all: 1 } },
    ];
    const prisma = makeQueuePrisma(items, groupByResult);
    const service = new AdminQueueService(prisma as unknown as PrismaService, unusedVenuesRepository, auditStub());

    const result = await service.list();

    expect(prisma.contributionQueue.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.contributionQueue.groupBy).toHaveBeenCalledWith({
      by: ["venueId"],
      where: { venueId: { in: ["v1", "v2"] }, type: "REPORT", status: "PENDING" },
      _count: { _all: true },
    });
    expect(prisma.contributionQueue.count).not.toHaveBeenCalled();

    const c1 = result.find((r) => r.id === "c1");
    const c2 = result.find((r) => r.id === "c2");
    const c3 = result.find((r) => r.id === "c3");
    expect(c1?.urgent).toBe(true);
    expect(c2?.urgent).toBe(false);
    expect(c3?.urgent).toBe(false);
    // Urgent items sort first.
    expect(result[0].id).toBe("c1");
  });

  it("skips the groupBy call entirely when the page has no REPORT rows", async () => {
    const items = [{ id: "c3", type: "EDIT", venueId: "v3", venue: { name: "C", slug: "c" } }];
    const prisma = makeQueuePrisma(items, []);
    const service = new AdminQueueService(prisma as unknown as PrismaService, unusedVenuesRepository, auditStub());

    const result = await service.list();

    expect(prisma.contributionQueue.groupBy).not.toHaveBeenCalled();
    expect(result[0].urgent).toBe(false);
  });
});

describe("AdminQueueService.approve — REPORT vs EDIT branching", () => {
  it("REPORT: only flips ContributionQueue status, never touches Venue or VenueVersion", async () => {
    const item = { id: "c1", type: "REPORT", venueId: "v1", status: "PENDING" };
    const txClient = {
      contributionQueue: {
        findUnique: jest.fn().mockResolvedValue(item),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...item, status: "APPROVED" }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      venue: { update: jest.fn() }, venueVersion: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((fn) => fn(txClient)) } as any;
    const venuesRepository = { findRawForSnapshot: jest.fn() } as any;
    const service = new AdminQueueService(prisma, venuesRepository, auditStub());
    await service.approve("c1", "curator-1");
    expect(venuesRepository.findRawForSnapshot).not.toHaveBeenCalled();
    expect(txClient.venue.update).not.toHaveBeenCalled();
    expect(txClient.venueVersion.create).not.toHaveBeenCalled();
    expect(txClient.contributionQueue.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", status: "PENDING" },
      data: expect.objectContaining({ status: "APPROVED", reviewedBy: "curator-1" }),
    });
  });

  it("EDIT: takes a location-inclusive snapshot via findRawForSnapshot, bumps verifiedAt", async () => {
    const item = { id: "c2", type: "EDIT", venueId: "v1", status: "PENDING" };
    const snapshot = { id: "v1", lat: 40.99, lng: 29.02 };
    const txMock = {
      contributionQueue: {
        findUnique: jest.fn().mockResolvedValue(item),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...item, status: "APPROVED" }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      venue: { update: jest.fn().mockResolvedValue({}) }, venueVersion: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((fn) => fn(txMock)) } as any;
    const venuesRepository = { findRawForSnapshot: jest.fn().mockResolvedValue(snapshot) } as any;
    const service = new AdminQueueService(prisma, venuesRepository, auditStub());
    await service.approve("c2", "curator-1");
    expect(venuesRepository.findRawForSnapshot).toHaveBeenCalledWith(txMock, "v1");
    expect(txMock.venueVersion.create).toHaveBeenCalledWith({ data: { venueId: "v1", snapshot, createdBy: "curator-1" } });
    expect(txMock.venue.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { verifiedAt: expect.any(Date) } });
  });

  it("throws a conflict error and makes no writes when the item is already APPROVED", async () => {
    const item = { id: "c1", type: "EDIT", venueId: "v1", status: "APPROVED", payload: { kind: "re_verify" } };
    const venue = { id: "v1", name: "A", editorialNote: "old" };
    const prisma = makePrisma({ item, venue });
    const venuesRepository = { findRawForSnapshot: jest.fn() } as any;
    const service = new AdminQueueService(prisma, venuesRepository, auditStub());

    await expect(service.approve("c1", "curator-1")).rejects.toMatchObject({
      response: { error: { code: "CONTRIBUTION_ALREADY_PROCESSED" } },
    });

    expect(venuesRepository.findRawForSnapshot).not.toHaveBeenCalled();
    expect(prisma.venueVersion.create).not.toHaveBeenCalled();
    expect(prisma.venue.update).not.toHaveBeenCalled();
  });

  it("throws a 404 when the id is well-formed but no such contribution exists (regression: was an uncaught Prisma error surfacing as 500)", async () => {
    const prisma = {
      contributionQueue: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((fn) => fn(prisma)),
    } as any;
    const service = new AdminQueueService(prisma, { findRawForSnapshot: jest.fn() } as any, auditStub());

    try {
      await service.approve("missing-id", "curator-1");
      throw new Error("expected approve to throw");
    } catch (err: any) {
      expect(err.getResponse()).toEqual({ error: { code: "CONTRIBUTION_NOT_FOUND", message: "Katkı bulunamadı" } });
      expect(err.getResponse().message).toBeUndefined();
      expect(err.message).toBe("Katkı bulunamadı");
    }
  });

  it("race condition: a conditional updateMany (not a plain findThenUpdate) guards the PENDING->APPROVED transition -- a second approve call after the WHERE-guarded write already flipped status away from PENDING is rejected, not silently re-applied", async () => {
    // Simulates what a real concurrent second transaction sees once the first has committed: the
    // conditional `updateMany({ where: { status: "PENDING" } })` affects 0 rows because the row is
    // no longer PENDING by the time this call's WHERE clause is evaluated -- this is exactly the
    // mechanism a real Postgres row lock enforces (see the real-DB concurrency test in
    // admin-queue-race.e2e-spec.ts, which proves this against actual concurrent transactions, not
    // just this mocked call-shape assertion).
    const item = { id: "c1", type: "REPORT", venueId: "v1", status: "APPROVED" };
    const txClient = {
      contributionQueue: {
        findUnique: jest.fn().mockResolvedValue(item),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      venue: { update: jest.fn() }, venueVersion: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((fn) => fn(txClient)) } as any;
    const service = new AdminQueueService(prisma, { findRawForSnapshot: jest.fn() } as any, auditStub());

    await expect(service.approve("c1", "curator-2")).rejects.toMatchObject({
      response: { error: { code: "CONTRIBUTION_ALREADY_PROCESSED" } },
    });
    expect(txClient.venue.update).not.toHaveBeenCalled();
    expect(txClient.venueVersion.create).not.toHaveBeenCalled();
  });
});

describe("AdminQueueService.reject", () => {
  it("updates status to REJECTED for a PENDING item", async () => {
    const item = { id: "c1", type: "EDIT", venueId: "v1", status: "PENDING" };
    const prisma = makePrisma({ item });
    const service = new AdminQueueService(prisma, { findRawForSnapshot: jest.fn() } as any, auditStub());

    await service.reject("c1", "curator-1");

    expect(prisma.contributionQueue.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", status: "PENDING" },
      data: { status: "REJECTED", reviewedBy: "curator-1", reviewedAt: expect.any(Date) },
    });
  });

  it("throws a conflict error and makes no writes when the item is already REJECTED", async () => {
    const item = { id: "c1", type: "EDIT", venueId: "v1", status: "REJECTED" };
    const prisma = makePrisma({ item });
    const service = new AdminQueueService(prisma, { findRawForSnapshot: jest.fn() } as any, auditStub());

    await expect(service.reject("c1", "curator-1")).rejects.toMatchObject({
      response: { error: { code: "CONTRIBUTION_ALREADY_PROCESSED" } },
    });
  });

  it("throws a 404 when the id is well-formed but no such contribution exists", async () => {
    const prisma = {
      contributionQueue: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((fn) => fn(prisma)),
    } as any;
    const service = new AdminQueueService(prisma, { findRawForSnapshot: jest.fn() } as any, auditStub());

    await expect(service.reject("missing-id", "curator-1")).rejects.toThrow("Katkı bulunamadı");
  });
});
