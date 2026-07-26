import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { RateLimit, RateLimitGuard } from "../common/rate-limit.guard";
import { UserLocation, UserLocationParam } from "../common/user-location.decorator";
import { DistrictsService } from "./districts.service";

@Controller("districts")
@UseGuards(RateLimitGuard)
export class DistrictsController {
  constructor(private districts: DistrictsService) {}

  @Get()
  @RateLimit(100, 60)
  findAll(@Query("city") city = "istanbul") {
    return this.districts.findAll(city);
  }

  @Get("nearest")
  @RateLimit(100, 60)
  findNearest(@UserLocationParam() location?: UserLocation) {
    if (!location) throw new BadRequestException({ error: { code: "LOCATION_REQUIRED", message: "Konum bilgisi gerekli" } });
    return this.districts.findNearest(location.lat, location.lng);
  }
}
