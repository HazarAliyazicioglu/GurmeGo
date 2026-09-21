import { Module } from "@nestjs/common";
import { AdminQueueController } from "./admin-queue.controller";
import { AdminQueueService } from "./admin-queue.service";
import { VenuesModule } from "../../venues/venues.module";
import { RateLimitModule } from "../../common/rate-limit.module";

@Module({ imports: [VenuesModule, RateLimitModule], controllers: [AdminQueueController], providers: [AdminQueueService] })
export class AdminQueueModule {}
