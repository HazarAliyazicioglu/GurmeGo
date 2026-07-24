import { Module } from "@nestjs/common";
import { AdminQueueModule } from "./queue/admin-queue.module";
import { AdminVenuesModule } from "./venues/admin-venues.module";
import { AdminReportsModule } from "./reports/admin-reports.module";
import { AdminUsersModule } from "./users/admin-users.module";

@Module({ imports: [AdminQueueModule, AdminVenuesModule, AdminReportsModule, AdminUsersModule] })
export class AdminModule {}
