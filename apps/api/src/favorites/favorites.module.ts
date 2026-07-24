import { Module } from "@nestjs/common";
import { FavoritesController } from "./favorites.controller";
import { FavoritesService } from "./favorites.service";
import { PostgresCacheStoreService } from "../common/postgres-cache-store.service";
import { CACHE_STORE } from "../common/cache-store.interface";

@Module({
  controllers: [FavoritesController],
  providers: [
    FavoritesService,
    { provide: CACHE_STORE, useClass: PostgresCacheStoreService },
  ],
})
export class FavoritesModule {}
