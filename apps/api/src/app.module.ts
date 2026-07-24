import { Module, Controller, Get } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { DistrictsModule } from "./districts/districts.module";
import { VenuesModule } from "./venues/venues.module";
import { AuthModule } from "./auth/auth.module";
import { FavoritesModule } from "./favorites/favorites.module";

@Controller("health")
class HealthController {
  @Get()
  check() {
    return { status: "ok" };
  }
}

@Module({
  imports: [PrismaModule, DistrictsModule, VenuesModule, AuthModule, FavoritesModule],
  controllers: [HealthController],
})
export class AppModule {}
