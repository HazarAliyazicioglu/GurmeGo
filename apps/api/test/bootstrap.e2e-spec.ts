import { Test } from "@nestjs/testing";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "../src/app.module";
import { configureApp, createAdapter } from "../src/main";

// Every other spec builds its own ad-hoc app (no global prefix, no CORS, no multipart, no exception
// filter), so nothing proved that the REAL production setup in main.ts is wired correctly -- the
// audit's "tests build their own fake app" finding. These tests boot the app through the exact same
// `createAdapter()` + `configureApp()` that `bootstrap()` uses.
describe("real application setup (createAdapter + configureApp)", () => {
  let app: NestFastifyApplication;
  let seenIps: string[];
  const originalHops = process.env.TRUST_PROXY_HOPS;
  const originalNodeEnv = process.env.NODE_ENV;

  async function boot(trustProxyHops: string | undefined) {
    // Runs the real PRODUCTION configuration. It is also what keeps Swagger UI out of this test: its
    // `@fastify/static` dependency chain pulls an ESM-only module that jest 29 cannot parse (Nest
    // swallows the require error and reports "package is missing"). The dev-mode Swagger path is
    // proven by the live-boot smoke instead (scripts/smoke-api.sh + manual /docs probe).
    process.env.NODE_ENV = "production";
    if (trustProxyHops === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = trustProxyHops;
    seenIps = [];
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(createAdapter());
    await configureApp(app);
    // Must be registered before init(): Fastify refuses hooks once the instance is ready.
    app.getHttpAdapter().getInstance().addHook("onRequest", async (req) => {
      seenIps.push(req.ip);
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }

  afterEach(async () => {
    await app?.close();
    if (originalHops === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = originalHops;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("serves the API under /v1 but keeps /health outside the prefix", async () => {
    await boot(undefined);
    expect((await app.inject({ method: "GET", url: "/v1/districts" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/districts" })).statusCode).toBe(404);
  });

  it("keeps the { error: { code, message } } envelope on errors (AllExceptionsFilter is installed)", async () => {
    await boot(undefined);
    const res = await app.inject({ method: "GET", url: "/v1/this-route-does-not-exist" });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body).toHaveProperty("error.code");
    expect(body).toHaveProperty("error.message");
  });

  it("does not let a client-forged X-Forwarded-For change req.ip when no proxy is trusted", async () => {
    await boot(undefined);
    await app.inject({ method: "GET", url: "/health", remoteAddress: "10.0.0.5", headers: { "x-forwarded-for": "9.9.9.9" } });
    expect(seenIps).toEqual(["10.0.0.5"]);
  });

  it("with one trusted proxy hop, takes the proxy-appended address and ignores a client-forged leftmost entry", async () => {
    await boot("1");
    await app.inject({
      method: "GET",
      url: "/health",
      remoteAddress: "10.0.0.5",
      headers: { "x-forwarded-for": "9.9.9.9, 1.2.3.4" },
    });
    expect(seenIps).toEqual(["1.2.3.4"]);
  });
});
