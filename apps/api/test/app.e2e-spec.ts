import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "../src/app.module";

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
