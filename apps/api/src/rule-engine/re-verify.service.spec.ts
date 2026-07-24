import { ReVerifyService } from "./re-verify.service";

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
