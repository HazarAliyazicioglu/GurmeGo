import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AdminExportController } from "./admin-export.controller";
import { AdminReportsService } from "./reports/admin-reports.service";

describe("AdminExportController (e2e) — RolesGuard", () => {
  let app: NestFastifyApplication;
  let service: { exportVenues: jest.Mock };

  beforeAll(async () => {
    service = { exportVenues: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminExportController],
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
    service.exportVenues.mockReset();
  });

  it("allows a curator to access the export endpoint", async () => {
    service.exportVenues.mockResolvedValue("[]");

    const res = await app.inject({ method: "GET", url: "/admin/export?format=json", headers: { "x-test-role": "curator" } });

    expect(res.statusCode).toBe(200);
    expect(service.exportVenues).toHaveBeenCalledWith("json");
  });

  it("allows an admin to access the export endpoint", async () => {
    service.exportVenues.mockResolvedValue("id,name");

    const res = await app.inject({ method: "GET", url: "/admin/export?format=csv", headers: { "x-test-role": "admin" } });

    expect(res.statusCode).toBe(200);
    expect(service.exportVenues).toHaveBeenCalledWith("csv");
  });

  it("blocks a plain user from accessing the export endpoint", async () => {
    const res = await app.inject({ method: "GET", url: "/admin/export", headers: { "x-test-role": "user" } });

    expect(res.statusCode).toBe(403);
    expect(service.exportVenues).not.toHaveBeenCalled();
  });

  it("blocks an unauthenticated request", async () => {
    const res = await app.inject({ method: "GET", url: "/admin/export" });

    expect(res.statusCode).toBe(401);
    expect(service.exportVenues).not.toHaveBeenCalled();
  });
});
