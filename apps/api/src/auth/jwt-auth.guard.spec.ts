import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

const jwtVerifyMock = jest.fn();

jest.mock("jose", () => ({
  createRemoteJWKSet: jest.fn(() => "JWKS_KEYSET"),
  jwtVerify: (...args: any[]) => jwtVerifyMock(...args),
}));

// jwt-auth.guard.ts imports the real class only for NestJS's constructor-injection type metadata --
// every test below passes its own plain mock object instead. Mocking the module here keeps this
// unit test from transitively importing `@prisma/client`, whose generated runtime eagerly reloads
// dotenv on import and re-populates any env var (e.g. SUPABASE_JWKS_URL) present in a developer's
// real apps/api/.env, breaking the "delete env var, reimport, expect throw" test below regardless
// of what the test itself does.
jest.mock("../prisma/prisma.service", () => ({ PrismaService: class PrismaService {} }));

function makeContext(req: any) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as any;
}

function makePrismaMock() {
  return { user: { upsert: jest.fn().mockResolvedValue({}) } };
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
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "u1", email: "u1@example.com", user_role: "curator" } });
    const { JwtAuthGuard } = await import("./jwt-auth.guard");
    const guard = new JwtAuthGuard(makePrismaMock() as any);
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
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "u1", email: "u1@example.com" } });
    const { JwtAuthGuard } = await import("./jwt-auth.guard");
    const guard = new JwtAuthGuard(makePrismaMock() as any);
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
    const guard = new JwtAuthGuard(makePrismaMock() as any);
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
    jwtVerifyMock.mockResolvedValue({ payload: { email: "u1@example.com", user_role: "curator" } });
    const { JwtAuthGuard } = await import("./jwt-auth.guard");
    const guard = new JwtAuthGuard(makePrismaMock() as any);
    const req: any = { headers: { authorization: "Bearer sometoken" } };

    await expect(guard.canActivate(makeContext(req))).rejects.toMatchObject({
      response: { error: { code: "INVALID_TOKEN" } },
    });
  });

  it("rejects with UnauthorizedException when `user_role` is present but not a string", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "u1", email: "u1@example.com", user_role: 12345 } });
    const { JwtAuthGuard } = await import("./jwt-auth.guard");
    const guard = new JwtAuthGuard(makePrismaMock() as any);
    const req: any = { headers: { authorization: "Bearer sometoken" } };

    await expect(guard.canActivate(makeContext(req))).rejects.toMatchObject({
      response: { error: { code: "INVALID_TOKEN" } },
    });
  });

  // §1.3 KRİTİK bulgu fix (docs/REVIEW-PLAN.md): FavoriteList.userId -> User.id is a required FK,
  // but nothing ever created the User row Supabase Auth's JWT implies -- a real user's first
  // favorite-list write hit a raw Postgres FK violation (500), since favorites.service.spec.ts's
  // fully-mocked Prisma never exercised the real constraint. This guard is the single place every
  // authenticated request already passes through, so it lazy-upserts the User row here instead of
  // requiring every future User-dependent write site to remember to do it themselves.
  it("lazy-upserts the User row with the JWT's sub as id and email, keyed for future re-authentication", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "u1", email: "u1@example.com", user_role: "curator" } });
    const prisma = makePrismaMock();
    const { JwtAuthGuard } = await import("./jwt-auth.guard");
    const guard = new JwtAuthGuard(prisma as any);
    const req: any = { headers: { authorization: "Bearer sometoken" } };

    await guard.canActivate(makeContext(req));

    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { id: "u1" },
      create: { id: "u1", email: "u1@example.com" },
      update: { email: "u1@example.com" },
    });
  });

  it("rejects with 401 INVALID_TOKEN when the email claim is missing (User.email is required+unique in the DB)", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "u1", user_role: "curator" } });
    const prisma = makePrismaMock();
    const { JwtAuthGuard } = await import("./jwt-auth.guard");
    const guard = new JwtAuthGuard(prisma as any);
    const req: any = { headers: { authorization: "Bearer sometoken" } };

    await expect(guard.canActivate(makeContext(req))).rejects.toMatchObject({
      response: { error: { code: "INVALID_TOKEN" } },
    });
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it("rejects with 401 INVALID_TOKEN when the email claim is not a valid email string", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "u1", email: "not-an-email" } });
    const prisma = makePrismaMock();
    const { JwtAuthGuard } = await import("./jwt-auth.guard");
    const guard = new JwtAuthGuard(prisma as any);
    const req: any = { headers: { authorization: "Bearer sometoken" } };

    await expect(guard.canActivate(makeContext(req))).rejects.toMatchObject({
      response: { error: { code: "INVALID_TOKEN" } },
    });
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  // A DB failure during provisioning is a genuine infra error, not a bad token -- it must NOT be
  // swallowed into the catch-all UnauthorizedException the token-verification step above uses, or
  // ops would see a misleading "Geçersiz oturum" for what is actually a database outage.
  it("propagates a database error from the upsert as-is, not masked as an INVALID_TOKEN 401", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "u1", email: "u1@example.com" } });
    const prisma = makePrismaMock();
    prisma.user.upsert.mockRejectedValue(new Error("connection terminated"));
    const { JwtAuthGuard } = await import("./jwt-auth.guard");
    const guard = new JwtAuthGuard(prisma as any);
    const req: any = { headers: { authorization: "Bearer sometoken" } };

    await expect(guard.canActivate(makeContext(req))).rejects.toThrow("connection terminated");
  });

  // Regression test for the casing blocker: the Prisma `UserRole` enum stores roles UPPERCASE
  // (USER, APPROVED_RATER, CURATOR, ADMIN — confirmed by admin-users.service.ts's `assignRole`
  // writing `role.toUpperCase()`), but every `@Roles(...)` decorator across the codebase compares
  // against lowercase strings ("curator", "admin", ...). A real Supabase custom access token hook
  // reading the DB's role verbatim would emit "CURATOR", which this guard used to pass through
  // unchanged — silently breaking every role-gated route once that hook is wired up. The guard must
  // normalize casing at the point it first reads the claim.
  it("lowercases the JWT's user_role claim so it matches the lowercase @Roles(...) comparisons", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "u1", email: "u1@example.com", user_role: "CURATOR" } });
    const { JwtAuthGuard } = await import("./jwt-auth.guard");
    const guard = new JwtAuthGuard(makePrismaMock() as any);
    const req: any = { headers: { authorization: "Bearer sometoken" } };

    await guard.canActivate(makeContext(req));

    expect(req.user).toEqual({ id: "u1", role: "curator" });
  });

  it("sets user to undefined and allows through when no Bearer header is present", async () => {
    const { JwtAuthGuard } = await import("./jwt-auth.guard");
    const prisma = makePrismaMock();
    const guard = new JwtAuthGuard(prisma as any);
    const req: any = { headers: {} };

    const result = await guard.canActivate(makeContext(req));

    expect(req.user).toBeUndefined();
    expect(result).toBe(true);
    expect(jwtVerifyMock).not.toHaveBeenCalled();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
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
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "u1", email: "u1@example.com", user_role: "curator" } });
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

    const jwtGuard = new JwtAuthGuard(makePrismaMock() as any);
    const rolesGuard = new RolesGuard(reflector);

    await jwtGuard.canActivate(context);
    const rolesResult = rolesGuard.canActivate(context);

    expect(rolesResult).toBe(true);
  });

  // Security/ops finding: `new URL(process.env.SUPABASE_JWKS_URL!)` at module load used to throw a
  // confusing low-level "Invalid URL" error if the env var was genuinely missing -- and since this
  // module is imported at app bootstrap, that crash took down the whole process (including
  // unrelated routes like /health) with no indication of what was actually wrong.
  it("throws a clear, actionable error at module load when SUPABASE_JWKS_URL is missing", async () => {
    delete process.env.SUPABASE_JWKS_URL;
    await expect(import("./jwt-auth.guard")).rejects.toThrow(/SUPABASE_JWKS_URL is required/);
  });
});
