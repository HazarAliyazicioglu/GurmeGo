import { Module, Controller, Get } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { PrismaModule } from "./prisma/prisma.module";
import { AuditModule } from "./audit/audit.module";
import { DistrictsModule } from "./districts/districts.module";
import { VenuesModule } from "./venues/venues.module";
import { AuthModule } from "./auth/auth.module";
import { FavoritesModule } from "./favorites/favorites.module";
import { ReportsModule } from "./reports/reports.module";
import { VenueSuggestionsModule } from "./venue-suggestions/venue-suggestions.module";
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
        redact: {
          censor: "[redacted]",
          paths: [
            // NFR-04: user coordinates never reach a log. The one place they travel is the
            // `x-user-location` request header (common/user-location.decorator.ts) -- pino-http's
            // access logs would otherwise capture it verbatim on every geo-aware request.
            'req.headers["x-user-location"]',
            // Cross-model review finding (2026-09-23): pino-http's default `req` serializer logs
            // EVERY request header, which includes the real Supabase JWT every authenticated
            // request carries (jwt-auth.guard.ts) -- without this, every access log line for a
            // signed-in user/curator/admin request would write a live, replayable session token
            // to disk in plaintext.
            'req.headers.authorization',
          ],
        },
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
    VenueSuggestionsModule,
    RuleEngineModule,
    AdminModule,
    CommonModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
