import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";

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
    // Test-only stand-in for JwtAuthMiddleware: sets req.user from a header instead of verifying a real JWT.
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
    service.assignRole.mockResolvedValue({ id: "u1", role: "CURATOR" });

    const res = await app.inject({
      method: "PUT",
      url: "/admin/users/u1/roles",
      headers: { "x-test-role": "admin" },
      payload: { role: "curator" },
    });

    expect(res.statusCode).toBe(200);
    expect(service.assignRole).toHaveBeenCalledWith("u1", "curator");
  });

  it("blocks a curator from assigning a role (admin-only, unlike other admin endpoints)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/admin/users/u1/roles",
      headers: { "x-test-role": "curator" },
      payload: { role: "curator" },
    });

    expect(res.statusCode).toBe(403);
    expect(service.assignRole).not.toHaveBeenCalled();
  });

  it("blocks a plain user from assigning a role", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/admin/users/u1/roles",
      headers: { "x-test-role": "user" },
      payload: { role: "curator" },
    });

    expect(res.statusCode).toBe(403);
    expect(service.assignRole).not.toHaveBeenCalled();
  });

  it("blocks an unauthenticated request", async () => {
    const res = await app.inject({ method: "PUT", url: "/admin/users/u1/roles", payload: { role: "curator" } });

    expect(res.statusCode).toBe(403);
    expect(service.assignRole).not.toHaveBeenCalled();
  });
});
