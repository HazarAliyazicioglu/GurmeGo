import { Module } from "@nestjs/common";
import { DistrictsController } from "./districts.controller";
import { DistrictsService } from "./districts.service";
import { DistrictsRepository } from "./districts.repository";
import { PostgresCacheStoreService } from "../common/postgres-cache-store.service";
import { CACHE_STORE } from "../common/cache-store.interface";

@Module({
  controllers: [DistrictsController],
  providers: [
    DistrictsService,
    DistrictsRepository,
    { provide: CACHE_STORE, useClass: PostgresCacheStoreService },
  ],
  exports: [DistrictsService],
})
export class DistrictsModule {}
