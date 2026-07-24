import { Injectable, NestMiddleware, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL!));

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
      const { payload } = await jwtVerify(token, JWKS);
      req.user = { id: payload.sub, role: (payload as any).user_role ?? "user" };
    } catch {
      throw new UnauthorizedException({ error: { code: "INVALID_TOKEN", message: "Geçersiz oturum" } });
    }
    next();
  }
}
