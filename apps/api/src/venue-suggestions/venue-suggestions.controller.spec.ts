import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { VenueSuggestionsController } from "./venue-suggestions.controller";
import { VenueSuggestionsService } from "./venue-suggestions.service";
import { RateLimitGuard } from "../common/rate-limit.guard";
import { CACHE_STORE } from "../common/cache-store.interface";

describe("VenueSuggestionsController (e2e)", () => {
  let app: NestFastifyApplication;
  let service: { submit: jest.Mock };
  let store: { increment: jest.Mock };

  beforeAll(async () => {
    service = { submit: jest.fn() };
    store = { increment: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [VenueSuggestionsController],
      providers: [
        { provide: VenueSuggestionsService, useValue: service },
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
    service.submit.mockReset();
    store.increment.mockReset();
    store.increment.mockResolvedValue(1);
  });

  it("accepts a valid suggestion and returns the service result", async () => {
    service.submit.mockResolvedValue({ ok: true });

    const res = await app.inject({
      method: "POST",
      url: "/venue-suggestions",
      payload: { name: "Moda Kahvecisi", districtSlug: "kadikoy", category: "cafe" },
      headers: { "content-type": "application/json" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true });
    expect(service.submit).toHaveBeenCalledWith({ name: "Moda Kahvecisi", districtSlug: "kadikoy", category: "cafe" });
  });

  it("rejects an invalid payload with a 400 before reaching the service", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/venue-suggestions",
      payload: { name: "X", districtSlug: "kadikoy", category: "cafe" },
      headers: { "content-type": "application/json" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(service.submit).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when the rate limit is exceeded", async () => {
    store.increment.mockResolvedValue(11);

    const res = await app.inject({
      method: "POST",
      url: "/venue-suggestions",
      payload: { name: "Moda Kahvecisi", districtSlug: "kadikoy", category: "cafe" },
      headers: { "content-type": "application/json" },
    });

    expect(res.statusCode).toBe(429);
    expect(res.headers["retry-after"]).toBe("86400");
    expect(service.submit).not.toHaveBeenCalled();
  });
});
