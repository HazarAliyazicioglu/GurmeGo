import { Module, Controller, Get } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { DistrictsModule } from "./districts/districts.module";

@Controller("health")
class HealthController {
  @Get()
  check() {
    return { status: "ok" };
  }
}

@Module({
  imports: [PrismaModule, DistrictsModule],
  controllers: [HealthController],
})
export class AppModule {}
