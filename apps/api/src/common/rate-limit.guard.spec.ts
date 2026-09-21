import "reflect-metadata";
import { ExecutionContext, HttpException } from "@nestjs/common";
import { RateLimit, RateLimitGuard } from "./rate-limit.guard";
import type { CacheStore } from "./cache-store.interface";

function harness(count = 1) {
  const store = { increment: jest.fn().mockResolvedValue(count) } as unknown as CacheStore & { increment: jest.Mock };
  const header = jest.fn();
  const guard = new RateLimitGuard(store);
  function contextFor(controller: new () => object, handlerName: string, req: Record<string, unknown>): ExecutionContext {
    const handler = (controller.prototype as Record<string, () => void>)[handlerName];
    return {
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({ header }) }),
    } as unknown as ExecutionContext;
  }
  return { store, guard, header, contextFor };
}

class PerHandlerController {
  @RateLimit(5, 60)
  list() {}
  unlimited() {}
}

@RateLimit(60, 60, { bucket: "admin" })
class AdminLikeController {
  a() {}
  b() {}
  @RateLimit(5, 3600, { bucket: "admin-import" })
  importCsv() {}
}

describe("RateLimitGuard — key", () => {
  it("keys on Class:handler:ip when no bucket is given (existing behaviour)", async () => {
    const { store, guard, contextFor } = harness();
    await guard.canActivate(contextFor(PerHandlerController, "list", { ip: "1.2.3.4", headers: {} }));
    expect(store.increment).toHaveBeenCalledWith("PerHandlerController:list:1.2.3.4", 60);
  });

  // Audit finding: an unset req.ip must never fall back to the client-controlled X-Forwarded-For
  // header -- that would let a client pick its own rate-limit bucket and bypass main.ts's trustProxy setup.
  it("never falls back to X-Forwarded-For when req.ip is absent", async () => {
    const { store, guard, contextFor } = harness();
    await guard.canActivate(contextFor(PerHandlerController, "list", { ip: undefined, headers: { "x-forwarded-for": "6.6.6.6" } }));
    expect(store.increment).toHaveBeenCalledWith("PerHandlerController:list:unknown", 60);
  });

  it("lets a handler with no @RateLimit through without touching the store", async () => {
    const { store, guard, contextFor } = harness();
    await expect(guard.canActivate(contextFor(PerHandlerController, "unlimited", { ip: "1.2.3.4", headers: {} }))).resolves.toBe(true);
    expect(store.increment).not.toHaveBeenCalled();
  });
});

describe("RateLimitGuard — shared bucket via class-level @RateLimit", () => {
  it("applies a class-level limit to handlers that declare none, under one shared bucket key", async () => {
    const { store, guard, contextFor } = harness();
    await guard.canActivate(contextFor(AdminLikeController, "a", { ip: "1.2.3.4", headers: {} }));
    await guard.canActivate(contextFor(AdminLikeController, "b", { ip: "1.2.3.4", headers: {} }));
    expect(store.increment).toHaveBeenNthCalledWith(1, "admin:1.2.3.4", 60);
    expect(store.increment).toHaveBeenNthCalledWith(2, "admin:1.2.3.4", 60);
  });

  it("lets a method-level @RateLimit override the class-level one (and use only its own bucket)", async () => {
    const { store, guard, contextFor } = harness();
    await guard.canActivate(contextFor(AdminLikeController, "importCsv", { ip: "1.2.3.4", headers: {} }));
    expect(store.increment).toHaveBeenCalledTimes(1);
    expect(store.increment).toHaveBeenCalledWith("admin-import:1.2.3.4", 3600);
  });

  it("separates buckets per IP", async () => {
    const { store, guard, contextFor } = harness();
    await guard.canActivate(contextFor(AdminLikeController, "a", { ip: "1.1.1.1", headers: {} }));
    await guard.canActivate(contextFor(AdminLikeController, "a", { ip: "2.2.2.2", headers: {} }));
    expect(store.increment).toHaveBeenNthCalledWith(1, "admin:1.1.1.1", 60);
    expect(store.increment).toHaveBeenNthCalledWith(2, "admin:2.2.2.2", 60);
  });
});

describe("RateLimitGuard — limit exceeded", () => {
  it("throws 429 with the error envelope and a Retry-After header once the count passes the limit", async () => {
    const { guard, header, contextFor } = harness(6); // limit is 5
    const attempt = guard.canActivate(contextFor(PerHandlerController, "list", { ip: "1.2.3.4", headers: {} }));
    await expect(attempt).rejects.toBeInstanceOf(HttpException);
    await attempt.catch((e: HttpException) => {
      expect(e.getStatus()).toBe(429);
      expect(e.getResponse()).toEqual({ error: { code: "RATE_LIMITED", message: "Çok fazla istek, daha sonra tekrar deneyin" } });
    });
    expect(header).toHaveBeenCalledWith("Retry-After", "60");
  });

  it("allows exactly `limit` requests", async () => {
    const { guard, contextFor } = harness(5);
    await expect(guard.canActivate(contextFor(PerHandlerController, "list", { ip: "1.2.3.4", headers: {} }))).resolves.toBe(true);
  });
});
