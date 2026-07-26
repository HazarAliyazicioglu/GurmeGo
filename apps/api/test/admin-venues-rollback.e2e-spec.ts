import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { VenuesRepository } from "../src/venues/venues.repository";
import { AdminVenuesService } from "../src/admin/venues/admin-venues.service";
import { BoutiqueService } from "../src/rule-engine/boutique.service";

describe("AdminVenuesService.update — real rollback", () => {
  let prisma: PrismaClient;
  let venuesRepository: VenuesRepository;
  let adminVenuesService: AdminVenuesService;
  let seededVenueIds: string[] = [];

  beforeAll(() => {
    prisma = new PrismaService();
    venuesRepository = new VenuesRepository(prisma as unknown as PrismaService);
    adminVenuesService = new AdminVenuesService(prisma as unknown as PrismaService, new BoutiqueService(), venuesRepository);
  });

  afterEach(async () => {
    if (seededVenueIds.length > 0) {
      await prisma.venueVersion.deleteMany({ where: { venueId: { in: seededVenueIds } } });
      await prisma.venue.deleteMany({ where: { id: { in: seededVenueIds } } });
      seededVenueIds = [];
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("does not persist a VenueVersion snapshot when updateWithLocation fails mid-transaction", async () => {
    const district = await prisma.district.findFirstOrThrow();
    const venue = await venuesRepository.createWithLocation(prisma, {
      name: "Rollback Test Venue", slug: `rollback-test-${Date.now()}`, districtId: district.id,
      category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: {},
      isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
      verifiedAt: new Date(), status: "DRAFT", lat: 40.99, lng: 29.02,
    });
    seededVenueIds.push(venue.id);
    const versionsBefore = await prisma.venueVersion.count({ where: { venueId: venue.id } });
    // An invalid districtId FK forces updateWithLocation's UPDATE statement to fail after the
    // snapshot has already been created inside the same transaction -- this is the exact ordering
    // update() uses in production.
    await expect(adminVenuesService.update(venue.id, { districtId: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow();
    const versionsAfter = await prisma.venueVersion.count({ where: { venueId: venue.id } });
    expect(versionsAfter).toBe(versionsBefore);
  });
});
