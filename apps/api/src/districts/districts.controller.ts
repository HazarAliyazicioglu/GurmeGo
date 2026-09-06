import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { RateLimit, RateLimitGuard } from "../common/rate-limit.guard";
import { UserLocation, UserLocationParam } from "../common/user-location.decorator";
import { RATE_LIMITS } from "../common/rate-limit.config";
import { DistrictsService } from "./districts.service";

@Controller("districts")
@UseGuards(RateLimitGuard)
export class DistrictsController {
  constructor(private districts: DistrictsService) {}

  @Get()
  @RateLimit(RATE_LIMITS.read.limit, RATE_LIMITS.read.windowSeconds)
  findAll(@Query("city") city = "istanbul") {
    return this.districts.findAll(city);
  }

  @Get("nearest")
  @RateLimit(RATE_LIMITS.read.limit, RATE_LIMITS.read.windowSeconds)
  findNearest(@UserLocationParam() location?: UserLocation) {
    if (!location) throw new BadRequestException({ error: { code: "LOCATION_REQUIRED", message: "Konum bilgisi gerekli" } });
    return this.districts.findNearest(location.lat, location.lng);
  }
}
