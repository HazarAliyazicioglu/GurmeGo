import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { VenuesController } from "./venues.controller";
import { VenuesService } from "./venues.service";

describe("VenuesController (e2e)", () => {
  let app: NestFastifyApplication;
  let service: { list: jest.Mock };

  beforeAll(async () => {
    service = { list: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [VenuesController],
      providers: [{ provide: VenuesService, useValue: service }],
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
  });

  it("returns the service result for a valid query", async () => {
    const envelope = { data: [{ id: "v1" }], meta: { next_cursor: null, has_more: false } };
    service.list.mockResolvedValue(envelope);

    const res = await app.inject({ method: "GET", url: "/venues?sort=newest&limit=20" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(envelope);
    expect(service.list).toHaveBeenCalledTimes(1);
    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ sort: "newest", limit: 20 }));
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
});
