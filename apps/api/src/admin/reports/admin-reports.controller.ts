import { Controller, Get, UseGuards } from "@nestjs/common";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { RateLimit, RateLimitGuard } from "../../common/rate-limit.guard";
import { RATE_LIMITS } from "../../common/rate-limit.config";
import { AdminReportsService } from "./admin-reports.service";

@Controller("admin/reports")
@UseGuards(RolesGuard, RateLimitGuard)
@RateLimit(RATE_LIMITS.admin.limit, RATE_LIMITS.admin.windowSeconds, { bucket: "admin" })
@Roles("curator", "admin")
export class AdminReportsController {
  constructor(private reports: AdminReportsService) {}

  @Get("data-quality")
  dataQuality() {
    return this.reports.dataQuality();
  }
}
