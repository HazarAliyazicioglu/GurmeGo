import { Module } from "@nestjs/common";
import { AdminExportController } from "../admin-export.controller";
import { AdminReportsController } from "./admin-reports.controller";
import { AdminReportsService } from "./admin-reports.service";
import { RateLimitModule } from "../../common/rate-limit.module";

@Module({
  imports: [RateLimitModule],
  controllers: [AdminReportsController, AdminExportController],
  providers: [AdminReportsService],
  exports: [AdminReportsService],
})
export class AdminReportsModule {}
