import { Module } from "@nestjs/common";
import { AdminQueueController } from "./admin-queue.controller";
import { AdminQueueService } from "./admin-queue.service";
import { VenuesModule } from "../../venues/venues.module";

@Module({ imports: [VenuesModule], controllers: [AdminQueueController], providers: [AdminQueueService] })
export class AdminQueueModule {}
