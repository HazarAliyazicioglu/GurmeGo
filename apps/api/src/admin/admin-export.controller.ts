import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AdminReportsService } from "./reports/admin-reports.service";

@Controller("admin/export")
@UseGuards(RolesGuard)
@Roles("curator", "admin")
export class AdminExportController {
  constructor(private reports: AdminReportsService) {}

  @Get()
  export(@Query("format") format: "json" | "csv" = "json") {
    return this.reports.exportVenues(format);
  }
}
