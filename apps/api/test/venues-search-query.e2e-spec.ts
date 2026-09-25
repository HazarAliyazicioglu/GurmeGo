import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { VenuesRepository } from "../src/venues/venues.repository";

// 2026-09-25 audit finding: web had no free-text search at all. Proves the `q` filter's ILIKE
// condition actually narrows the real Postgres result set (unit tests only assert the generated
// SQL text, not that Postgres executes it correctly).
describe("VenuesRepository.searchPublished — q (free-text search, real DB)", () => {
  let prisma: PrismaClient;
  let repo: VenuesRepository;
  let seededVenueIds: string[] = [];
  const testCategory = `search-test-${Date.now()}`;

  beforeAll(() => {
    prisma = new PrismaService();
    repo = new VenuesRepository(prisma as unknown as PrismaService);
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

  it("matches on name, cuisineType, or editorialNote, case-insensitively, and excludes non-matches", async () => {
    const district = await prisma.district.findFirstOrThrow();
    const seeds = [
      { name: "Kadıköy Kahve Evi", cuisineType: null, editorialNote: null },
      { name: "Bakkal Fırın", cuisineType: "italyan", editorialNote: null },
      { name: "Sessiz Köşe", cuisineType: null, editorialNote: "Harika KAHVE var burada." },
      { name: "Alakasız Mekan", cuisineType: "meksika", editorialNote: "Tamamen ilgisiz." },
    ];
    for (const seed of seeds) {
      const venue = await repo.createWithLocation(prisma, {
        name: seed.name, slug: `${seed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}-${Math.random()}`,
        districtId: district.id, category: testCategory, priceRange: "MODERATE", signatureItems: [],
        openingHours: {}, isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
        verifiedAt: new Date(), status: "PUBLISHED", lat: 40.99, lng: 29.02,
        cuisineType: seed.cuisineType, editorialNote: seed.editorialNote,
      } as any);
      seededVenueIds.push(venue.id);
    }

    const result = await repo.searchPublished({ sort: "newest", limit: 10, category: testCategory, q: "kahve" } as any);
    expect(result.items.map((i) => i.name).sort()).toEqual(["Kadıköy Kahve Evi", "Sessiz Köşe"].sort());
  });

  it("treats a literal % in the search term as a literal character, not a LIKE wildcard", async () => {
    const district = await prisma.district.findFirstOrThrow();
    const seeds = ["50% İndirimli Kafe", "Elli İndirimli Kafe"];
    for (const name of seeds) {
      const venue = await repo.createWithLocation(prisma, {
        name, slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}-${Math.random()}`,
        districtId: district.id, category: testCategory, priceRange: "MODERATE", signatureItems: [],
        openingHours: {}, isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
        verifiedAt: new Date(), status: "PUBLISHED", lat: 40.99, lng: 29.02,
      } as any);
      seededVenueIds.push(venue.id);
    }

    const result = await repo.searchPublished({ sort: "newest", limit: 10, category: testCategory, q: "50%" } as any);
    expect(result.items.map((i) => i.name)).toEqual(["50% İndirimli Kafe"]);
  });
});
