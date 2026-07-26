import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";

const USER_ID = "d290f1ee-6c54-4b01-90e6-d701748f0853";

describe("AdminUsersController (e2e) — RolesGuard", () => {
  let app: NestFastifyApplication;
  let service: { assignRole: jest.Mock };

  beforeAll(async () => {
    service = { assignRole: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [{ provide: AdminUsersService, useValue: service }],
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
    expect(service.assignRole).toHaveBeenCalledWith(USER_ID, "curator");
  });

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
