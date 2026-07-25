import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

const jwtVerifyMock = jest.fn();

jest.mock("jose", () => ({
  createRemoteJWKSet: jest.fn(() => "JWKS_KEYSET"),
  jwtVerify: (...args: any[]) => jwtVerifyMock(...args),
}));

function makeContext(req: any) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as any;
}

describe("JwtAuthGuard", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    jwtVerifyMock.mockReset();
    process.env = { ...OLD_ENV, SUPABASE_JWKS_URL: "http://localhost:54321/auth/v1/.well-known/jwks.json" };
    delete process.env.SUPABASE_JWT_ISSUER;
    delete process.env.SUPABASE_JWT_AUDIENCE;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("verifies with an algorithm allowlist and skips issuer/audience when unset, preserving user_role", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "u1", user_role: "curator" } });
    const { JwtAuthGuard } = await import("./jwt-auth.guard");
    const guard = new JwtAuthGuard();
    const req: any = { headers: { authorization: "Bearer sometoken" } };

    const result = await guard.canActivate(makeContext(req));

    expect(jwtVerifyMock).toHaveBeenCalledWith("sometoken", "JWKS_KEYSET", {
      algorithms: ["RS256", "ES256"],
    });
    expect(req.user).toEqual({ id: "u1", role: "curator" });
    expect(result).toBe(true);
  });

  it("passes issuer/audience to jwtVerify when both env vars are set", async () => {
    process.env.SUPABASE_JWT_ISSUER = "https://proj.supabase.co/auth/v1";
    process.env.SUPABASE_JWT_AUDIENCE = "authenticated";
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "u1" } });
    const { JwtAuthGuard } = await import("./jwt-auth.guard");
    const guard = new JwtAuthGuard();
    const req: any = { headers: { authorization: "Bearer sometoken" } };

    await guard.canActivate(makeContext(req));

    expect(jwtVerifyMock).toHaveBeenCalledWith("sometoken", "JWKS_KEYSET", {
      algorithms: ["RS256", "ES256"],
      issuer: "https://proj.supabase.co/auth/v1",
      audience: "authenticated",
    });
  });

  it("rejects when jwtVerify throws (e.g. disallowed algorithm)", async () => {
    jwtVerifyMock.mockRejectedValue(new Error("alg not allowed"));
    const { JwtAuthGuard } = await import("./jwt-auth.guard");
    const guard = new JwtAuthGuard();
    const req: any = { headers: { authorization: "Bearer badtoken" } };

    await expect(guard.canActivate(makeContext(req))).rejects.toMatchObject({
      response: { error: { code: "INVALID_TOKEN" } },
    });
  });

  it("rejects with UnauthorizedException when the verified payload has no `sub` claim (runtime validation, not just the jwtVerify<T> compile-time generic)", async () => {
    // Before the fix, `jwtVerify<SupabaseJwtPayload>` was a TypeScript-only annotation — jose never
    // validates the decoded payload shape at runtime, so a token that verifies cryptographically but
    // carries no `sub` claim flowed through `payload.sub ?? ""`, turning a malformed token into a
    // valid-looking empty-string user id instead of being rejected. This must throw instead.
    jwtVerifyMock.mockResolvedValue({ payload: { user_role: "curator" } });
    const { JwtAuthGuard } = await import("./jwt-auth.guard");
    const guard = new JwtAuthGuard();
    const req: any = { headers: { authorization: "Bearer sometoken" } };

    await expect(guard.canActivate(makeContext(req))).rejects.toMatchObject({
      response: { error: { code: "INVALID_TOKEN" } },
    });
  });

  it("rejects with UnauthorizedException when `user_role` is present but not a string", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "u1", user_role: 12345 } });
    const { JwtAuthGuard } = await import("./jwt-auth.guard");
    const guard = new JwtAuthGuard();
    const req: any = { headers: { authorization: "Bearer sometoken" } };

    await expect(guard.canActivate(makeContext(req))).rejects.toMatchObject({
      response: { error: { code: "INVALID_TOKEN" } },
    });
  });

  it("sets user to undefined and allows through when no Bearer header is present", async () => {
    const { JwtAuthGuard } = await import("./jwt-auth.guard");
    const guard = new JwtAuthGuard();
    const req: any = { headers: {} };

    const result = await guard.canActivate(makeContext(req));

    expect(req.user).toBeUndefined();
    expect(result).toBe(true);
    expect(jwtVerifyMock).not.toHaveBeenCalled();
  });

  // Regression test for the 403-always bug (docs/STATE.md "ACİL" entry, fixed by making this a Guard
  // instead of NestMiddleware): the previous implementation set `req.user` on a request object that
  // `RolesGuard` never saw, because under @nestjs/platform-fastify, classic NestMiddleware and
  // `ExecutionContext.switchToHttp().getRequest()` return two DIFFERENT request objects. Every mocked
  // unit test (including all the ones above) constructs a single object and hands it to both the
  // guard-under-test and its own assertions, so none of them could ever have caught that class of bug
  // — they never modeled "does a SECOND consumer, reading via the same ExecutionContext, see the
  // mutation." This test drives both `JwtAuthGuard` and the real `RolesGuard` off the exact same
  // `ExecutionContext`, the way Nest's guard chain actually does per-request, and would fail again if
  // the two guards ever went back to reading from independently-constructed request objects.
  it("writes req.user somewhere a subsequently-run RolesGuard, reading via the SAME ExecutionContext, can see it", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "u1", user_role: "curator" } });
    const { JwtAuthGuard } = await import("./jwt-auth.guard");
    const { RolesGuard } = await import("./roles.guard");

    const req: { headers: Record<string, string>; user?: { id: string; role: string } } = {
      headers: { authorization: "Bearer sometoken" },
    };
    // A single shared ExecutionContext double whose getRequest() always returns the SAME req
    // instance — modeling Nest's real per-request ExecutionContext, not two separately-built mocks.
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    const reflector = { getAllAndOverride: () => ["curator", "admin"] } as unknown as Reflector;

    const jwtGuard = new JwtAuthGuard();
    const rolesGuard = new RolesGuard(reflector);

    await jwtGuard.canActivate(context);
    const rolesResult = rolesGuard.canActivate(context);

    expect(rolesResult).toBe(true);
  });
});
