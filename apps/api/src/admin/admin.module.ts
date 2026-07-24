import { Module } from "@nestjs/common";
import { AdminQueueModule } from "./queue/admin-queue.module";
import { AdminVenuesModule } from "./venues/admin-venues.module";

@Module({ imports: [AdminQueueModule, AdminVenuesModule] })
export class AdminModule {}
