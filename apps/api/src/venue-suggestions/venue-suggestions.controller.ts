import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { SuggestVenue, SuggestVenueSchema } from "@gurmego/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { RateLimit, RateLimitGuard } from "../common/rate-limit.guard";
import { RATE_LIMITS } from "../common/rate-limit.config";
import { VenueSuggestionsService } from "./venue-suggestions.service";

@Controller("venue-suggestions")
export class VenueSuggestionsController {
  constructor(private suggestions: VenueSuggestionsService) {}

  @Post()
  @UseGuards(RateLimitGuard)
  // Same daily budget as reports.controller.ts's own free-text submission endpoint -- both are
  // anonymous, low-frequency, human-authored contributions, not a bulk write path.
  @RateLimit(RATE_LIMITS.report.limit, RATE_LIMITS.report.windowSeconds)
  submit(@Body(new ZodValidationPipe(SuggestVenueSchema)) body: SuggestVenue) {
    return this.suggestions.submit(body);
  }
}
