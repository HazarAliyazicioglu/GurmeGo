import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { RateLimitGuard } from "../common/rate-limit.guard";
import { CACHE_STORE } from "../common/cache-store.interface";

const VENUE_ID = "d290f1ee-6c54-4b01-90e6-d701748f0851";

describe("ReportsController (e2e)", () => {
  let app: NestFastifyApplication;
  let service: { submit: jest.Mock };
  let store: { increment: jest.Mock };

  beforeAll(async () => {
    service = { submit: jest.fn() };
    store = { increment: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        { provide: ReportsService, useValue: service },
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

  it("accepts a valid report and returns the service result", async () => {
    service.submit.mockResolvedValue({ urgent: false });

    const res = await app.inject({
      method: "POST",
      url: `/venues/${VENUE_ID}/report`,
      payload: { reason: "Fiyat yanlış görünüyor" },
      headers: { "content-type": "application/json" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ urgent: false });
    expect(service.submit).toHaveBeenCalledWith(VENUE_ID, { reason: "Fiyat yanlış görünüyor" });
  });

  it("rejects a non-UUID venue id with 400 before reaching the service", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/venues/not-a-uuid/report",
      payload: { reason: "Fiyat yanlış görünüyor" },
      headers: { "content-type": "application/json" },
    });

    expect(res.statusCode).toBe(400);
    expect(service.submit).not.toHaveBeenCalled();
  });

  it("rejects an invalid payload with a 400 before reaching the service", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/venues/${VENUE_ID}/report`,
      payload: { reason: "kısa" },
      headers: { "content-type": "application/json" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(service.submit).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when the rate limit is exceeded", async () => {
    store.increment.mockResolvedValue(11); // exceeds @RateLimit(10, 86400) on the handler

    const res = await app.inject({
      method: "POST",
      url: `/venues/${VENUE_ID}/report`,
      payload: { reason: "Fiyat yanlış görünüyor" },
      headers: { "content-type": "application/json" },
    });

    expect(res.statusCode).toBe(429);
    expect(res.headers["retry-after"]).toBe("86400");
    expect(res.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
    expect(service.submit).not.toHaveBeenCalled();
  });
});
