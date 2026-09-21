import { Module } from "@nestjs/common";
import { CACHE_STORE } from "./cache-store.interface";
import { PostgresCacheStoreService } from "./postgres-cache-store.service";
import { RateLimitCountersRepository } from "./rate-limit-counters.repository";

// Provides the CACHE_STORE that RateLimitGuard needs, so a feature module just imports this instead of
// re-declaring the same repository + provider pair (the public modules each still do; the admin modules
// use this).
@Module({
  providers: [RateLimitCountersRepository, { provide: CACHE_STORE, useClass: PostgresCacheStoreService }],
  exports: [CACHE_STORE],
})
export class RateLimitModule {}
