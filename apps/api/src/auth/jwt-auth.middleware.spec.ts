const jwtVerifyMock = jest.fn();

jest.mock("jose", () => ({
  createRemoteJWKSet: jest.fn(() => "JWKS_KEYSET"),
  jwtVerify: (...args: any[]) => jwtVerifyMock(...args),
}));

describe("JwtAuthMiddleware", () => {
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
    const { JwtAuthMiddleware } = await import("./jwt-auth.middleware");
    const middleware = new JwtAuthMiddleware();
    const req: any = { headers: { authorization: "Bearer sometoken" } };
    const next = jest.fn();

    await middleware.use(req, {} as any, next);

    expect(jwtVerifyMock).toHaveBeenCalledWith("sometoken", "JWKS_KEYSET", {
      algorithms: ["RS256", "ES256"],
    });
    expect(req.user).toEqual({ id: "u1", role: "curator" });
    expect(next).toHaveBeenCalled();
  });

  it("passes issuer/audience to jwtVerify when both env vars are set", async () => {
    process.env.SUPABASE_JWT_ISSUER = "https://proj.supabase.co/auth/v1";
    process.env.SUPABASE_JWT_AUDIENCE = "authenticated";
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "u1" } });
    const { JwtAuthMiddleware } = await import("./jwt-auth.middleware");
    const middleware = new JwtAuthMiddleware();
    const req: any = { headers: { authorization: "Bearer sometoken" } };

    await middleware.use(req, {} as any, jest.fn());

    expect(jwtVerifyMock).toHaveBeenCalledWith("sometoken", "JWKS_KEYSET", {
      algorithms: ["RS256", "ES256"],
      issuer: "https://proj.supabase.co/auth/v1",
      audience: "authenticated",
    });
  });

  it("rejects when jwtVerify throws (e.g. disallowed algorithm)", async () => {
    jwtVerifyMock.mockRejectedValue(new Error("alg not allowed"));
    const { JwtAuthMiddleware } = await import("./jwt-auth.middleware");
    const middleware = new JwtAuthMiddleware();
    const req: any = { headers: { authorization: "Bearer badtoken" } };

    await expect(middleware.use(req, {} as any, jest.fn())).rejects.toMatchObject({
      response: { error: { code: "INVALID_TOKEN" } },
    });
  });
});
