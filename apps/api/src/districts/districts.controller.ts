import { Controller, Get, Query } from "@nestjs/common";
import { DistrictsService } from "./districts.service";

@Controller("districts")
export class DistrictsController {
  constructor(private districts: DistrictsService) {}

  @Get()
  findAll(@Query("city") city = "istanbul") {
    return this.districts.findAll(city);
  }

  @Get("nearest")
  findNearest(@Query("lat") lat: string, @Query("lng") lng: string) {
    return this.districts.findNearest(parseFloat(lat), parseFloat(lng));
  }
}
