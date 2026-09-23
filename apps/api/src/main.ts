import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import fastifyMultipart from "@fastify/multipart";
import fastifyHelmet from "@fastify/helmet";
import fastifyCompress from "@fastify/compress";
import fastifyCors from "@fastify/cors";
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
// Fastify 5.12 (bumped alongside NestJS 12) made a bare numeric `trustProxy` fail CLOSED at
// runtime -- "hop-count-only trust cannot validate the immediate peer", so it now just returns
// `false` for every address instead of trusting anything (verified against fastify's own
// lib/request.js). Passing a number would silently stop working the moment TRUST_PROXY_HOPS is
// ever set for real (Plan 4's load balancer), defeating RateLimitGuard's IP-based bucketing
// without any error. Replicate the exact old semantics ourselves as an explicit trust function:
// `@fastify/proxy-addr` calls it once per forwarded address, walking outward from the direct
// socket peer (hop 0); returning `true` marks that hop as a trusted proxy to skip over, so
// trusting exactly N hops means hop indices `[0, N)`.
export function resolveTrustProxy(raw: string | undefined): boolean | ((address: string, hop: number) => boolean) {
  if (raw === undefined || raw === "") return false;
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0) {
    throw new Error(`TRUST_PROXY_HOPS must be a non-negative integer if set, got: "${raw}"`);
  }
  if (hops === 0) return false;
  return (_address, hop) => hop < hops;
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
  return new FastifyAdapter({
    trustProxy: resolveTrustProxy(process.env.TRUST_PROXY_HOPS),
    // NestJS 12 added its own automatic `@fastify/multipart` registration (triggered whenever
    // `app.register(fastifyMultipart, ...)` -- our own call, below -- or a multipart interceptor
    // decorator is used), which loads the plugin itself via a dynamic `import()`. This app already
    // registers the plugin explicitly with its own options (the 10 MB CSV upload cap), so `false`
    // here keeps that manual registration in full control instead of NestJS's own auto-detection.
    multipart: false,
  });
}

// JSON smaller than this is not worth the CPU of compressing it.
const COMPRESSION_THRESHOLD_BYTES = 1024;

export async function configureApp(app: NestFastifyApplication): Promise<void> {
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
  // CSV import (`POST /admin/import`) is the only multipart consumer -- a curator-uploaded venue
  // list, not a general file-upload feature. Without a limit, `req.file()`/`toBuffer()` buffers an
  // arbitrarily large upload entirely in memory before any Zod validation runs. 10 MB comfortably
  // covers this MVP's CSV use case (tens of thousands of rows) with headroom.
  await app.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  // Baseline security headers (nosniff, frame-ancestors, HSTS, referrer-policy, ...). CSP only in
  // production: Swagger UI (dev-only) needs inline scripts. CORP is `cross-origin` on purpose -- the web
  // and admin apps live on other origins and read this JSON via CORS; helmet's default `same-origin`
  // would be wrong for an API.
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: process.env.NODE_ENV === "production",
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
  await app.register(fastifyCompress, { threshold: COMPRESSION_THRESHOLD_BYTES });
  app.setGlobalPrefix("v1", { exclude: ["health"] });

  if (process.env.NODE_ENV === "production" && (!process.env.RATE_LIMIT_READ_PER_MINUTE || !process.env.RATE_LIMIT_REPORT_PER_DAY)) {
    console.warn("RATE_LIMIT_* env vars not set in production -- using defaults (100/min, 10/day)");
  }

  // Not `app.enableCors(...)`: NestJS 12's FastifyAdapter now implements it as
  // `this.register(import('@fastify/cors'), options)` -- an unconditional dynamic import, with no
  // synchronous-registration opt-out (unlike multipart's `multipart: false` above). Registering
  // the same plugin directly, the same way every other plugin on this page is registered, avoids
  // depending on that dynamic import ever succeeding (and is what let this function's own e2e
  // test -- which boots the real app -- run under Jest's CJS runtime, which can't execute a real
  // dynamic `import()` without `--experimental-vm-modules`).
  await app.register(fastifyCors, buildCorsOptions(process.env.CORS_ORIGIN));

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
