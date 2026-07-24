import { Module, Controller, Get } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { DistrictsModule } from "./districts/districts.module";
import { VenuesModule } from "./venues/venues.module";
import { AuthModule } from "./auth/auth.module";
import { FavoritesModule } from "./favorites/favorites.module";
import { ReportsModule } from "./reports/reports.module";

@Controller("health")
class HealthController {
  @Get()
  check() {
    return { status: "ok" };
  }
}

@Module({
  imports: [PrismaModule, DistrictsModule, VenuesModule, AuthModule, FavoritesModule, ReportsModule],
  controllers: [HealthController],
})
export class AppModule {}
