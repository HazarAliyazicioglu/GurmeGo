import { Module } from "@nestjs/common";
import { AdminExportController } from "../admin-export.controller";
import { AdminReportsController } from "./admin-reports.controller";
import { AdminReportsService } from "./admin-reports.service";

@Module({
  controllers: [AdminReportsController, AdminExportController],
  providers: [AdminReportsService],
  exports: [AdminReportsService],
})
export class AdminReportsModule {}
