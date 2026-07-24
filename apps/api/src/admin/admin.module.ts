import { Module } from "@nestjs/common";
import { AdminQueueModule } from "./queue/admin-queue.module";
import { AdminVenuesModule } from "./venues/admin-venues.module";
import { AdminReportsModule } from "./reports/admin-reports.module";

@Module({ imports: [AdminQueueModule, AdminVenuesModule, AdminReportsModule] })
export class AdminModule {}
