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

  it("issues an INSERT ... ON CONFLICT upsert against rate_limit_counters", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ count: 4 }]) } as unknown as PrismaService;
    const repo = new RateLimitCountersRepository(prisma);
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 60_000);

    const count = await repo.increment("read:5.6.7.8", now, windowEnd);

    expect(count).toBe(4);
    const sqlText = (prisma.$queryRaw as jest.Mock).mock.calls[0][0].join("");
    expect(sqlText).toContain("rate_limit_counters");
    expect(sqlText).toContain("ON CONFLICT (key) DO UPDATE SET");
    expect(sqlText).toContain("RETURNING count");
  });
});
