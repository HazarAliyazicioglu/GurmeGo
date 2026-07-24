import { Module } from "@nestjs/common";
import { VenuesController } from "./venues.controller";
import { VenuesService } from "./venues.service";
import { VenuesRepository } from "./venues.repository";
import { PostgresCacheStoreService } from "../common/postgres-cache-store.service";
import { CACHE_STORE } from "../common/cache-store.interface";

@Module({
  controllers: [VenuesController],
  providers: [
    VenuesService,
    VenuesRepository,
    { provide: CACHE_STORE, useClass: PostgresCacheStoreService },
  ],
  exports: [VenuesService, VenuesRepository],
})
export class VenuesModule {}
