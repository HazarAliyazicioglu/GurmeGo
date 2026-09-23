import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyMultipart from "@fastify/multipart";
import { AdminModule } from "./admin.module";
import { AdminQueueController } from "./queue/admin-queue.controller";
import { AdminQueueService } from "./queue/admin-queue.service";
import { AdminUsersController } from "./users/admin-users.controller";
import { AdminUsersService } from "./users/admin-users.service";
import { AdminVenuesController } from "./venues/admin-venues.controller";
import { AdminVenuesService } from "./venues/admin-venues.service";
import { CsvImportService } from "./venues/csv-import.service";
import { CACHE_STORE } from "../common/cache-store.interface";
import { RATE_LIMITS } from "../common/rate-limit.config";

// DENETIM-RAPORU Orta: admin endpoints had no rate limit. The budget is ONE shared counter per IP across
// the whole admin API (bucket "admin"), with a much stricter separate one for CSV import.
const USER_ID = "d290f1ee-6c54-4b01-90e6-d701748f0853";

function inMemoryStore() {
  const counts = new Map<string, number>();
  return {
    increment: jest.fn(async (key: string) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    }),
    keys: () => [...counts.keys()],
  };
}

async function buildApp() {
  const store = inMemoryStore();
  const moduleRef = await Test.createTestingModule({
    controllers: [AdminQueueController, AdminUsersController, AdminVenuesController],
    providers: [
      { provide: CACHE_STORE, useValue: store },
      { provide: AdminQueueService, useValue: { list: jest.fn().mockResolvedValue([]), approve: jest.fn(), reject: jest.fn() } },
      { provide: AdminUsersService, useValue: { assignRole: jest.fn().mockResolvedValue({}) } },
      { provide: AdminVenuesService, useValue: {} },
      { provide: CsvImportService, useValue: {} },
    ],
  }).compile();
  // `multipart: false` opts out of NestJS 12's own automatic @fastify/multipart registration
  // (see main.ts's createAdapter) so the explicit registration below is the only one that runs.
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter({ multipart: false }));
  await app.register(fastifyMultipart);
  app.getHttpAdapter().getInstance().addHook("onRequest", (req: any, _reply: any, done: () => void) => {
    const role = req.headers["x-test-role"];
    req.user = role ? { id: "test-user", role } : undefined;
    done();
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return { app, store };
}

const AS_ADMIN = { "x-test-role": "admin" };

describe("admin API rate limit", () => {
  let app: NestFastifyApplication;
  let store: ReturnType<typeof inMemoryStore>;

  beforeEach(async () => {
    ({ app, store } = await buildApp());
  });
  afterEach(async () => {
    await app.close();
  });

  it("counts different admin endpoints against ONE shared budget, then answers 429 with Retry-After", async () => {
    const limit = RATE_LIMITS.admin.limit;
    for (let i = 0; i < limit; i++) {
      // alternate two different endpoints: a per-handler counter would let both reach `limit` on their own
      const res =
        i % 2 === 0
          ? await app.inject({ method: "GET", url: "/admin/queue", headers: AS_ADMIN })
          : await app.inject({ method: "PUT", url: `/admin/users/${USER_ID}/roles`, headers: AS_ADMIN, payload: { role: "curator" } });
      expect(res.statusCode).toBeLessThan(400);
    }
    const over = await app.inject({ method: "GET", url: "/admin/queue", headers: AS_ADMIN });
    expect(over.statusCode).toBe(429);
    expect(over.headers["retry-after"]).toBe(String(RATE_LIMITS.admin.windowSeconds));
    expect(over.json()).toEqual({ error: { code: "RATE_LIMITED", message: "Çok fazla istek, daha sonra tekrar deneyin" } });
    expect(store.keys().filter((k) => k.startsWith("admin:"))).toHaveLength(1);
  });

  it("gives CSV import its own, stricter budget that does not spend the general admin budget", async () => {
    const importLimit = RATE_LIMITS.adminImport.limit;
    for (let i = 0; i < importLimit; i++) {
      const res = await app.inject({ method: "POST", url: "/admin/import", headers: AS_ADMIN });
      expect(res.statusCode).not.toBe(429);
    }
    expect((await app.inject({ method: "POST", url: "/admin/import", headers: AS_ADMIN })).statusCode).toBe(429);
    // the general admin API is untouched by import traffic
    expect((await app.inject({ method: "GET", url: "/admin/queue", headers: AS_ADMIN })).statusCode).toBe(200);
    expect(store.keys().some((k) => k.startsWith("admin-import:"))).toBe(true);
    expect(store.keys().filter((k) => k.startsWith("admin:"))).toHaveLength(1);
  });

  it("does not let unauthenticated or unauthorized requests spend the admin budget (RolesGuard runs first)", async () => {
    for (let i = 0; i < RATE_LIMITS.admin.limit + 5; i++) {
      const res = await app.inject({ method: "GET", url: "/admin/queue" });
      expect(res.statusCode).toBe(401);
    }
    expect(store.increment).not.toHaveBeenCalled();
    expect((await app.inject({ method: "GET", url: "/admin/queue", headers: AS_ADMIN })).statusCode).toBe(200);
  });
});

// Guards against a future admin controller being added without the shared limit: walks the real
// AdminModule graph instead of a hand-maintained list.
describe("every controller in AdminModule carries the shared admin rate limit", () => {
  const subModules: Array<new () => unknown> = Reflect.getMetadata("imports", AdminModule);
  const controllers: Array<new () => unknown> = subModules.flatMap((m) => Reflect.getMetadata("controllers", m) ?? []);

  it("discovers the admin controllers", () => {
    expect(controllers.length).toBeGreaterThanOrEqual(5);
  });

  it.each(controllers.map((c) => [c.name, c] as const))("%s", (_name, controller) => {
    expect(Reflect.getMetadata("rate-limit", controller)).toEqual({
      limit: RATE_LIMITS.admin.limit,
      windowSeconds: RATE_LIMITS.admin.windowSeconds,
      bucket: "admin",
    });
  });
});
