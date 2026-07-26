import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { CreateReport, CreateReportSchema } from "@gurmego/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { RateLimit, RateLimitGuard } from "../common/rate-limit.guard";
import { RATE_LIMITS } from "../common/rate-limit.config";
import { ReportsService } from "./reports.service";

@Controller("venues")
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Post(":id/report")
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMITS.report.limit, RATE_LIMITS.report.windowSeconds)
  submit(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) venueId: string,
    @Body(new ZodValidationPipe(CreateReportSchema)) body: CreateReport,
  ) {
    return this.reports.submit(venueId, body);
  }
}
