import { RateLimitCleanupService } from "./rate-limit-cleanup.service";
import { RateLimitCountersRepository } from "./rate-limit-counters.repository";
import { RATE_LIMIT_CLEANUP_RETENTION_MINUTES } from "./rate-limit.config";

describe("RateLimitCleanupService.cleanupExpired", () => {
  it("deletes rows whose window expired more than the retention buffer ago", async () => {
    const repository = { deleteExpired: jest.fn().mockResolvedValue(3) } as unknown as RateLimitCountersRepository;
    const service = new RateLimitCleanupService(repository);
    const before = Date.now();

    const deleted = await service.cleanupExpired();

    expect(deleted).toBe(3);
    expect(repository.deleteExpired).toHaveBeenCalledTimes(1);
    const cutoff = (repository.deleteExpired as jest.Mock).mock.calls[0][0] as Date;
    // cutoff must be roughly "now minus the retention buffer", not "now" itself (which would delete
    // rows still inside their grace period) and not some other arbitrary offset.
    const expectedCutoff = before - RATE_LIMIT_CLEANUP_RETENTION_MINUTES * 60 * 1000;
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedCutoff - 1000);
    expect(cutoff.getTime()).toBeLessThanOrEqual(expectedCutoff + 1000);
  });

  it("handleCron delegates to cleanupExpired", async () => {
    const repository = { deleteExpired: jest.fn().mockResolvedValue(0) } as unknown as RateLimitCountersRepository;
    const service = new RateLimitCleanupService(repository);

    await service.handleCron();

    expect(repository.deleteExpired).toHaveBeenCalledTimes(1);
  });
});
