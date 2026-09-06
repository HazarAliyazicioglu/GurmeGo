import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { VenuesRepository } from "../src/venues/venues.repository";

// Proves the MAJOR-severity finding from the pre-merge review: `searchPublished` generated a
// `nextCursor` but never actually filtered by an incoming `cursor` -- so a client paging through
// results got the exact same first page back every time. This must hold for BOTH sort modes,
// since "distance" needs the last row's distance value (not just its id) to resume correctly.
describe("VenuesRepository.searchPublished — cursor pagination actually advances", () => {
  let prisma: PrismaClient;
  let repo: VenuesRepository;
  let seededVenueIds: string[] = [];
  const testCategory = `cursor-test-${Date.now()}`;

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

  it("sort=newest: cursor from page 1 yields page 2, not a repeat of page 1", async () => {
    const district = await prisma.district.findFirstOrThrow();
    const names = ["Cursor Newest A", "Cursor Newest B", "Cursor Newest C"];
    for (const name of names) {
      const venue = await repo.createWithLocation(prisma, {
        name, slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}-${Math.random()}`,
        districtId: district.id, category: testCategory, priceRange: "MODERATE", signatureItems: [],
        openingHours: {}, isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
        verifiedAt: new Date(), status: "PUBLISHED", lat: 40.99, lng: 29.02,
      });
      seededVenueIds.push(venue.id);
      // Guarantee distinct createdAt ordering even at coarse DB timestamp resolution -- the fix's
      // correctness (id tiebreak) is covered separately; this test is about cursor advancement.
      await new Promise((r) => setTimeout(r, 10));
    }

    const page1 = await repo.searchPublished({ sort: "newest", limit: 1, category: testCategory } as any);
    expect(page1.items).toHaveLength(1);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await repo.searchPublished({ sort: "newest", limit: 1, category: testCategory, cursor: page1.nextCursor! } as any);
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0].id).not.toBe(page1.items[0].id);
    expect(page2.nextCursor).not.toBeNull();

    const page3 = await repo.searchPublished({ sort: "newest", limit: 1, category: testCategory, cursor: page2.nextCursor! } as any);
    expect(page3.items).toHaveLength(1);
    expect(page3.items[0].id).not.toBe(page1.items[0].id);
    expect(page3.items[0].id).not.toBe(page2.items[0].id);
    expect(page3.nextCursor).toBeNull();

    // Full pass with no cursor at all returns all 3 in the same order the three individual pages did.
    const wholeSet = await repo.searchPublished({ sort: "newest", limit: 10, category: testCategory } as any);
    expect(wholeSet.items.map((i) => i.id)).toEqual([page1.items[0].id, page2.items[0].id, page3.items[0].id]);
  });

  it("sort=distance: cursor from page 1 (nearest) yields page 2 (next-nearest), using the last row's distance, not just its id", async () => {
    const district = await prisma.district.findFirstOrThrow();
    // Reference point + three venues at strictly increasing distance north of it.
    const refLat = 40.99;
    const refLng = 29.02;
    const offsets = [0.001, 0.01, 0.05]; // ~110m, ~1.1km, ~5.5km apart in latitude
    const venues: { id: string; lat: number }[] = [];
    for (const offset of offsets) {
      const lat = refLat + offset;
      const venue = await repo.createWithLocation(prisma, {
        name: `Cursor Distance ${offset}`, slug: `cursor-distance-${offset}-${Date.now()}-${Math.random()}`,
        districtId: district.id, category: testCategory, priceRange: "MODERATE", signatureItems: [],
        openingHours: {}, isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
        verifiedAt: new Date(), status: "PUBLISHED", lat, lng: refLng,
      });
      seededVenueIds.push(venue.id);
      venues.push({ id: venue.id, lat });
    }

    const page1 = await repo.searchPublished({ sort: "distance", limit: 1, category: testCategory, lat: refLat, lng: refLng } as any);
    expect(page1.items).toHaveLength(1);
    expect(page1.items[0].id).toBe(venues[0].id); // nearest first
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await repo.searchPublished({ sort: "distance", limit: 1, category: testCategory, lat: refLat, lng: refLng, cursor: page1.nextCursor! } as any);
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0].id).toBe(venues[1].id); // next-nearest, not a repeat of page 1

    const page3 = await repo.searchPublished({ sort: "distance", limit: 1, category: testCategory, lat: refLat, lng: refLng, cursor: page2.nextCursor! } as any);
    expect(page3.items).toHaveLength(1);
    expect(page3.items[0].id).toBe(venues[2].id);
    expect(page3.nextCursor).toBeNull();
  });

  it("a malformed cursor is ignored (fail-open: returns page 1) rather than throwing", async () => {
    const district = await prisma.district.findFirstOrThrow();
    const venue = await repo.createWithLocation(prisma, {
      name: "Cursor Malformed Target", slug: `cursor-malformed-${Date.now()}`, districtId: district.id,
      category: testCategory, priceRange: "MODERATE", signatureItems: [], openingHours: {},
      isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL", verifiedAt: new Date(),
      status: "PUBLISHED", lat: 40.99, lng: 29.02,
    });
    seededVenueIds.push(venue.id);

    const result = await repo.searchPublished({ sort: "newest", limit: 10, category: testCategory, cursor: "not-valid-base64-json!!!" } as any);
    expect(result.items.map((i) => i.id)).toContain(venue.id);
  });
});
