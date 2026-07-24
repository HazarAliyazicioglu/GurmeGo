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

describe("AdminVenuesService.revert", () => {
  it("applies the version snapshot when the version belongs to the venue", async () => {
    const version = { id: "ver1", venueId: "v1", snapshot: { name: "Old Name" } };
    const prisma = {
      venueVersion: { findUniqueOrThrow: jest.fn().mockResolvedValue(version) },
      venue: { update: jest.fn().mockResolvedValue({ id: "v1", name: "Old Name" }) },
    } as any;
    const service = new AdminVenuesService(prisma, {} as any, {} as any);

    await service.revert("v1", "ver1");

    expect(prisma.venue.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: version.snapshot });
  });

  it("rejects and does not apply the update when the version belongs to a different venue", async () => {
    const version = { id: "ver1", venueId: "OTHER-VENUE", snapshot: { name: "Old Name" } };
    const prisma = {
      venueVersion: { findUniqueOrThrow: jest.fn().mockResolvedValue(version) },
      venue: { update: jest.fn().mockResolvedValue({}) },
    } as any;
    const service = new AdminVenuesService(prisma, {} as any, {} as any);

    await expect(service.revert("v1", "ver1")).rejects.toMatchObject({
      response: { error: { code: "VENUE_VERSION_NOT_FOUND" } },
    });

    expect(prisma.venue.update).not.toHaveBeenCalled();
  });
});

describe("AdminVenuesService.importRows", () => {
  it("creates new-slug rows, skips existing-slug rows, and reports district-not-found as a row error", async () => {
    const rows = [
      {
        name: "New Cafe",
        slug: "new-cafe",
        districtSlug: "kadikoy",
        category: "cafe",
        priceRange: "MODERATE" as const,
        branchCount: 1,
        franchiseFlag: false,
        lat: 40.99,
        lng: 29.02,
        openingHours: { mon_fri: "09:00-18:00" },
      },
      {
        name: "Existing Cafe",
        slug: "existing-cafe",
        districtSlug: "kadikoy",
        category: "cafe",
        priceRange: "MODERATE" as const,
        branchCount: 1,
        franchiseFlag: false,
        lat: 40.98,
        lng: 29.03,
        openingHours: { mon_fri: "09:00-18:00" },
      },
      {
        name: "Bad District",
        slug: "bad-district-venue",
        districtSlug: "nowhere",
        category: "cafe",
        priceRange: "MODERATE" as const,
        branchCount: 1,
        franchiseFlag: false,
        lat: 40.9,
        lng: 29.0,
        openingHours: { mon_fri: "09:00-18:00" },
      },
    ];
    const prisma = {
      district: {
        findUnique: jest.fn().mockImplementation(({ where: { slug } }: { where: { slug: string } }) =>
          slug === "kadikoy" ? Promise.resolve({ id: "d1", slug: "kadikoy" }) : Promise.resolve(null),
        ),
      },
      venue: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null) // new-cafe: doesn't exist yet
          .mockResolvedValueOnce({ id: "v-existing" }), // existing-cafe: already exists
      },
    } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const venuesRepository = { createWithLocation: jest.fn().mockResolvedValue({ id: "v1" }) } as any;
    const service = new AdminVenuesService(prisma, boutique, venuesRepository);

    const result = await service.importRows(rows);

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.rowErrors).toEqual([{ row: 3, message: expect.stringContaining("ilçe") }]);
    expect(venuesRepository.createWithLocation).toHaveBeenCalledTimes(1);
    expect(venuesRepository.createWithLocation).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "new-cafe", districtId: "d1", signatureItems: [] }),
    );
  });
});
