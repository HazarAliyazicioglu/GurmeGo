import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DistrictsRepository } from "./districts.repository";

@Injectable()
export class DistrictsService {
  constructor(
    private prisma: PrismaService,
    private repo: DistrictsRepository,
  ) {}

  findAll(citySlug: string) {
    return this.prisma.district.findMany({ where: { city: { slug: citySlug } } });
  }

  findNearest(lat: number, lng: number) {
    return this.repo.findNearestDistrict(lat, lng);
  }
}
