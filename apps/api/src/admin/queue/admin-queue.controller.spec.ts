import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AdminQueueController } from "./admin-queue.controller";
import { AdminQueueService } from "./admin-queue.service";

describe("AdminQueueController (e2e) — RolesGuard", () => {
  let app: NestFastifyApplication;
  let service: { list: jest.Mock; approve: jest.Mock; reject: jest.Mock };

  beforeAll(async () => {
    service = { list: jest.fn(), approve: jest.fn(), reject: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminQueueController],
      providers: [{ provide: AdminQueueService, useValue: service }],
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
    service.list.mockReset();
    service.approve.mockReset();
    service.reject.mockReset();
  });

  it("allows a curator to list the queue", async () => {
    service.list.mockResolvedValue([]);

    const res = await app.inject({ method: "GET", url: "/admin/queue", headers: { "x-test-role": "curator" } });

    expect(res.statusCode).toBe(200);
    expect(service.list).toHaveBeenCalled();
  });

  it("allows an admin to approve an item", async () => {
    service.approve.mockResolvedValue({ id: "c1", status: "APPROVED" });

    const res = await app.inject({ method: "POST", url: "/admin/queue/c1/approve", headers: { "x-test-role": "admin" } });

    expect(res.statusCode).toBe(201);
    expect(service.approve).toHaveBeenCalledWith("c1", "test-user");
  });

  it("blocks a plain user from listing the queue", async () => {
    const res = await app.inject({ method: "GET", url: "/admin/queue", headers: { "x-test-role": "user" } });

    expect(res.statusCode).toBe(403);
    expect(service.list).not.toHaveBeenCalled();
  });

  it("blocks an unauthenticated request", async () => {
    const res = await app.inject({ method: "GET", url: "/admin/queue" });

    expect(res.statusCode).toBe(403);
    expect(service.list).not.toHaveBeenCalled();
  });
});
