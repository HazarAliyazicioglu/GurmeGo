import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AdminQueueController } from "../src/admin/queue/admin-queue.controller";
import { AdminQueueService } from "../src/admin/queue/admin-queue.service";
import { PrismaModule } from "../src/prisma/prisma.module";
import { PrismaService } from "../src/prisma/prisma.service";

// MINOR 2 fix (final whole-branch review): admin-queue.controller.spec.ts's existing e2e-style
// tests bypass the REAL JwtAuthGuard entirely via an `x-test-role` header/hook -- they prove
// RolesGuard's behavior given a `req.user`, but never prove that a real JWT, decoded by the real
// JwtAuthGuard (Task 17's lowercase-role-normalization fix), actually reaches RolesGuard and
// produces the 403 shape apps/admin's `ApiHttpError` parsing expects. This test closes that gap:
// it boots the REAL `JwtAuthGuard` + `RolesGuard` classes in front of the real
// `AdminQueueController`, and sends a real `Authorization: Bearer <token>` header through the real
// guard chain.
//
// TASK 27 fix (Codex cross-model review of Task 26, MINOR): this used to register
// `{ provide: APP_GUARD, useClass: JwtAuthGuard }` / `RolesGuard` by hand in the test module,
// duplicating (not importing) auth.module.ts's own registration -- if auth.module.ts's real
// wiring ever regressed (a guard removed, the registration order swapped), this test would still
// pass, since it never actually exercised that module. Importing the real `AuthModule` closes
// that gap: this test now fails if AuthModule itself stops registering both guards in order.
//
// The one thing mocked is `jose`'s cryptographic verification (`jwtVerify`/`createRemoteJWKSet`),
// the same mocking boundary apps/api/src/auth/jwt-auth.guard.spec.ts already uses -- no real
// Supabase project exists yet (see jwt-auth.guard.ts's own comments), so there is no real JWKS
// endpoint to verify a real token against in CI. Mocking only the crypto step, while leaving
// `JwtAuthGuard`'s real class (claim extraction, casing normalization, `AuthenticatedRequest`
// population) and the real `RolesGuard` class wired up exactly as production does, is the closest
// realistic equivalent available in this codebase to a genuinely signed token, and is enough to
// prove Task 17 (role-case fix) and Task 24 (401/403 UI distinction) actually compose end-to-end:
// a decoded JWT with a role RolesGuard rejects produces a genuine 403 with
// `{ error: { code, message } }`, which is exactly the shape apps/admin's `ApiHttpError` parsing
// (see apps/admin/src/lib/api.ts) expects.
const jwtVerifyMock = jest.fn();
jest.mock("jose", () => ({
  createRemoteJWKSet: jest.fn(() => "JWKS_KEYSET"),
  jwtVerify: (...args: unknown[]) => jwtVerifyMock(...args),
}));

