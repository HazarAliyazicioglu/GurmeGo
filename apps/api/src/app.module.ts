import { Module, Controller, Get } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { DistrictsModule } from "./districts/districts.module";
import { VenuesModule } from "./venues/venues.module";
import { AuthModule } from "./auth/auth.module";
import { FavoritesModule } from "./favorites/favorites.module";
import { ReportsModule } from "./reports/reports.module";
import { RuleEngineModule } from "./rule-engine/rule-engine.module";
import { AdminModule } from "./admin/admin.module";
import { CommonModule } from "./common/common.module";

@Controller("health")
class HealthController {
  @Get()
  check() {
    return { status: "ok" };
  }
}

@Module({
  imports: [
    PrismaModule,
    DistrictsModule,
    VenuesModule,
    AuthModule,
    FavoritesModule,
    ReportsModule,
    RuleEngineModule,
    AdminModule,
    CommonModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
