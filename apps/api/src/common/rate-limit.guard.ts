import { CanActivate, ExecutionContext, Inject, Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { CACHE_STORE, CacheStore } from "./cache-store.interface";

export function RateLimit(limit: number, windowSeconds: number) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata("rate-limit", { limit, windowSeconds }, descriptor.value);
    return descriptor;
  };
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Inject(CACHE_STORE) private store: CacheStore) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const meta = Reflect.getMetadata("rate-limit", handler);
    if (!meta) return true;
    const req = context.switchToHttp().getRequest();
    const ip = req.ip ?? req.headers["x-forwarded-for"] ?? "unknown";
    const key = `${context.getClass().name}:${handler.name}:${ip}`;
    const count = await this.store.increment(key, meta.windowSeconds);
    if (count > meta.limit) {
      const res = context.switchToHttp().getResponse();
      res.header("Retry-After", String(meta.windowSeconds));
      throw new HttpException(
        { error: { code: "RATE_LIMITED", message: "Çok fazla istek, daha sonra tekrar deneyin" } },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
