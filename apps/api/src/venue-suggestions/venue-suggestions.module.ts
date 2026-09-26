import { Module } from "@nestjs/common";
import { VenueSuggestionsController } from "./venue-suggestions.controller";
import { VenueSuggestionsService } from "./venue-suggestions.service";
import { PostgresCacheStoreService } from "../common/postgres-cache-store.service";
import { RateLimitCountersRepository } from "../common/rate-limit-counters.repository";
import { CACHE_STORE } from "../common/cache-store.interface";

@Module({
  controllers: [VenueSuggestionsController],
  providers: [
    VenueSuggestionsService,
    RateLimitCountersRepository,
    { provide: CACHE_STORE, useClass: PostgresCacheStoreService },
  ],
})
export class VenueSuggestionsModule {}
