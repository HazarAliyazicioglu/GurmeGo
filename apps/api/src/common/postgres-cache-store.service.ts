import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CacheStore } from "./cache-store.interface";

@Injectable()
export class PostgresCacheStoreService implements CacheStore {
  constructor(private prisma: PrismaService) {}

  async increment(key: string, windowSeconds: number): Promise<number> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + windowSeconds * 1000);
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