describe("Real JwtAuthGuard + RolesGuard chain (e2e) — GET /admin/queue", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let service: { list: jest.Mock; approve: jest.Mock; reject: jest.Mock };
  const OLD_ENV = process.env;
  // Every JWT payload below now needs a valid `email` claim: JwtAuthGuard's real class (imported
  // below, unmocked) lazy-upserts a User row per docs/REVIEW-PLAN.md §1.3's fix, and `User.email`
  // is required+unique in the schema.
  const SEEDED_USER_IDS = ["denied-user", "curator-1"];

  beforeAll(async () => {
    process.env = { ...OLD_ENV, SUPABASE_JWKS_URL: "http://localhost:54321/auth/v1/.well-known/jwks.json" };
    delete process.env.SUPABASE_JWT_ISSUER;
    delete process.env.SUPABASE_JWT_AUDIENCE;

    // Import AFTER env vars are set and AFTER the `jose` mock is registered, mirroring
    // jwt-auth.guard.spec.ts's `jest.resetModules()` + dynamic-import pattern -- JwtAuthGuard's
    // module reads `SUPABASE_JWKS_URL` and calls `createRemoteJWKSet` once at import time.
    const { AuthModule } = await import("../src/auth/auth.module");

    service = { list: jest.fn(), approve: jest.fn(), reject: jest.fn() };

    // PrismaModule must be imported explicitly here: it's `@Global()` in the real app (via
    // AppModule), but a `Test.createTestingModule` that only imports AuthModule doesn't pull in
    // any module that provides PrismaService, and JwtAuthGuard now constructor-injects it.
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, AuthModule],
      controllers: [AdminQueueController],
      providers: [{ provide: AdminQueueService, useValue: service }],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: SEEDED_USER_IDS } } });
    await app.close();
    process.env = OLD_ENV;
  });

  beforeEach(() => {
    jwtVerifyMock.mockReset();
    service.list.mockReset();
  });

  it("returns a real 403, shaped as apps/admin's ApiHttpError parsing expects, for a real (mock-verified) JWT carrying a role RolesGuard denies", async () => {
    // A decoded "user" role -- curator/admin-only per `@Roles("curator", "admin")` on
    // AdminQueueController. Uppercase, matching what a real Supabase custom access token hook
    // would emit from the DB's UPPERCASE UserRole enum (see admin-users.service.ts's
    // `assignRole`) -- proves Task 17's lowercase-normalization fix is actually what lets
    // RolesGuard's lowercase comparison correctly DENY this role, not accidentally allow it
    // through unnormalized.
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "denied-user", email: "denied-user@example.com", user_role: "USER" } });

    const res = await app.inject({
      method: "GET",
      url: "/admin/queue",
      headers: { authorization: "Bearer real-looking-jwt.signed.token" },
    });

    expect(jwtVerifyMock).toHaveBeenCalledWith(
      "real-looking-jwt.signed.token",
      "JWKS_KEYSET",
      expect.objectContaining({ algorithms: ["RS256", "ES256"] }),
    );
    expect(res.statusCode).toBe(403);
    expect(service.list).not.toHaveBeenCalled();
    const body = JSON.parse(res.body);
    // Exactly the shape apps/admin/src/lib/api.ts's ApiHttpError construction reads from a 403
    // response body -- `{ error: { code, message } }`, no top-level `message`.
    expect(body).toMatchObject({ error: { code: expect.any(String), message: expect.any(String) } });
  });

  it("allows the request through the real guard chain (200) for a real (mock-verified) JWT carrying an allowed, lowercase-normalized role", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "curator-1", email: "curator-1@example.com", user_role: "CURATOR" } });
    service.list.mockResolvedValue([]);

    const res = await app.inject({
      method: "GET",
      url: "/admin/queue",
      headers: { authorization: "Bearer real-looking-jwt.signed.token" },
    });

    expect(res.statusCode).toBe(200);
    expect(service.list).toHaveBeenCalled();
  });

  // cross-model-review finding (Adım 2, §1.3 fix): the tests above only ever exercise the upsert's
  // CREATE path against the real DB -- the UPDATE path (re-authenticating with the same `sub` but a
  // changed `email`) was only proven against a mock in jwt-auth.guard.spec.ts. This proves it holds
  // for the real Postgres constraint too (User.email is unique -- an update that collided with it
  // would surface here as a real P2002 error, not just a mock call assertion).
  it("updates the real User row's email on re-authentication with the same sub but a changed email", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "curator-1", email: "curator-1@example.com", user_role: "CURATOR" } });
    service.list.mockResolvedValue([]);
    await app.inject({
      method: "GET",
      url: "/admin/queue",
      headers: { authorization: "Bearer real-looking-jwt.signed.token" },
    });

    jwtVerifyMock.mockResolvedValue({ payload: { sub: "curator-1", email: "curator-1-updated@example.com", user_role: "CURATOR" } });
    const res = await app.inject({
      method: "GET",
      url: "/admin/queue",
      headers: { authorization: "Bearer real-looking-jwt.signed.token" },
    });

    expect(res.statusCode).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: "curator-1" } });
    expect(user.email).toBe("curator-1-updated@example.com");
  });

  // TASK 27 fix (Codex cross-model review of Task 26, MINOR): the suite above only ever mocked
  // `jwtVerify` to SUCCEED -- there was no test proving the real guard chain rejects a request with
  // no Authorization header at all, or one carrying a token that fails verification outright. Both
  // must produce a 401, before any request ever reaches AdminQueueController/AdminQueueService.
  it("returns a real 401 when the request carries no Authorization header at all", async () => {
    const res = await app.inject({ method: "GET", url: "/admin/queue" });

    expect(jwtVerifyMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(service.list).not.toHaveBeenCalled();
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ error: { code: expect.any(String), message: expect.any(String) } });
  });

  it("returns a real 401 when the real (mock-verified) JWT verification itself rejects (expired/tampered/malformed token)", async () => {
    jwtVerifyMock.mockRejectedValue(new Error("signature verification failed"));

    const res = await app.inject({
      method: "GET",
      url: "/admin/queue",
      headers: { authorization: "Bearer tampered.or.expired.token" },
    });

    expect(jwtVerifyMock).toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(service.list).not.toHaveBeenCalled();
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ error: { code: "INVALID_TOKEN", message: expect.any(String) } });
  });
});
