import { PostgresCacheStoreService } from "./postgres-cache-store.service";
import { RateLimitCountersRepository } from "./rate-limit-counters.repository";

describe("PostgresCacheStoreService.increment", () => {
  it("creates a new counter window and returns 1 on first call", async () => {
    const repository = {
      increment: jest.fn().mockResolvedValue(1),
    } as unknown as RateLimitCountersRepository;
    const store = new PostgresCacheStoreService(repository);

    const count = await store.increment("report:1.2.3.4", 86400);

    expect(count).toBe(1);
    expect(repository.increment).toHaveBeenCalledWith(
      "report:1.2.3.4",
      expect.any(Date),
      expect.any(Date),
    );
  });

  it("computes windowEnd as now + windowSeconds and delegates the raw SQL to the repository", async () => {
    const repository = {
      increment: jest.fn().mockResolvedValue(3),
    } as unknown as RateLimitCountersRepository;
    const store = new PostgresCacheStoreService(repository);

    const before = Date.now();
    const count = await store.increment("read:5.6.7.8", 60);
    const after = Date.now();

    expect(count).toBe(3);
    const [, now, windowEnd] = (repository.increment as jest.Mock).mock.calls[0];
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
    expect(windowEnd.getTime() - now.getTime()).toBe(60 * 1000);
  });
});
