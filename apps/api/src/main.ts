import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import fastifyMultipart from "@fastify/multipart";
import { writeFileSync } from "fs";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  // CSV import (`POST /admin/import`) is the only multipart consumer — a curator-uploaded venue
  // list, not a general file-upload feature. Without a limit, `req.file()`/`toBuffer()` buffers an
  // arbitrarily large upload entirely in memory before any Zod validation runs. 10 MB comfortably
  // covers this MVP's CSV use case (tens of thousands of rows) with headroom.
  await app.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  app.setGlobalPrefix("v1", { exclude: ["health"] });

  if (process.env.NODE_ENV === "production" && (!process.env.RATE_LIMIT_READ_PER_MINUTE || !process.env.RATE_LIMIT_REPORT_PER_DAY)) {
    console.warn("RATE_LIMIT_* env vars not set in production -- using defaults (100/min, 10/day)");
  }

  // Browser clients (Plan 2's Next.js web/PWA app, Plan 3's admin panel) need CORS to call this API
  // cross-origin. No production origin exists yet — Plan 4 (infra) will set the real value via
  // CORS_ORIGIN. Never use origin:true/"*" here: this API carries authenticated (credentialed) requests.
  const corsOrigins = (
    process.env.CORS_ORIGIN ??
    "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });

  const config = new DocumentBuilder().setTitle("GurmeGo API").setVersion("1.0").build();
  const document = SwaggerModule.createDocument(app, config);
  if (process.env.EXPORT_OPENAPI) {
    writeFileSync("openapi.json", JSON.stringify(document));
    process.exit(0);
  }
  SwaggerModule.setup("docs", app, document);

  await app.listen(process.env.PORT ?? 3000, "0.0.0.0");
}
bootstrap();
