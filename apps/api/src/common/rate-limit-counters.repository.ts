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
}
