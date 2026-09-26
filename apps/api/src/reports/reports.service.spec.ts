import { ReportsService } from "./reports.service";

describe("ReportsService.submit", () => {
  it("writes a REPORT contribution and flags urgent at 3+ pending reports", async () => {
    const prisma = {
      venue: { findUnique: jest.fn().mockResolvedValue({ id: "v1" }) },
      contributionQueue: {
        create: jest.fn().mockResolvedValue({ id: "c1" }),
        count: jest.fn().mockResolvedValue(3),
      },
    } as any;
    const service = new ReportsService(prisma);

    const result = await service.submit("v1", { reason: "Fiyat yanlış görünüyor" });

    expect(prisma.venue.findUnique).toHaveBeenCalledWith({ where: { id: "v1" }, select: { id: true } });
    expect(prisma.contributionQueue.create).toHaveBeenCalledWith({
      data: { type: "REPORT", venueId: "v1", payload: { reason: "Fiyat yanlış görünüyor" }, submittedBy: null },
    });
    expect(result.urgent).toBe(true);
  });

  it("includes field/suggestedValue in the payload when the report is a structured correction", async () => {
    const prisma = {
      venue: { findUnique: jest.fn().mockResolvedValue({ id: "v1" }) },
      contributionQueue: { create: jest.fn().mockResolvedValue({ id: "c1" }), count: jest.fn().mockResolvedValue(1) },
    } as any;
    const service = new ReportsService(prisma);

    await service.submit("v1", { reason: "Fiyat aralığı güncel değil", field: "Fiyat aralığı", suggestedValue: "MID" });

    expect(prisma.contributionQueue.create).toHaveBeenCalledWith({
      data: {
        type: "REPORT", venueId: "v1", submittedBy: null,
        payload: { reason: "Fiyat aralığı güncel değil", field: "Fiyat aralığı", suggestedValue: "MID" },
      },
    });
  });

  it("throws a clean 404 (not an FK-violation 500) when venueId is well-formed but no such venue exists (regression: was reaching contributionQueue.create() and failing the FK constraint)", async () => {
    const prisma = {
      venue: { findUnique: jest.fn().mockResolvedValue(null) },
      contributionQueue: { create: jest.fn(), count: jest.fn() },
    } as any;
    const service = new ReportsService(prisma);

    try {
      await service.submit("missing-venue-id", { reason: "test" });
      throw new Error("expected submit to throw");
    } catch (err: any) {
      expect(err.getResponse()).toEqual({ error: { code: "VENUE_NOT_FOUND", message: "Mekan bulunamadı" } });
      expect(err.getResponse().message).toBeUndefined();
      expect(err.message).toBe("Mekan bulunamadı");
    }
    expect(prisma.contributionQueue.create).not.toHaveBeenCalled();
  });

  it("accepts a report against a non-PUBLISHED venue (DRAFT/ARCHIVED) -- existence is checked, not publish status", async () => {
    const prisma = {
      venue: { findUnique: jest.fn().mockResolvedValue({ id: "v1" }) },
      contributionQueue: {
        create: jest.fn().mockResolvedValue({ id: "c1" }),
        count: jest.fn().mockResolvedValue(1),
      },
    } as any;
    const service = new ReportsService(prisma);

    const result = await service.submit("v1", { reason: "eski bilgi" });

    expect(prisma.contributionQueue.create).toHaveBeenCalled();
    expect(result.urgent).toBe(false);
  });
});
