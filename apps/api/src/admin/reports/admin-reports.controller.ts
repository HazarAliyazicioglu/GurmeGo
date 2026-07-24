import { Controller, Get, UseGuards } from "@nestjs/common";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { AdminReportsService } from "./admin-reports.service";

@Controller("admin/reports")
@UseGuards(RolesGuard)
@Roles("curator", "admin")
export class AdminReportsController {
  constructor(private reports: AdminReportsService) {}

  @Get("data-quality")
  dataQuality() {
    return this.reports.dataQuality();
  }
}
