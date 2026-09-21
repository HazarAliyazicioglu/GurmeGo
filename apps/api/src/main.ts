import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import fastifyMultipart from "@fastify/multipart";
import { writeFileSync } from "fs";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";

// Fastify's `req.ip` is the raw socket address unless `trustProxy` is configured -- behind ANY
// reverse proxy (which this app will run behind in every real deployment), that raw address is
// the proxy's own IP, not the real client's, so every request looks like it comes from the same
// IP and `RateLimitGuard` (which keys its bucket on `req.ip`) puts every user in one shared
// bucket -- one heavy user can lock out everyone else.
//
// `TRUST_PROXY_HOPS` (an env var, not a hardcoded count) controls this: unset/0 means "don't
// trust any proxy" (correct for local dev, where there is no proxy in front of the app -- trusting
// one here would let a client forge its own `X-Forwarded-For` and pick any rate-limit bucket it
// wants), and once real infrastructure exists (Plan 4), it's set to the actual number of trusted
// reverse-proxy hops in front of this process (e.g. 1 for a single load balancer) without needing
// a code change or a guess at what that infrastructure will look like today.
export function resolveTrustProxy(raw: string | undefined): number | boolean {
  if (raw === undefined || raw === "") return false;
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0) {
    throw new Error(`TRUST_PROXY_HOPS must be a non-negative integer if set, got: "${raw}"`);
  }
  return hops === 0 ? false : hops;
}

// Browser clients (Plan 2's Next.js web/PWA app, Plan 3's admin panel) need CORS to call this API
// cross-origin. No production origin exists yet -- Plan 4 (infra) will set the real value via
// CORS_ORIGIN. Never use origin:true/"*" here: this API carries authenticated (credentialed) requests.
//
// `methods` is spelled out on purpose: @fastify/cors 10+ (Fastify 5) narrowed its default to
// GET,HEAD,POST, which would make browsers reject this API's PUT (admin role assignment) and
// DELETE (favorites) calls at preflight.
export function buildCorsOptions(raw: string | undefined) {
  const origin = (raw ?? "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return { origin, credentials: true, methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] };
}

// The one place the production HTTP stack is assembled. `bootstrap()` uses it, and so does the
// real-setup e2e (test/bootstrap.e2e-spec.ts) -- otherwise the tests would build their own
// different app and never prove this wiring.
export function createAdapter(): FastifyAdapter {
  return new FastifyAdapter({ trustProxy: resolveTrustProxy(process.env.TRUST_PROXY_HOPS) });
}

export async function configureApp(app: NestFastifyApplication): Promise<void> {
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
  // CSV import (`POST /admin/import`) is the only multipart consumer -- a curator-uploaded venue
  // list, not a general file-upload feature. Without a limit, `req.file()`/`toBuffer()` buffers an
  // arbitrarily large upload entirely in memory before any Zod validation runs. 10 MB comfortably
  // covers this MVP's CSV use case (tens of thousands of rows) with headroom.
  await app.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  app.setGlobalPrefix("v1", { exclude: ["health"] });

  if (process.env.NODE_ENV === "production" && (!process.env.RATE_LIMIT_READ_PER_MINUTE || !process.env.RATE_LIMIT_REPORT_PER_DAY)) {
    console.warn("RATE_LIMIT_* env vars not set in production -- using defaults (100/min, 10/day)");
  }

  app.enableCors(buildCorsOptions(process.env.CORS_ORIGIN));

  setupSwagger(app);
}

export async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, createAdapter());
  await configureApp(app);
  await app.listen(process.env.PORT ?? 3000, "0.0.0.0");
}

export function setupSwagger(app: NestFastifyApplication) {
  const config = new DocumentBuilder().setTitle("GurmeGo API").setVersion("1.0").build();
  const document = SwaggerModule.createDocument(app, config);
  if (process.env.EXPORT_OPENAPI) {
    writeFileSync("openapi.json", JSON.stringify(document));
    process.exit(0);
  }
  // Swagger docs are a reconnaissance surface (routes, DTOs, auth schemes) -- never expose them
  // in production (B15).
  if (process.env.NODE_ENV !== "production") {
    SwaggerModule.setup("docs", app, document);
  }
}

if (require.main === module) {
  bootstrap();
}
