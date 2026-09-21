import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AdminExportQuerySchema } from "@gurmego/shared";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { RateLimit, RateLimitGuard } from "../common/rate-limit.guard";
import { RATE_LIMITS } from "../common/rate-limit.config";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AdminReportsService } from "./reports/admin-reports.service";

@Controller("admin/export")
@UseGuards(RolesGuard, RateLimitGuard)
@RateLimit(RATE_LIMITS.admin.limit, RATE_LIMITS.admin.windowSeconds, { bucket: "admin" })
@Roles("curator", "admin")
export class AdminExportController {
  constructor(private reports: AdminReportsService) {}

  @Get()
  export(@Query(new ZodValidationPipe(AdminExportQuerySchema)) query: ReturnType<(typeof AdminExportQuerySchema)["parse"]>) {
    return this.reports.exportVenues(query.format);
  }
}
