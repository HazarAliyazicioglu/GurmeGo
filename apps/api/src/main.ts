import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import fastifyMultipart from "@fastify/multipart";
import { writeFileSync } from "fs";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.register(fastifyMultipart);
  app.setGlobalPrefix("v1", { exclude: ["health"] });

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
