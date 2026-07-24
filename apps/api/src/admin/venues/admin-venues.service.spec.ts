import { AdminVenuesService } from "./admin-venues.service";

describe("AdminVenuesService.create", () => {
  it("computes isBoutique via BoutiqueService before saving", async () => {
    const prisma = { venue: { create: jest.fn().mockResolvedValue({ id: "v1" }) } } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(true) } as any;
    const service = new AdminVenuesService(prisma, boutique);

    await service.create({
      name: "A", slug: "a", districtId: "d1", category: "cafe", priceRange: "MODERATE",
      signatureItems: [], openingHours: {}, editorialNote: "iyi mekan", branchCount: 1, franchiseFlag: false,
    } as any);

    expect(boutique.evaluate).toHaveBeenCalledWith({ branchCount: 1, franchiseFlag: false, hasEditorialNote: true });
    expect(prisma.venue.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isBoutique: true, verifiedAt: expect.any(Date) }) }),
    );
  });
});

describe("AdminVenuesService.update", () => {
  it("re-evaluates isBoutique on update, same as create", async () => {
    const prisma = { venue: { update: jest.fn().mockResolvedValue({ id: "v1" }) } } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const service = new AdminVenuesService(prisma, boutique);

    await service.update("v1", { branchCount: 5, franchiseFlag: false, editorialNote: "not" } as any);

    expect(boutique.evaluate).toHaveBeenCalledWith({ branchCount: 5, franchiseFlag: false, hasEditorialNote: true });
    expect(prisma.venue.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: expect.objectContaining({ branchCount: 5, isBoutique: false }),
    });
  });
});
