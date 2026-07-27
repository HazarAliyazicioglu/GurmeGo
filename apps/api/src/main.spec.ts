import { SwaggerModule } from "@nestjs/swagger";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { setupSwagger, resolveTrustProxy } from "./main";

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
