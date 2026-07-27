import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AdminExportQuerySchema } from "@gurmego/shared";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AdminReportsService } from "./reports/admin-reports.service";

@Controller("admin/export")
@UseGuards(RolesGuard)
@Roles("curator", "admin")
export class AdminExportController {
  constructor(private reports: AdminReportsService) {}

  @Get()
  export(@Query(new ZodValidationPipe(AdminExportQuerySchema)) query: ReturnType<(typeof AdminExportQuerySchema)["parse"]>) {
    return this.reports.exportVenues(query.format);
  }
}
