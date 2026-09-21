import { SwaggerModule } from "@nestjs/swagger";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { Controller, Get } from "@nestjs/common";
import { setupSwagger, resolveTrustProxy, buildCorsOptions } from "./main";

// Security/ops finding: Fastify's `req.ip` is the raw socket address unless `trustProxy` is
// configured -- behind any reverse proxy, every request would appear to come from the proxy's
// own IP, collapsing every user into one shared RateLimitGuard bucket. Local dev has no proxy in
// front of it, so the default (unset) must NOT trust one -- trusting one with no real proxy
// present would let a client forge its own `X-Forwarded-For` and pick any bucket it likes.
describe("resolveTrustProxy", () => {
  it("returns false when unset (local dev default: no proxy in front of this process)", () => {
    expect(resolveTrustProxy(undefined)).toBe(false);
  });
  it("returns false for an empty string", () => {
    expect(resolveTrustProxy("")).toBe(false);
  });
  it("returns false for explicit 0 hops", () => {
    expect(resolveTrustProxy("0")).toBe(false);
  });
  it("returns the hop count as a number for a positive integer", () => {
    expect(resolveTrustProxy("1")).toBe(1);
    expect(resolveTrustProxy("2")).toBe(2);
  });
  it("throws a clear error for a non-numeric value (fail fast on misconfiguration, not a silent NaN)", () => {
    expect(() => resolveTrustProxy("not-a-number")).toThrow(/TRUST_PROXY_HOPS/);
  });
  it("throws for a negative number", () => {
    expect(() => resolveTrustProxy("-1")).toThrow(/TRUST_PROXY_HOPS/);
  });
});

describe("setupSwagger — production guard", () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it("does not call SwaggerModule.setup when NODE_ENV=production", () => {
    process.env.NODE_ENV = "production";
    jest.spyOn(SwaggerModule, "createDocument").mockReturnValue({} as ReturnType<typeof SwaggerModule.createDocument>);
    const setupSpy = jest.spyOn(SwaggerModule, "setup").mockImplementation(() => undefined as unknown as NestFastifyApplication);
    setupSwagger({} as NestFastifyApplication);
    expect(setupSpy).not.toHaveBeenCalled();
  });

  it("calls SwaggerModule.setup when NODE_ENV is not production", () => {
    process.env.NODE_ENV = "development";
    jest.spyOn(SwaggerModule, "createDocument").mockReturnValue({} as ReturnType<typeof SwaggerModule.createDocument>);
    const setupSpy = jest.spyOn(SwaggerModule, "setup").mockImplementation(() => undefined as unknown as NestFastifyApplication);
    setupSwagger({} as NestFastifyApplication);
    expect(setupSpy).toHaveBeenCalled();
  });
});

// Fastify 5 / @fastify/cors 10+ narrowed the default preflight `methods` to GET,HEAD,POST. This API
// exposes PUT (admin role assignment) and DELETE (favorites), so without an explicit list a browser
// blocks those calls cross-origin at preflight -- and no controller-level test would notice, since
// they never issue a cross-origin OPTIONS request.
describe("buildCorsOptions", () => {
  @Controller("ping")
  class PingController {
    @Get()
    ping() {
      return "ok";
    }
  }

  async function preflight(origin: string, method: string, corsOrigin?: string) {
    const moduleRef = await Test.createTestingModule({ controllers: [PingController] }).compile();
    const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.enableCors(buildCorsOptions(corsOrigin));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const res = await app.inject({
      method: "OPTIONS",
      url: "/ping",
      headers: { origin, "access-control-request-method": method },
    });
    await app.close();
    return res;
  }

  it.each(["GET", "POST", "PUT", "DELETE"])("allows a %s preflight from a configured origin", async (method) => {
    const res = await preflight("http://localhost:3002", method, "http://localhost:3002");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3002");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    expect(String(res.headers["access-control-allow-methods"]).split(/,\s*/)).toContain(method);
  });

  it("does not grant an unlisted origin", async () => {
    const res = await preflight("http://evil.example", "DELETE", "http://localhost:3002");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("defaults to the four local dev origins when CORS_ORIGIN is unset", () => {
    expect(buildCorsOptions(undefined).origin).toEqual([
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003",
    ]);
  });
});
