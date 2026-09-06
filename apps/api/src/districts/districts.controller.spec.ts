import { BadRequestException } from "@nestjs/common";
import { DistrictsController } from "./districts.controller";
import { DistrictsService } from "./districts.service";

describe("DistrictsController.findNearest — header required", () => {
  it("throws 400 LOCATION_REQUIRED when absent", () => {
    const districtsService = { findNearest: jest.fn() } as unknown as DistrictsService;
    const controller = new DistrictsController(districtsService);
    expect(() => controller.findNearest(undefined)).toThrow(BadRequestException);
    expect(districtsService.findNearest).not.toHaveBeenCalled();
  });

  it("calls the service with the header's lat/lng when present", () => {
    const districtsService = { findNearest: jest.fn().mockReturnValue("ok") } as unknown as DistrictsService;
    new DistrictsController(districtsService).findNearest({ lat: 40.99, lng: 29.02 });
    expect(districtsService.findNearest).toHaveBeenCalledWith(40.99, 29.02);
  });
});
