import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { RateLimitCountersRepository } from "./rate-limit-counters.repository";
import { RATE_LIMIT_CLEANUP_RETENTION_MINUTES } from "./rate-limit.config";

// MINOR finding: `rate_limit_counters` (an `unlogged` Postgres table -- ADR: no Redis, cache/rate
// limit counters live in Postgres behind the `CacheStore` interface) never had anything deleting
// expired rows. RateLimitCountersRepository.increment()'s upsert only ever resets a row that's
// still being hit; a key that goes cold (client stops sending that IP/user, or the window simply
// rolls past and nothing re-requests it) keeps its row forever, so the table grows unbounded as
// traffic accumulates. This mirrors re-verify.service.ts's cron-based cleanup convention (same
// `@Cron` + `ScheduleModule` pattern, same "service computes the cutoff, repository holds the raw
// SQL" split per ADR 002).
@Injectable()
export class RateLimitCleanupService {
  constructor(private repository: RateLimitCountersRepository) {}

  async cleanupExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - RATE_LIMIT_CLEANUP_RETENTION_MINUTES * 60 * 1000);
    return this.repository.deleteExpired(cutoff);
  }

  @Cron(CronExpression.EVERY_HOUR, { name: "rate-limit-counters-cleanup" })
  async handleCron(): Promise<void> {
    await this.cleanupExpired();
  }
}
