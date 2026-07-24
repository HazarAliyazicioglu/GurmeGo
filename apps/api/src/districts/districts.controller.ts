import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { RateLimit, RateLimitGuard } from "../common/rate-limit.guard";
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
  findNearest(@Query("lat") lat: string, @Query("lng") lng: string) {
    return this.districts.findNearest(parseFloat(lat), parseFloat(lng));
  }
}
