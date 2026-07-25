import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify, JWTPayload, JWTVerifyOptions } from "jose";

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

// Supabase's custom access token hook nests the app's role claim under `user_role`; everything else
// on the payload is the standard JWT claim set `jose` already types via `JWTPayload`.
interface SupabaseJwtPayload extends JWTPayload {
  user_role?: string;
}

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
      const { payload } = await jwtVerify<SupabaseJwtPayload>(token, JWKS, buildVerifyOptions());
      req.user = { id: payload.sub ?? "", role: payload.user_role ?? "user" };
    } catch {
      throw new UnauthorizedException({ error: { code: "INVALID_TOKEN", message: "Geçersiz oturum" } });
    }
    return true;
  }
}
