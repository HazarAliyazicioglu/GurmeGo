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

  it("sets user to undefined and allows through when no Bearer header is present", async () => {
    const { JwtAuthGuard } = await import("./jwt-auth.guard");
    const guard = new JwtAuthGuard();
    const req: any = { headers: {} };

    const result = await guard.canActivate(makeContext(req));

    expect(req.user).toBeUndefined();
    expect(result).toBe(true);
    expect(jwtVerifyMock).not.toHaveBeenCalled();
  });
});
