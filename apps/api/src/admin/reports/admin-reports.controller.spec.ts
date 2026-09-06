import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AdminReportsController } from "./admin-reports.controller";
import { AdminReportsService } from "./admin-reports.service";

describe("AdminReportsController (e2e) — RolesGuard", () => {
  let app: NestFastifyApplication;
  let service: { dataQuality: jest.Mock };

  beforeAll(async () => {
    service = { dataQuality: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminReportsController],
      providers: [{ provide: AdminReportsService, useValue: service }],
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
    service.dataQuality.mockReset();
  });

  it("allows a curator to access data-quality report", async () => {
    service.dataQuality.mockResolvedValue({ perDistrict: [], staleCount: 0, bySource: [] });

    const res = await app.inject({ method: "GET", url: "/admin/reports/data-quality", headers: { "x-test-role": "curator" } });

    expect(res.statusCode).toBe(200);
    expect(service.dataQuality).toHaveBeenCalled();
  });

  it("allows an admin to access data-quality report", async () => {
    service.dataQuality.mockResolvedValue({ perDistrict: [], staleCount: 0, bySource: [] });

    const res = await app.inject({ method: "GET", url: "/admin/reports/data-quality", headers: { "x-test-role": "admin" } });

    expect(res.statusCode).toBe(200);
    expect(service.dataQuality).toHaveBeenCalled();
  });

  it("blocks a plain user from accessing data-quality report", async () => {
    const res = await app.inject({ method: "GET", url: "/admin/reports/data-quality", headers: { "x-test-role": "user" } });

    expect(res.statusCode).toBe(403);
    expect(service.dataQuality).not.toHaveBeenCalled();
  });

  it("blocks an unauthenticated request", async () => {
    const res = await app.inject({ method: "GET", url: "/admin/reports/data-quality" });

    expect(res.statusCode).toBe(401);
    expect(service.dataQuality).not.toHaveBeenCalled();
  });
});
