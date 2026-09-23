import { SwaggerModule } from "@nestjs/swagger";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { Controller, Get } from "@nestjs/common";
import cors from "@fastify/cors";
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
  it("returns a function trusting exactly N hops for a positive integer (fastify 5.12+ fails a bare number closed)", () => {
    const trustOne = resolveTrustProxy("1");
    expect(typeof trustOne).toBe("function");
    if (typeof trustOne !== "function") throw new Error("expected a function");
    expect(trustOne("1.2.3.4", 0)).toBe(true); // the single trusted hop (e.g. the load balancer)
    expect(trustOne("5.6.7.8", 1)).toBe(false); // one hop further back -- not trusted

    const trustTwo = resolveTrustProxy("2");
    if (typeof trustTwo !== "function") throw new Error("expected a function");
    expect(trustTwo("1.2.3.4", 0)).toBe(true);
    expect(trustTwo("5.6.7.8", 1)).toBe(true);
    expect(trustTwo("9.10.11.12", 2)).toBe(false);
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
    // Not `app.enableCors(...)`: NestJS 12's FastifyAdapter now implements it as
    // `this.register(import('@fastify/cors'), options)` -- an unconditional dynamic import, with
    // no synchronous-registration escape hatch (unlike multipart's `multipart: false`). Jest 29's
    // CJS runtime can't execute a real dynamic `import()` without `--experimental-vm-modules`,
    // which conflicts with this project's babel-CJS-transform approach for NestJS 12's other ESM
    // packages (tried, made things worse). Registering the same real `@fastify/cors` plugin
    // directly (synchronous CJS import, top of file) with the exact same options exercises
    // identical real HTTP behavior without going through that wrapper. Production is unaffected --
    // verified empirically: the compiled app's real `enableCors()` call boots and serves traffic.
    await app.register(cors, buildCorsOptions(corsOrigin));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const res = await app.inject({
      method: "OPTIONS",
      url: "/ping",
      headers: {
        origin,
        "access-control-request-method": method,
        "access-control-request-headers": "authorization,content-type",
      },
    });
    await app.close();
    return res;
  }

  it.each(["GET", "POST", "PUT", "DELETE"])("allows a %s preflight from a configured origin", async (method) => {
    const res = await preflight("http://localhost:3002", method, "http://localhost:3002");
    // Browsers require a 2xx preflight response; CORS headers on a failing status still block the call.
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(300);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3002");
    // Authenticated calls send Authorization + a JSON Content-Type -- both must be permitted.
    expect(String(res.headers["access-control-allow-headers"]).toLowerCase()).toEqual(
      expect.stringContaining("authorization"),
    );
    expect(String(res.headers["access-control-allow-headers"]).toLowerCase()).toEqual(
      expect.stringContaining("content-type"),
    );
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
