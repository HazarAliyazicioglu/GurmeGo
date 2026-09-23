import { Module, Controller, Get } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { PrismaModule } from "./prisma/prisma.module";
import { AuditModule } from "./audit/audit.module";
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
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? "info",
        // NFR-04: user coordinates never reach a log. The one place they travel is the
        // `x-user-location` request header (see common/user-location.decorator.ts) -- pino-http's
        // access logs would otherwise capture it verbatim on every geo-aware request.
        redact: { paths: ['req.headers["x-user-location"]'], censor: "[redacted]" },
        // Railway (docs/infrastructure.md) expects structured JSON lines; pino-pretty is a
        // devDependency only, so requiring it outside development would crash at boot. Jest also
        // gets plain JSON, not pretty-print: pino-pretty's transport runs on a worker thread that
        // doesn't always shut down before Jest's own teardown check, which was already a source of
        // "worker process failed to exit gracefully" noise in this suite before this change.
        transport: process.env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
      },
    }),
    PrismaModule,
    AuditModule,
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
