import { RateLimitCountersRepository } from "./rate-limit-counters.repository";
import { PrismaService } from "../prisma/prisma.service";

describe("RateLimitCountersRepository.increment", () => {
  it("runs the upsert and returns the resulting count", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ count: 1 }]) } as unknown as PrismaService;
    const repo = new RateLimitCountersRepository(prisma);
    const now = new Date("2026-01-01T00:00:00Z");
    const windowEnd = new Date("2026-01-01T00:01:00Z");

    const count = await repo.increment("report:1.2.3.4", now, windowEnd);

    expect(count).toBe(1);
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it("issues an INSERT ... ON CONFLICT upsert with parameters bound in the exact documented order", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ count: 4 }]) } as unknown as PrismaService;
    const repo = new RateLimitCountersRepository(prisma);
    const now = new Date("2026-02-02T00:00:00Z");
    const windowEnd = new Date(now.getTime() + 60_000);

    const count = await repo.increment("read:5.6.7.8", now, windowEnd);

    expect(count).toBe(4);
    // increment() calls $queryRaw as a direct tagged template (not via Prisma.sql, unlike the
    // other repositories in this codebase), so the mock receives the literal-strings array as its
    // first argument and each interpolated expression as a positional rest argument -- not a
    // single Sql-shaped object with .strings/.values.
    const call = (prisma.$queryRaw as jest.Mock).mock.calls[0];
    const sqlText = (call[0] as string[]).join("");
    expect(sqlText).toContain("rate_limit_counters");
    expect(sqlText).toContain("ON CONFLICT (key) DO UPDATE SET");
    expect(sqlText).toContain("RETURNING count");
    // Loose substring checks alone don't prove the CASE WHEN reset logic wires up the right
    // values in the right places -- a swapped `now`/`windowEnd` argument, or an accidental
    // extra/missing interpolation, would leave the surrounding SQL text unchanged but silently
    // corrupt the reset behavior. Assert the exact bound values AND their positions: `key` once
    // (the INSERT's VALUES clause), `windowEnd` twice (the initial INSERT value, then the reset
    // branch of the "windowEnd" CASE WHEN), `now` twice (both CASE WHEN expiry checks).
    expect(call.slice(1)).toEqual(["read:5.6.7.8", windowEnd, now, now, windowEnd]);
  });

  it("still resolves the count from whatever row $queryRaw returns, regardless of which CASE WHEN branch produced it", async () => {
    // Complements the parameter-order assertion above: proves increment() doesn't post-process or
    // recompute the returned count itself -- it trusts and returns exactly what the single
    // RETURNING clause yields, whether that came from the fresh-window reset branch (count -> 1)
    // or the same-window increment branch (count -> existing + 1). The CASE WHEN expressions
    // themselves are Postgres-evaluated SQL and are exercised against a real database by this
    // codebase's e2e suite (test/app.e2e-spec.ts hits rate_limit_counters through RateLimitGuard);
    // this unit test's job is only to prove the repository forwards Postgres's answer verbatim.
    const resetPrisma = { $queryRaw: jest.fn().mockResolvedValue([{ count: 1 }]) } as unknown as PrismaService;
    const now = new Date("2026-03-01T00:10:00Z");
    const windowEnd = new Date(now.getTime() + 60_000);
    await expect(new RateLimitCountersRepository(resetPrisma).increment("read:9.9.9.9", now, windowEnd)).resolves.toBe(1);

    const incrementPrisma = { $queryRaw: jest.fn().mockResolvedValue([{ count: 8 }]) } as unknown as PrismaService;
    await expect(new RateLimitCountersRepository(incrementPrisma).increment("read:9.9.9.9", now, windowEnd)).resolves.toBe(8);
  });
});

describe("RateLimitCountersRepository.deleteExpired", () => {
  it("issues a DELETE bound to the given cutoff and returns the affected row count", async () => {
    const prisma = { $executeRaw: jest.fn().mockResolvedValue(7) } as unknown as PrismaService;
    const repo = new RateLimitCountersRepository(prisma);
    const cutoff = new Date("2026-01-01T00:00:00Z");

    const deleted = await repo.deleteExpired(cutoff);

    expect(deleted).toBe(7);
    const call = (prisma.$executeRaw as jest.Mock).mock.calls[0];
    const sqlText = (call[0] as string[]).join("");
    expect(sqlText).toContain("DELETE FROM rate_limit_counters");
    expect(sqlText).toContain('"windowEnd" <');
    expect(call.slice(1)).toEqual([cutoff]);
  });
});
