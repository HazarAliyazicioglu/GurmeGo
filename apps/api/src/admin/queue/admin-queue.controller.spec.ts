import { ArgumentMetadata, ParseUUIDPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AdminQueueController } from "./admin-queue.controller";
import { AdminQueueService } from "./admin-queue.service";

const QUEUE_ITEM_ID = "d290f1ee-6c54-4b01-90e6-d701748f0854";

describe("UUID path-param validation", () => {
  // Exercises the real ParseUUIDPipe class (round 3's finding: calling a controller method
  // directly bypasses Nest's pipe execution entirely). Same instance/config is applied
  // identically across admin-queue, admin-users, admin-venues, favorites, and reports
  // controllers below -- this one canonical test is not repeated for each.
  it("ParseUUIDPipe rejects a non-UUID id with a 400-mapped exception", async () => {
    const pipe = new ParseUUIDPipe({ errorHttpStatusCode: 400 });
    await expect(pipe.transform("not-a-uuid", { type: "param", data: "id" } satisfies ArgumentMetadata)).rejects.toThrow();
  });
  it("ParseUUIDPipe accepts a real UUID", async () => {
    const pipe = new ParseUUIDPipe({ errorHttpStatusCode: 400 });
    await expect(
      pipe.transform("d290f1ee-6c54-4b01-90e6-d701748f0851", { type: "param", data: "id" } satisfies ArgumentMetadata),
    ).resolves.toBe("d290f1ee-6c54-4b01-90e6-d701748f0851");
  });
});

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
    service.approve.mockResolvedValue({ id: QUEUE_ITEM_ID, status: "APPROVED" });

    const res = await app.inject({
      method: "POST",
      url: `/admin/queue/${QUEUE_ITEM_ID}/approve`,
      headers: { "x-test-role": "admin" },
    });

    expect(res.statusCode).toBe(201);
    expect(service.approve).toHaveBeenCalledWith(QUEUE_ITEM_ID, "test-user");
  });

  it("rejects a non-UUID id with 400 before reaching the service", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/admin/queue/not-a-uuid/approve",
      headers: { "x-test-role": "admin" },
    });

    expect(res.statusCode).toBe(400);
    expect(service.approve).not.toHaveBeenCalled();
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
