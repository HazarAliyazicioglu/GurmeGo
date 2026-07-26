import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { BboxQuerySchema, VenueListQuerySchema } from "@gurmego/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { RateLimit, RateLimitGuard } from "../common/rate-limit.guard";
import { UserLocation, UserLocationParam } from "../common/user-location.decorator";
import { VenuesService } from "./venues.service";

@Controller("venues")
@UseGuards(RateLimitGuard)
export class VenuesController {
  constructor(private venues: VenuesService) {}

  @Get("map")
  @RateLimit(100, 60)
  mapView(@Query(new ZodValidationPipe(BboxQuerySchema)) query: { bbox: [number, number, number, number] }) {
    return this.venues.mapView(query.bbox);
  }

  @Get()
  @RateLimit(100, 60)
  list(
    @Query(new ZodValidationPipe(VenueListQuerySchema)) query: ReturnType<(typeof VenueListQuerySchema)["parse"]>,
    @UserLocationParam() location?: UserLocation,
  ) {
    return this.venues.list(query, location);
  }

  @Get(":slug")
  @RateLimit(100, 60)
  detail(@Param("slug") slug: string) {
    return this.venues.detail(slug);
  }
}
