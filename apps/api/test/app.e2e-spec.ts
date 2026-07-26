import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { HttpAdapterHost } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/all-exceptions.filter";
import { PrismaService } from "../src/prisma/prisma.service";

describe("AppModule (e2e)", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns ok (excluded from /v1 prefix)", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
  });

  it("GET /venues — header doesn't get corrupted by the query pipe (no setGlobalPrefix in this test app, unlike production main.ts)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/venues?limit=5",
      headers: { "x-user-location": "40.99,29.02" },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("UUID path-param validation — wired at the route level", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // POST /venues/:id/report requires no auth (ReportsController has no RolesGuard, only
  // RateLimitGuard), so it exercises ParseUUIDPipe's route-level wiring through the full
  // AppModule without needing a real Supabase JWT -- app.e2e-spec.ts has no JWT/curator-token
  // setup for admin routes (those are only stubbed per-controller in the individual
  // *.controller.spec.ts files via an x-test-role header, not through the full AppModule here).
  it("POST /venues/not-a-uuid/report returns 400, not a PostGIS/Prisma error", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/venues/not-a-uuid/report",
      payload: { reason: "Fiyat yanlış görünüyor" },
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("AllExceptionsFilter wired globally (as bootstrap() does) — Retry-After survives", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    // Register the filter exactly the way main.ts's bootstrap() does. The standalone unit test in
    // all-exceptions.filter.spec.ts never exercises this wiring, and reports.controller.spec.ts's
    // Retry-After test builds its own bare testing module (ReportsController only) that never
    // registers this filter either -- neither proves the filter is harmless once it actually sits
    // in front of Nest's global exception pipeline in the real app.
    app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /venues/:id/report still returns 429 with Retry-After once rate-limited", async () => {
    const venueId = "d290f1ee-6c54-4b01-90e6-d701748f0851";
    const requestPayload = {
      method: "POST" as const,
      url: `/venues/${venueId}/report`,
      payload: { reason: "Fiyat yanlış görünüyor" },
      headers: { "content-type": "application/json" },
    };

    // NOTE: an `x-forwarded-for` header here would NOT isolate this test's counter -- Fastify's
    // `req.ip` is always the real (truthy) socket address unless `trustProxy` is configured on the
    // adapter (it isn't, anywhere in this codebase; see docs/STATE.md: "RateLimitGuard trustProxy
    // yok"), so `RateLimitGuard`'s `req.ip ?? req.headers["x-forwarded-for"] ?? "unknown"` never
    // falls through to the header -- it always resolves to the same socket IP. That means this
    // test's rate-limit key (`ReportsController:report:<ip>`) is shared with every other test that
    // hits this handler through a real (Postgres-backed) CacheStore, including the `not-a-uuid`
    // test above and any prior run of this same test in earlier CI executions. Isolation is
    // achieved instead by deleting that exact counter row from `rate_limit_counters` right before
    // firing the 11 requests, so the counter always starts fresh regardless of what other tests or
    // prior runs left behind.
    const prisma = app.get(PrismaService);
    await prisma.$executeRaw`DELETE FROM rate_limit_counters WHERE key LIKE 'ReportsController:report:%'`;

    // RATE_LIMIT_REPORT_PER_DAY defaults to 10 (see src/common/rate-limit.config.ts) -- the 11th
    // request must exceed it, now that the counter has been reset to a known-empty state.
    let lastRes;
    for (let i = 0; i < 11; i++) {
      lastRes = await app.inject(requestPayload);
    }

    expect(lastRes!.statusCode).toBe(429);
    expect(lastRes!.headers["retry-after"]).toBe("86400");
    expect(lastRes!.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
  });
});
