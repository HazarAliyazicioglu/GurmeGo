import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { BboxQuerySchema } from "@gurmego/shared";
import { VenuesController } from "./venues.controller";
import { VenuesService } from "./venues.service";
import { RateLimitGuard } from "../common/rate-limit.guard";
import { CACHE_STORE } from "../common/cache-store.interface";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

describe("VenuesController (e2e)", () => {
  let app: NestFastifyApplication;
  let service: { list: jest.Mock };
  let store: { increment: jest.Mock };

  beforeAll(async () => {
    service = { list: jest.fn() };
    store = { increment: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [VenuesController],
      providers: [
        { provide: VenuesService, useValue: service },
        RateLimitGuard,
        { provide: CACHE_STORE, useValue: store },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    service.list.mockReset();
    store.increment.mockReset();
    store.increment.mockResolvedValue(1);
  });

  it("returns the service result for a valid query", async () => {
    const envelope = { data: [{ id: "v1" }], meta: { next_cursor: null, has_more: false } };
    service.list.mockResolvedValue(envelope);

    const res = await app.inject({ method: "GET", url: "/venues?sort=newest&limit=20" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(envelope);
    expect(service.list).toHaveBeenCalledTimes(1);
    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ sort: "newest", limit: 20 }), undefined);
  });

  it("rejects an invalid priceRange with a 400 before reaching the service", async () => {
    const res = await app.inject({ method: "GET", url: "/venues?priceRange=NOT_A_RANGE" });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(service.list).not.toHaveBeenCalled();
  });

  it("rejects a limit above the schema max with a 400 before reaching the service", async () => {
    const res = await app.inject({ method: "GET", url: "/venues?limit=51" });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(service.list).not.toHaveBeenCalled();
  });

  it("passes the X-User-Location header as the second argument alongside the validated query", async () => {
    const envelope = { data: [], meta: { next_cursor: null, has_more: false } };
    service.list.mockResolvedValue(envelope);

    const res = await app.inject({
      method: "GET",
      url: "/venues?limit=5",
      headers: { "x-user-location": "40.99,29.02" },
    });

    expect(res.statusCode).toBe(200);
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5 }),
      { lat: 40.99, lng: 29.02 },
    );
  });
});

describe("mapView bbox validation via ZodValidationPipe", () => {
  it("throws on a malformed bbox", () => {
    expect(() => new ZodValidationPipe(BboxQuerySchema).transform({ bbox: "not,numbers,here" })).toThrow();
  });
});

describe("VenuesController.list — pipe scoping doesn't corrupt the location param", () => {
  it("passes the validated query and the raw location object through unmangled", async () => {
    const venuesService = { list: jest.fn().mockResolvedValue({ items: [], nextCursor: null }) } as any;
    const controller = new VenuesController(venuesService);
    await controller.list({ limit: 20 } as any, { lat: 40.99, lng: 29.02 });
    expect(venuesService.list).toHaveBeenCalledWith({ limit: 20 }, { lat: 40.99, lng: 29.02 });
  });
});
