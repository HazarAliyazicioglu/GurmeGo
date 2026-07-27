import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify, JWTVerifyOptions } from "jose";
import { z } from "zod";

export interface AuthenticatedUser {
  id: string;
  role: string;
}

// Populated by this guard's `canActivate` (see below) and read by `RolesGuard`/`@Req()` handlers via
// the SAME `ExecutionContext.switchToHttp().getRequest()` call — see the class-level comment for why
// that "same object" property matters.
export interface AuthenticatedRequest extends FastifyRequest {
  user?: AuthenticatedUser;
}

// `jwtVerify<T>(...)`'s generic is a compile-time-only annotation — `jose` never validates the
// decoded payload against it at runtime, it just returns `unknown` cast to `T`. Without this schema,
// a token whose `sub` claim is missing/non-string would silently become `payload.sub ?? ""` (an
// empty-string user id treated as a valid identity) instead of being rejected, and a non-string
// `user_role` would flow through unchecked. Supabase's custom access token hook nests the app's role
// claim under `user_role`; `sub` is the standard JWT subject claim.
const SupabaseJwtPayloadSchema = z.object({
  sub: z.string().min(1),
  user_role: z.string().optional(),
});

const JWKS = createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL!));

// Supabase signs project JWTs with either RS256 or ES256 depending on project config
// (legacy HS256 shared-secret projects don't use a JWKS endpoint, so aren't relevant here).
// Restricting to this allowlist prevents `jwtVerify` from accepting any algorithm the JWKS
// happens to expose.
const ALLOWED_ALGORITHMS = ["RS256", "ES256"];

// No real Supabase project exists yet (Plan 4 provisions one) — until SUPABASE_JWT_ISSUER /
// SUPABASE_JWT_AUDIENCE are set, skip those specific checks so local dev/tests keep working.
// Once the real project exists, set both env vars and this guard starts enforcing them.
function buildVerifyOptions(): JWTVerifyOptions {
  const options: JWTVerifyOptions = { algorithms: ALLOWED_ALGORITHMS };
  if (process.env.SUPABASE_JWT_ISSUER) {
    options.issuer = process.env.SUPABASE_JWT_ISSUER;
  }
  if (process.env.SUPABASE_JWT_AUDIENCE) {
    options.audience = process.env.SUPABASE_JWT_AUDIENCE;
  }
  return options;
}

// Registered globally via APP_GUARD (see auth.module.ts). Runs on every route, before RolesGuard,
// and populates request.user. Deliberately a Guard, not classic NestMiddleware: under
// @nestjs/platform-fastify, NestMiddleware receives Fastify's raw Node IncomingMessage, while
// ExecutionContext.switchToHttp().getRequest() (used here, in RolesGuard, and in every @Req())
// returns Fastify's own FastifyRequest — a different object. Setting req.user in middleware never
// became visible to guards/controllers, so every role-gated route returned 403 unconditionally.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      req.user = undefined;
      return true;
    }
    try {
      const token = header.slice("Bearer ".length);
      const { payload } = await jwtVerify(token, JWKS, buildVerifyOptions());
      const parsed = SupabaseJwtPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        throw new UnauthorizedException({ error: { code: "INVALID_TOKEN", message: "Geçersiz oturum" } });
      }
      // Normalize casing here, at the single point this guard first reads the claim: the Prisma
      // `UserRole` enum stores roles UPPERCASE (see admin-users.service.ts's `assignRole`, which
      // writes `role.toUpperCase()`), but every `@Roles(...)` decorator across the codebase compares
      // against lowercase strings. Once a real Supabase custom access token hook populates this
      // claim from the DB, it will arrive as e.g. "CURATOR" — lowercase it so RolesGuard's existing
      // comparisons keep working unchanged.
      req.user = { id: parsed.data.sub, role: (parsed.data.user_role ?? "user").toLowerCase() };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException({ error: { code: "INVALID_TOKEN", message: "Geçersiz oturum" } });
    }
    return true;
  }
}
