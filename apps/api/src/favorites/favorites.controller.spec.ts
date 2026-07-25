import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { FavoritesController } from "./favorites.controller";
import { FavoritesService } from "./favorites.service";
import { CACHE_STORE } from "../common/cache-store.interface";

describe("FavoritesController (e2e) — RolesGuard", () => {
  let app: NestFastifyApplication;
  let service: { listLists: jest.Mock; createList: jest.Mock; addVenue: jest.Mock };
  let cacheStore: { increment: jest.Mock };

  beforeAll(async () => {
    service = { listLists: jest.fn(), createList: jest.fn(), addVenue: jest.fn() };
    cacheStore = { increment: jest.fn().mockResolvedValue(1) };

    const moduleRef = await Test.createTestingModule({
      controllers: [FavoritesController],
      providers: [
        { provide: FavoritesService, useValue: service },
        { provide: CACHE_STORE, useValue: cacheStore },
      ],
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
    service.listLists.mockReset();
    service.createList.mockReset();
    service.addVenue.mockReset();
  });

  it("allows an authenticated user to list their favorite lists", async () => {
    service.listLists.mockResolvedValue([{ id: "l1", name: "Kadıköy turu" }]);

    const res = await app.inject({ method: "GET", url: "/me/lists", headers: { "x-test-role": "user" } });

    expect(res.statusCode).toBe(200);
    expect(service.listLists).toHaveBeenCalledWith("test-user");
  });

  it("blocks an unauthenticated request with 403 (RolesGuard denial, not a 500 crash)", async () => {
    const res = await app.inject({ method: "GET", url: "/me/lists" });

    expect(res.statusCode).toBe(403);
    expect(service.listLists).not.toHaveBeenCalled();
  });
});
