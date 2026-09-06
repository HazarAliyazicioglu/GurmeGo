import { Injectable } from "@nestjs/common";
import { CacheStore } from "./cache-store.interface";
import { RateLimitCountersRepository } from "./rate-limit-counters.repository";

@Injectable()
export class PostgresCacheStoreService implements CacheStore {
  constructor(private repository: RateLimitCountersRepository) {}

  // ADR 002: raw SQL must stay out of the service layer -- the actual $queryRaw upsert lives in
  // RateLimitCountersRepository. This method only computes the window boundaries and delegates.
  async increment(key: string, windowSeconds: number): Promise<number> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + windowSeconds * 1000);
    return this.repository.increment(key, now, windowEnd);
  }
}
