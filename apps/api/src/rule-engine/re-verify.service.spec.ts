import { Test } from "@nestjs/testing";
import { SchedulerRegistry, ScheduleModule } from "@nestjs/schedule";
import { ReVerifyService } from "./re-verify.service";
import { PrismaService } from "../prisma/prisma.service";

describe("ReVerifyService.enqueueStale", () => {
  it("creates EDIT-type re_verify contributions for venues older than RULES_STALE_DAYS, skipping existing pending ones", async () => {
    process.env.RULES_STALE_DAYS = "90";
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
    const app = moduleRef.createNestApplication();
    await app.init();
    expect(app.get(SchedulerRegistry).getCronJob("re-verify-stale")).toBeDefined();
    await app.close();
  });
});
