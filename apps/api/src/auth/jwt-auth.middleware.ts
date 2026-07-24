import { Injectable, NestMiddleware, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, JWTVerifyOptions } from "jose";

const JWKS = createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL!));

// Supabase signs project JWTs with either RS256 or ES256 depending on project config
// (legacy HS256 shared-secret projects don't use a JWKS endpoint, so aren't relevant here).
// Restricting to this allowlist prevents `jwtVerify` from accepting any algorithm the JWKS
// happens to expose.
const ALLOWED_ALGORITHMS = ["RS256", "ES256"];

// No real Supabase project exists yet (Plan 4 provisions one) — until SUPABASE_JWT_ISSUER /
// SUPABASE_JWT_AUDIENCE are set, skip those specific checks so local dev/tests keep working.
// Once the real project exists, set both env vars and this middleware starts enforcing them.
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

@Injectable()
export class JwtAuthMiddleware implements NestMiddleware {
  async use(req: any, _res: any, next: () => void) {
    const header = req.headers["authorization"];
    if (!header?.startsWith("Bearer ")) {
      req.user = undefined;
      return next();
    }
    try {
      const token = header.slice("Bearer ".length);
      const { payload } = await jwtVerify(token, JWKS, buildVerifyOptions());
      req.user = { id: payload.sub, role: (payload as any).user_role ?? "user" };
    } catch {
      throw new UnauthorizedException({ error: { code: "INVALID_TOKEN", message: "Geçersiz oturum" } });
    }
    next();
  }
}
