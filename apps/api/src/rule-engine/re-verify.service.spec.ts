import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { SchedulerRegistry, ScheduleModule } from "@nestjs/schedule";
import { ReVerifyService } from "./re-verify.service";
import { PrismaService } from "../prisma/prisma.service";

describe("ReVerifyService.enqueueStale", () => {
  it("creates EDIT-type re_verify contributions for venues older than RULES_STALE_DAYS, skipping existing pending ones", async () => {
    // RULES_STALE_DAYS is set to "90" by test/env-defaults.setup.ts before this file's static
    // import of rule-config.ts (via re-verify.service.ts) ever runs, so a per-test assignment
    // here would be a no-op (rule-config.ts reads and freezes the value at module load).
    const staleVenues = [{ id: "v1" }, { id: "v2" }];
    const prisma = {
      venue: { findMany: jest.fn().mockResolvedValue(staleVenues) },
      contributionQueue: {
        findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "existing" }),
        create: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const service = new ReVerifyService(prisma);

    const created = await service.enqueueStale();

    expect(created).toBe(1);
    expect(prisma.contributionQueue.create).toHaveBeenCalledTimes(1);
  });
});

describe("ReVerifyService — cron registration", () => {
  it("registers a named daily cron job", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ScheduleModule.forRoot()], providers: [ReVerifyService, { provide: PrismaService, useValue: {} }] }).compile();
    const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    expect(app.get(SchedulerRegistry).getCronJob("re-verify-stale")).toBeDefined();
    await app.close();
  });
});
