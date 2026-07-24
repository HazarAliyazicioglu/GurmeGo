import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { PostgresCacheStoreService } from "../common/postgres-cache-store.service";
import { CACHE_STORE } from "../common/cache-store.interface";

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, { provide: CACHE_STORE, useClass: PostgresCacheStoreService }],
})
export class ReportsModule {}
