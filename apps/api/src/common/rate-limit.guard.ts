import { CanActivate, ExecutionContext, Inject, Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { CACHE_STORE, CacheStore } from "./cache-store.interface";

const RATE_LIMIT_METADATA = "rate-limit";

type RateLimitMetadata = { limit: number; windowSeconds: number; bucket?: string };

// Usable on a single handler OR on a whole controller class. A handler-level declaration overrides the
// class-level one. Without `bucket` the counter is per handler (`Class:handler:ip`); with `bucket`, every
// handler that names the same bucket shares ONE counter per IP (`bucket:ip`) -- what a "60/min across the
// whole admin API" limit needs, since a per-handler counter would multiply the allowance by the number
// of endpoints.
export function RateLimit(limit: number, windowSeconds: number, options?: { bucket?: string }) {
  const metadata: RateLimitMetadata = { limit, windowSeconds, ...(options?.bucket ? { bucket: options.bucket } : {}) };
  const decorator = (target: object, _key?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(RATE_LIMIT_METADATA, metadata, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(RATE_LIMIT_METADATA, metadata, target);
    return undefined;
  };
  // One implementation, two decorator shapes: TypeScript cannot infer both from a single arrow.
  return decorator as unknown as ClassDecorator & MethodDecorator;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Inject(CACHE_STORE) private store: CacheStore) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const meta: RateLimitMetadata | undefined =
      Reflect.getMetadata(RATE_LIMIT_METADATA, handler) ?? Reflect.getMetadata(RATE_LIMIT_METADATA, context.getClass());
    if (!meta) return true;
    const req = context.switchToHttp().getRequest();
    // `req.ip` ONLY. Fastify derives it from the socket, or from X-Forwarded-For strictly according to
    // main.ts's `trustProxy` (TRUST_PROXY_HOPS). Reading the header here would let any client choose its
    // own bucket and bypass that.
    const ip = req.ip ?? "unknown";
    const key = meta.bucket ? `${meta.bucket}:${ip}` : `${context.getClass().name}:${handler.name}:${ip}`;
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
