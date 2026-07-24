import { Controller, Get, Param, Query, UseGuards, UsePipes } from "@nestjs/common";
import { VenueListQuerySchema } from "@gurmego/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { RateLimit, RateLimitGuard } from "../common/rate-limit.guard";
import { VenuesService } from "./venues.service";

@Controller("venues")
@UseGuards(RateLimitGuard)
export class VenuesController {
  constructor(private venues: VenuesService) {}

  @Get("map")
  @RateLimit(100, 60)
  mapView(@Query("bbox") bbox: string) {
    const parts = bbox.split(",").map(Number) as [number, number, number, number];
    return this.venues.mapView(parts);
  }

  @Get()
  @RateLimit(100, 60)
  @UsePipes(new ZodValidationPipe(VenueListQuerySchema))
  list(@Query() query: ReturnType<(typeof VenueListQuerySchema)["parse"]>) {
    return this.venues.list(query);
  }

  @Get(":slug")
  @RateLimit(100, 60)
  detail(@Param("slug") slug: string) {
    return this.venues.detail(slug);
  }
}
