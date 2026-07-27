import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { PostgresCacheStoreService } from "../common/postgres-cache-store.service";
import { RateLimitCountersRepository } from "../common/rate-limit-counters.repository";
import { CACHE_STORE } from "../common/cache-store.interface";

@Module({
  controllers: [ReportsController],
  providers: [
    ReportsService,
    RateLimitCountersRepository,
    { provide: CACHE_STORE, useClass: PostgresCacheStoreService },
  ],
})
export class ReportsModule {}
