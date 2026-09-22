import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";
import { CACHE_STORE } from "../../common/cache-store.interface";

const USER_ID = "d290f1ee-6c54-4b01-90e6-d701748f0853";

describe("AdminUsersController (e2e) — RolesGuard", () => {
  let app: NestFastifyApplication;
  let service: { assignRole: jest.Mock; search: jest.Mock };

  beforeAll(async () => {
    service = { assignRole: jest.fn(), search: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [{ provide: AdminUsersService, useValue: service }, { provide: CACHE_STORE, useValue: { increment: jest.fn().mockResolvedValue(1) } }],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    // Test-only stand-in for JwtAuthGuard: sets req.user from a header instead of verifying a real JWT.
    app.getHttpAdapter()
      .getInstance()
      .addHook("onRequest", (req: any, _reply: any, done: () => void) => {
        const role = req.headers["x-test-role"];
        req.user = role ? { id: "test-user", role } : undefined;
        done();
      });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    service.assignRole.mockReset();
    service.search.mockReset();
  });

  it("allows an admin to assign a role", async () => {
    service.assignRole.mockResolvedValue({ id: USER_ID, role: "CURATOR" });

    const res = await app.inject({
      method: "PUT",
      url: `/admin/users/${USER_ID}/roles`,
      headers: { "x-test-role": "admin" },
      payload: { role: "curator" },
    });

    expect(res.statusCode).toBe(200);
    expect(service.assignRole).toHaveBeenCalledWith(USER_ID, "curator", "test-user");
  });

  // Same ZodValidationPipe convention as every other admin endpoint: a malformed body is rejected at the
  // edge with the standard VALIDATION_ERROR envelope, before the service sees it.
  it.each([{ payload: {} }, { payload: { role: 123 } }, { payload: { role: "" } }, { payload: { role: null } }])(
    "rejects the malformed body $payload with 400 VALIDATION_ERROR before reaching the service",
    async ({ payload }) => {
      const res = await app.inject({
        method: "PUT",
        url: `/admin/users/${USER_ID}/roles`,
        headers: { "x-test-role": "admin" },
        payload,
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
      expect(service.assignRole).not.toHaveBeenCalled();
    },
  );

  it("rejects a non-UUID id with 400 before reaching the service", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/admin/users/not-a-uuid/roles",
      headers: { "x-test-role": "admin" },
      payload: { role: "curator" },
    });

    expect(res.statusCode).toBe(400);
    expect(service.assignRole).not.toHaveBeenCalled();
  });

  it("blocks a curator from assigning a role (admin-only, unlike other admin endpoints)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/admin/users/${USER_ID}/roles`,
      headers: { "x-test-role": "curator" },
      payload: { role: "curator" },
    });

    expect(res.statusCode).toBe(403);
    expect(service.assignRole).not.toHaveBeenCalled();
  });

  it("blocks a plain user from assigning a role", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/admin/users/${USER_ID}/roles`,
      headers: { "x-test-role": "user" },
      payload: { role: "curator" },
    });

    expect(res.statusCode).toBe(403);
    expect(service.assignRole).not.toHaveBeenCalled();
  });

  it("blocks an unauthenticated request", async () => {
    const res = await app.inject({ method: "PUT", url: `/admin/users/${USER_ID}/roles`, payload: { role: "curator" } });

    expect(res.statusCode).toBe(401);
    expect(service.assignRole).not.toHaveBeenCalled();
  });

  it("rejects invalid roles and returns clean error envelope (regression: no top-level message field)", async () => {
    // Simulate the actual BadRequestException from the service: throw with error payload,
    // not with top-level message. This verifies the HTTP response body is clean.
    const { BadRequestException } = await import("@nestjs/common");
    const ex = new BadRequestException({
      error: { code: "ROLE_NOT_AVAILABLE", message: "Bu rol MVP'de kullanılamaz (Faz 2)" },
    });
    ex.message = "Bu rol MVP'de kullanılamaz (Faz 2)";
    service.assignRole.mockRejectedValueOnce(ex);

    const res = await app.inject({
      method: "PUT",
      url: `/admin/users/${USER_ID}/roles`,
      headers: { "x-test-role": "admin" },
      payload: { role: "approved_rater" },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    // Verify the envelope is clean: only `error` field, no top-level `message`
    expect(body).toEqual({
      error: { code: "ROLE_NOT_AVAILABLE", message: "Bu rol MVP'de kullanılamaz (Faz 2)" },
    });
    expect(body.message).toBeUndefined();
  });
});

describe("AdminUsersController (e2e) — GET / search", () => {
  let app: NestFastifyApplication;
  let service: { assignRole: jest.Mock; search: jest.Mock };

  beforeAll(async () => {
    service = { assignRole: jest.fn(), search: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [{ provide: AdminUsersService, useValue: service }, { provide: CACHE_STORE, useValue: { increment: jest.fn().mockResolvedValue(1) } }],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.getHttpAdapter()
      .getInstance()
      .addHook("onRequest", (req: any, _reply: any, done: () => void) => {
        const role = req.headers["x-test-role"];
        req.user = role ? { id: "test-user", role } : undefined;
        done();
      });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    service.search.mockReset();
  });

  it("allows an admin to search users by term", async () => {
    service.search.mockResolvedValue([{ id: USER_ID, email: "hazar@example.com", role: "CURATOR" }]);

    const res = await app.inject({
      method: "GET",
      url: "/admin/users?search=hazar",
      headers: { "x-test-role": "admin" },
    });

    expect(res.statusCode).toBe(200);
    expect(service.search).toHaveBeenCalledWith("hazar");
    expect(JSON.parse(res.body)).toEqual([{ id: USER_ID, email: "hazar@example.com", role: "CURATOR" }]);
  });

  it("rejects a search term shorter than 2 characters with 400 before reaching the service", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/users?search=h",
      headers: { "x-test-role": "admin" },
    });

    expect(res.statusCode).toBe(400);
    expect(service.search).not.toHaveBeenCalled();
  });

  it("blocks a curator from searching users (admin-only)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/users?search=hazar",
      headers: { "x-test-role": "curator" },
    });

    expect(res.statusCode).toBe(403);
    expect(service.search).not.toHaveBeenCalled();
  });
});
