import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { APP_GUARD } from "@nestjs/core";
import { AdminQueueController } from "../src/admin/queue/admin-queue.controller";
import { AdminQueueService } from "../src/admin/queue/admin-queue.service";

// MINOR 2 fix (final whole-branch review): admin-queue.controller.spec.ts's existing e2e-style
// tests bypass the REAL JwtAuthGuard entirely via an `x-test-role` header/hook -- they prove
// RolesGuard's behavior given a `req.user`, but never prove that a real JWT, decoded by the real
// JwtAuthGuard (Task 17's lowercase-role-normalization fix), actually reaches RolesGuard and
// produces the 403 shape apps/admin's `ApiHttpError` parsing expects. This test closes that gap:
// it boots the REAL `JwtAuthGuard` + `RolesGuard` classes (registered the same way auth.module.ts
// registers them, via APP_GUARD, in the same order) in front of the real `AdminQueueController`,
// and sends a real `Authorization: Bearer <token>` header through the real guard chain.
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
  let service: { list: jest.Mock; approve: jest.Mock; reject: jest.Mock };
  const OLD_ENV = process.env;

  beforeAll(async () => {
    process.env = { ...OLD_ENV, SUPABASE_JWKS_URL: "http://localhost:54321/auth/v1/.well-known/jwks.json" };
    delete process.env.SUPABASE_JWT_ISSUER;
    delete process.env.SUPABASE_JWT_AUDIENCE;

    // Import AFTER env vars are set and AFTER the `jose` mock is registered, mirroring
    // jwt-auth.guard.spec.ts's `jest.resetModules()` + dynamic-import pattern -- JwtAuthGuard's
    // module reads `SUPABASE_JWKS_URL` and calls `createRemoteJWKSet` once at import time.
    const { JwtAuthGuard } = await import("../src/auth/jwt-auth.guard");
    const { RolesGuard } = await import("../src/auth/roles.guard");

    service = { list: jest.fn(), approve: jest.fn(), reject: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminQueueController],
      providers: [
        { provide: AdminQueueService, useValue: service },
        // Same registration order as auth.module.ts: JwtAuthGuard first (populates req.user),
        // then RolesGuard (reads it) -- both real classes, not test doubles.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
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
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "denied-user", user_role: "USER" } });

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
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "curator-1", user_role: "CURATOR" } });
    service.list.mockResolvedValue([]);

    const res = await app.inject({
      method: "GET",
      url: "/admin/queue",
      headers: { authorization: "Bearer real-looking-jwt.signed.token" },
    });

    expect(res.statusCode).toBe(200);
    expect(service.list).toHaveBeenCalled();
  });
});
