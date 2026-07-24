import { AdminVenuesService } from "./admin-venues.service";

const VALID_CREATE_INPUT = {
  name: "A",
  slug: "a",
  districtId: "d1",
  category: "cafe",
  priceRange: "MODERATE",
  signatureItems: [],
  openingHours: {},
  editorialNote: "iyi mekan",
  branchCount: 1,
  franchiseFlag: false,
  lat: 41.0,
  lng: 29.0,
} as any;

describe("AdminVenuesService.create", () => {
  it("computes isBoutique via BoutiqueService and delegates to VenuesRepository.createWithLocation", async () => {
    const prisma = {} as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(true) } as any;
    const venuesRepository = { createWithLocation: jest.fn().mockResolvedValue({ id: "v1" }) } as any;
    const service = new AdminVenuesService(prisma, boutique, venuesRepository);

    await service.create(VALID_CREATE_INPUT);

    expect(boutique.evaluate).toHaveBeenCalledWith({ branchCount: 1, franchiseFlag: false, hasEditorialNote: true });
    expect(venuesRepository.createWithLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        isBoutique: true,
        verifiedAt: expect.any(Date),
        status: "DRAFT",
        source: "MANUAL",
        lat: 41.0,
        lng: 29.0,
      }),
    );
  });
});

describe("AdminVenuesService.update", () => {
  it("re-evaluates isBoutique on update, same as create, and delegates to VenuesRepository.updateWithLocation", async () => {
    const prisma = {} as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const venuesRepository = { updateWithLocation: jest.fn().mockResolvedValue({ id: "v1" }) } as any;
    const service = new AdminVenuesService(prisma, boutique, venuesRepository);

    await service.update("v1", { branchCount: 5, franchiseFlag: false, editorialNote: "not" } as any);

    expect(boutique.evaluate).toHaveBeenCalledWith({ branchCount: 5, franchiseFlag: false, hasEditorialNote: true });
    expect(venuesRepository.updateWithLocation).toHaveBeenCalledWith(
      "v1",
      expect.objectContaining({ branchCount: 5, isBoutique: false }),
    );
  });

  it("passes lat/lng through when supplied, so location can be recomputed", async () => {
    const prisma = {} as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const venuesRepository = { updateWithLocation: jest.fn().mockResolvedValue({ id: "v1" }) } as any;
    const service = new AdminVenuesService(prisma, boutique, venuesRepository);

    await service.update("v1", { lat: 41.1, lng: 29.1 } as any);

    expect(venuesRepository.updateWithLocation).toHaveBeenCalledWith(
      "v1",
      expect.objectContaining({ lat: 41.1, lng: 29.1 }),
    );
  });
});
