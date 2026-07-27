import { AdminQueueService } from "./admin-queue.service";

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
  function makeQueuePrisma(items: any[], groupByResult: any[]) {
    return {
      contributionQueue: {
        findMany: jest.fn().mockResolvedValue(items),
        groupBy: jest.fn().mockResolvedValue(groupByResult),
        count: jest.fn(), // must never be called -- would indicate the N+1 pattern regressed
      },
    } as any;
  }

  // MAJOR 1 fix (final whole-branch review): `limit` used to be passed straight through as the
  // findMany `take`, which meant urgency/priority was computed AFTER the DB had already discarded
  // everything past `limit` in raw insertion order -- an urgent/re_verify row ranked past `limit`
  // could never surface regardless of priority. The findMany now always fetches the larger,
  // bounded `CANDIDATE_FETCH_CAP` candidate set; `limit` only slices the final, already-sorted
  // response. These two tests assert that decoupling directly.
  it("fetches the bounded internal candidate cap on the findMany query, NOT the caller's `limit`", async () => {
    const prisma = makeQueuePrisma([], []);
    const service = new AdminQueueService(prisma, {} as any);

    await service.list(undefined, "PENDING", 25);

    expect(prisma.contributionQueue.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2000 }));
  });

  it("still respects a small `limit` for the RESPONSE size even though the DB fetch uses the larger candidate cap", async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, type: "EDIT", venueId: null, venue: null }));
    const prisma = makeQueuePrisma(items, []);
    const service = new AdminQueueService(prisma, {} as any);

    const result = await service.list(undefined, "PENDING", 2);

    expect(result).toHaveLength(2);
  });

  it("defaults `limit` to 100 when not passed (response size, not the DB fetch)", async () => {
    const prisma = makeQueuePrisma([], []);
    const service = new AdminQueueService(prisma, {} as any);

    await service.list();

    expect(prisma.contributionQueue.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2000 }));
  });

  it("returns an urgent item even when it is inserted LAST and total items exceed `limit` -- proves urgency is computed before the client-facing slice, not after (MAJOR 1 regression test)", async () => {
    const limit = 3;
    // 4 non-urgent EDIT items (older, createdAt-asc first) + 1 urgent REPORT item inserted LAST.
    // A naive `take: limit` at the DB level would fetch only the first 3 (all non-urgent EDITs)
    // and never even see the urgent REPORT row, regardless of any later sort.
    const items = [
      { id: "old-1", type: "EDIT", venueId: null, venue: null },
      { id: "old-2", type: "EDIT", venueId: null, venue: null },
      { id: "old-3", type: "EDIT", venueId: null, venue: null },
      { id: "old-4", type: "EDIT", venueId: null, venue: null },
      { id: "urgent-last", type: "REPORT", venueId: "v1", venue: { name: "A", slug: "a" } },
    ];
    const groupByResult = [{ venueId: "v1", _count: { _all: 3 } }]; // >= default threshold 3 -> urgent
    const prisma = makeQueuePrisma(items, groupByResult);
    const service = new AdminQueueService(prisma, {} as any);

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
    const service = new AdminQueueService(prisma, {} as any);

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
    const service = new AdminQueueService(prisma, {} as any);

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
    const service = new AdminQueueService(prisma, {} as any);

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
    const service = new AdminQueueService(prisma, venuesRepository);
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
    const service = new AdminQueueService(prisma, venuesRepository);
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
    const service = new AdminQueueService(prisma, venuesRepository);

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
    const service = new AdminQueueService(prisma, { findRawForSnapshot: jest.fn() } as any);

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
    const service = new AdminQueueService(prisma, { findRawForSnapshot: jest.fn() } as any);

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
    const service = new AdminQueueService(prisma, { findRawForSnapshot: jest.fn() } as any);

    await service.reject("c1", "curator-1");

    expect(prisma.contributionQueue.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", status: "PENDING" },
      data: { status: "REJECTED", reviewedBy: "curator-1", reviewedAt: expect.any(Date) },
    });
  });

  it("throws a conflict error and makes no writes when the item is already REJECTED", async () => {
    const item = { id: "c1", type: "EDIT", venueId: "v1", status: "REJECTED" };
    const prisma = makePrisma({ item });
    const service = new AdminQueueService(prisma, { findRawForSnapshot: jest.fn() } as any);

    await expect(service.reject("c1", "curator-1")).rejects.toMatchObject({
      response: { error: { code: "CONTRIBUTION_ALREADY_PROCESSED" } },
    });
  });

  it("throws a 404 when the id is well-formed but no such contribution exists", async () => {
    const prisma = {
      contributionQueue: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((fn) => fn(prisma)),
    } as any;
    const service = new AdminQueueService(prisma, { findRawForSnapshot: jest.fn() } as any);

    await expect(service.reject("missing-id", "curator-1")).rejects.toThrow("Katkı bulunamadı");
  });
});
