import { ReportsService } from "./reports.service";

describe("ReportsService.submit", () => {
  it("writes a REPORT contribution and flags urgent at 3+ pending reports", async () => {
    const prisma = {
      contributionQueue: {
        create: jest.fn().mockResolvedValue({ id: "c1" }),
        count: jest.fn().mockResolvedValue(3),
      },
    } as any;
    const service = new ReportsService(prisma);

    const result = await service.submit("v1", { reason: "Fiyat yanlış görünüyor" });

    expect(prisma.contributionQueue.create).toHaveBeenCalledWith({
      data: { type: "REPORT", venueId: "v1", payload: { reason: "Fiyat yanlış görünüyor" }, submittedBy: null },
    });
    expect(result.urgent).toBe(true);
  });
});
