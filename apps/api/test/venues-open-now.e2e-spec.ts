import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { VenuesRepository } from "../src/venues/venues.repository";

describe("GET /venues?openNow=true — fail-open on malformed data", () => {
  let prisma: PrismaClient;
  let venuesRepository: VenuesRepository;
  let seededVenueIds: string[] = [];

  beforeAll(() => {
    prisma = new PrismaService();
    venuesRepository = new VenuesRepository(prisma as unknown as PrismaService);
  });

  afterEach(async () => {
    if (seededVenueIds.length > 0) {
      await prisma.venue.deleteMany({ where: { id: { in: seededVenueIds } } });
      seededVenueIds = [];
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("includes venues with unparseable or missing openingHours instead of excluding them", async () => {
    const district = await prisma.district.findFirstOrThrow();
    // ISODOW: 1=Monday...7=Sunday. Match the SQL's own bucket selection exactly so the malformed
    // value actually lands in the branch the query will evaluate today, on any day of the week.
    const isoDow = ((new Date().getDay() + 6) % 7) + 1; // JS getDay(): 0=Sunday -> ISODOW 7
    const todaysBucket: "mon_fri" | "sat_sun" = isoDow >= 1 && isoDow <= 5 ? "mon_fri" : "sat_sun";

    const malformed = await venuesRepository.createWithLocation(prisma, {
      name: "Malformed Hours Venue", slug: `malformed-hours-${Date.now()}`, districtId: district.id,
      category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: { [todaysBucket]: "kapalı" },
      isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
      verifiedAt: new Date(), status: "PUBLISHED", lat: 40.99, lng: 29.02,
    });
    const emptyString = await venuesRepository.createWithLocation(prisma, {
      name: "Empty String Hours Venue", slug: `empty-hours-${Date.now()}`, districtId: district.id,
      category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: { [todaysBucket]: "" },
      isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
      verifiedAt: new Date(), status: "PUBLISHED", lat: 40.99, lng: 29.02,
    });
    const outOfRange = await venuesRepository.createWithLocation(prisma, {
      name: "Out Of Range Hours Venue", slug: `oor-hours-${Date.now()}`, districtId: district.id,
      category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: { [todaysBucket]: "29:00-10:00" },
      isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
      verifiedAt: new Date(), status: "PUBLISHED", lat: 40.99, lng: 29.02,
    });
    const missing = await venuesRepository.createWithLocation(prisma, {
      name: "Missing Hours Venue", slug: `missing-hours-${Date.now()}`, districtId: district.id,
      category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: {},
      isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
      verifiedAt: new Date(), status: "PUBLISHED", lat: 40.99, lng: 29.02,
    });
    seededVenueIds.push(malformed.id, emptyString.id, outOfRange.id, missing.id);

    const { items } = await venuesRepository.searchPublished({ sort: "newest", limit: 50, openNow: true } as any);
    const ids = items.map((i: any) => i.id);
    expect(ids).toEqual(expect.arrayContaining([malformed.id, emptyString.id, outOfRange.id, missing.id]));
  });
});
