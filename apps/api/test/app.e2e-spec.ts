import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { HttpAdapterHost } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/all-exceptions.filter";
import { PrismaService } from "../src/prisma/prisma.service";
import { ReportsController } from "../src/reports/reports.controller";

// Derives the exact rate-limit key prefix RateLimitGuard.canActivate builds
// (`${ClassName}:${methodName}:${ip}`, see src/common/rate-limit.guard.ts) instead of
// hardcoding the handler's method name as a string. A hardcoded "report" string previously
// drifted silently from the real handler name ("submit"), which made the DELETE below a
// no-op that never matched any row -- the test kept "passing" only by accident (whatever
// stale counter value happened to already be present from earlier runs/tests). Deriving the
// method name by scanning the controller's prototype for whoever carries the `rate-limit`
// metadata means a future rename of the handler can't cause this same silent drift again.
function findRateLimitedMethodName(ctor: new (...args: never[]) => unknown): string {
  const proto = (ctor as unknown as { prototype: Record<string, object> }).prototype;
  const methodName = Object.getOwnPropertyNames(proto).find(
    (name) => name !== "constructor" && Reflect.getMetadata("rate-limit", proto[name]),
  );
  if (!methodName) {
    throw new Error(`No rate-limited method found on ${ctor.name} -- has @RateLimit been removed?`);
  }
  return methodName;
}

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

    // NestJS runs guards before pipes (RateLimitGuard, then ParseUUIDPipe), so a saturated
    // rate-limit counter would 429 this request before ParseUUIDPipe ever gets a chance to
    // reject the malformed id -- turning this into a flaky 429-vs-400 failure unrelated to what
    // this test actually checks. This route's counter key (`ReportsController:submit:<ip>`) is
    // shared with the other suites in THIS file (via the same real Postgres-backed CacheStore
    // within a single `npx jest` run) -- reports.controller.spec.ts uses its own mocked
    // CACHE_STORE, so it isn't part of this particular sharing, but a prior suite here could
    // still have pushed the counter over. Reset it first, same pattern (and same reasoning) as
    // the Retry-After test below.
    const methodName = findRateLimitedMethodName(ReportsController);
    const prisma = app.get(PrismaService);
    await prisma.$executeRaw`DELETE FROM rate_limit_counters WHERE key LIKE ${`${ReportsController.name}:${methodName}:%`}`;
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

    // NOTE: an `x-forwarded-for` header here would NOT isolate this test's counter. This suite builds its
    // own app with a plain `new FastifyAdapter()` (no `trustProxy`), so Fastify's `req.ip` is always the
    // real socket address; and even in production, where main.ts DOES configure `trustProxy` from
    // TRUST_PROXY_HOPS, `RateLimitGuard` keys on `req.ip` only and never reads the header itself (that
    // production wiring is covered by test/bootstrap.e2e-spec.ts, which boots the app through the real
    // `createAdapter()` + `configureApp()`). That means this
    // test's rate-limit key (`ReportsController:submit:<ip>`) is shared with every other test that
    // hits this handler through a real (Postgres-backed) CacheStore, including the `not-a-uuid`
    // test above and any prior run of this same test in earlier CI executions. Isolation is
    // achieved instead by deleting that exact counter row from `rate_limit_counters` right before
    // firing the requests below, so the counter always starts fresh regardless of what other tests
    // or prior runs left behind.
    const methodName = findRateLimitedMethodName(ReportsController);
    const prisma = app.get(PrismaService);
    await prisma.$executeRaw`DELETE FROM rate_limit_counters WHERE key LIKE ${`${ReportsController.name}:${methodName}:%`}`;

    // RATE_LIMIT_REPORT_PER_DAY defaults to 10 (see src/common/rate-limit.config.ts). Now that the
    // counter is provably reset (see above), assert BOTH sides of the boundary instead of just
    // firing 11 requests and hoping the 11th lands over the limit: the first `limit` requests (10)
    // must all clear the guard (not 429), and only the very next one (the 11th, which pushes the
    // count to 11 > 10) must be the one the guard rejects. This actually exercises the reset,
    // rather than merely being consistent with a counter that coincidentally never got reset at all.
    //
    // `venueId` above is a syntactically valid but non-existent UUID, so `ReportsService.submit`
    // itself 500s on a foreign-key violation once a request clears the guard (see
    // reports.service.ts) -- that's expected and irrelevant here: RateLimitGuard.canActivate runs
    // and increments the counter *before* the handler is ever invoked, so the guard's pass/reject
    // decision is fully observable (as "not 429" vs "429") independently of what the handler does
    // with a request that got past it.
    const limit = 10;
    for (let i = 0; i < limit; i++) {
      const res = await app.inject(requestPayload);
      expect(res.statusCode).not.toBe(429);
    }

    const overLimitRes = await app.inject(requestPayload);

    expect(overLimitRes.statusCode).toBe(429);
    expect(overLimitRes.headers["retry-after"]).toBe("86400");
    expect(overLimitRes.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
  });
});
