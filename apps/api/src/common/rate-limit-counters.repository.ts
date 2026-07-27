import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RateLimitCountersRepository {
  constructor(private prisma: PrismaService) {}

  // ADR 002: PostGIS/raw SQL lives only in the repository layer, never in a service (see
  // districts.repository.ts's findNearestDistrict for the precedent this mirrors). This upsert
  // increments a fixed-window counter atomically: if the existing row's window has already expired
  // (`"windowEnd" < now`), the counter resets to 1 with a fresh window; otherwise it increments in
  // place. Both branches happen inside a single statement so concurrent requests racing on the same
  // key can't read-then-write past each other.
  async increment(key: string, now: Date, windowEnd: Date): Promise<number> {
    const result = await this.prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO rate_limit_counters (key, count, "windowEnd")
      VALUES (${key}, 1, ${windowEnd})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limit_counters."windowEnd" < ${now} THEN 1 ELSE rate_limit_counters.count + 1 END,
        "windowEnd" = CASE WHEN rate_limit_counters."windowEnd" < ${now} THEN ${windowEnd} ELSE rate_limit_counters."windowEnd" END
      RETURNING count
    `;
    return result[0].count;
  }

  // MINOR finding: `increment()`'s upsert only ever resets/updates a row for a key that's actively
  // being hit again -- a key whose window expired and is never requested again (client stopped
  // sending that IP/user, rate limit window rolled past) stays in the unlogged table forever, so
  // it grows unbounded over time. `cutoff` (windowEnd + retention buffer, computed by the caller --
  // see RateLimitCleanupService) is passed in rather than computed here so the raw SQL stays a pure
  // "delete rows older than this instant" statement, same repository-only-raw-SQL boundary as
  // increment() above (ADR 002).
  async deleteExpired(cutoff: Date): Promise<number> {
    const result = await this.prisma.$executeRaw`
      DELETE FROM rate_limit_counters WHERE "windowEnd" < ${cutoff}
    `;
    return result;
  }
}
