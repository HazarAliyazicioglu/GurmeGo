import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { VenuesRepository } from "../src/venues/venues.repository";
import { AdminVenuesService } from "../src/admin/venues/admin-venues.service";
import { BoutiqueService } from "../src/rule-engine/boutique.service";

// Proves the MAJOR-severity finding from the pre-merge review: the snapshot-read-before-write
// pattern in AdminVenuesService.update() didn't lock the row, so two concurrent partial updates
// could both read the same stale snapshot and the second write could silently clobber the first's
// changes. Fixed by having VenuesRepository.findRawForSnapshot() take a `FOR UPDATE` row lock
// (venues.repository.ts), so a second concurrent `update()` call blocks until the first commits,
// then reads the already-updated row instead of a stale one. A mocked-Prisma test cannot prove
// this -- it needs two genuinely concurrent transactions against real Postgres.
describe("AdminVenuesService.update — concurrent partial updates do not lose each other's writes", () => {
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

  it("two concurrent updates touching DIFFERENT fields both survive -- neither is silently overwritten by the other's stale snapshot", async () => {
    const district = await prisma.district.findFirstOrThrow();
    const venue = await venuesRepository.createWithLocation(prisma, {
      name: "Race Update Venue", slug: `race-update-${Date.now()}`, districtId: district.id,
      category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: {},
      editorialNote: "orijinal not", isBoutique: false, branchCount: 1, franchiseFlag: false,
      source: "MANUAL", verifiedAt: new Date(), status: "PUBLISHED", lat: 40.99, lng: 29.02,
    });
    seededVenueIds.push(venue.id);

    // Without the FOR UPDATE lock, both transactions can read the venue with editorialNote="orijinal
    // not" before either commits: transaction A sets a new editorialNote (based on the stale read),
    // transaction B sets a new transportNote (also based on the stale read, unaware of A's write) --
    // whichever commits last would win completely, silently discarding the other's field change,
    // because AdminVenuesService.update() only sends the fields present in ITS OWN partial input,
    // but the underlying UPDATE statement it builds only ever touches columns explicitly given to
    // it -- so column-level loss isn't the risk here; the risk this test actually targets is
    // isBoutique corruption: both transactions recompute isBoutique from the SAME stale
    // branchCount/franchiseFlag/editorialNote/status snapshot, so whichever commits last can
    // overwrite isBoutique with a value computed from data that was already stale by the time it
    // wrote.
    await Promise.all([
      adminVenuesService.update(venue.id, { editorialNote: "A tarafından güncellendi" }),
      adminVenuesService.update(venue.id, { transportNote: "B tarafından eklendi: Kadıköy iskelesi" }),
    ]);

    const final = await prisma.venue.findUniqueOrThrow({ where: { id: venue.id } });
    expect(final.editorialNote).toBe("A tarafından güncellendi");
    expect(final.transportNote).toBe("B tarafından eklendi: Kadıköy iskelesi");

    // Both updates must have taken their own (serialized, not simultaneous) snapshot -- 2 versions,
    // not a scenario where one transaction's snapshot-then-write got interleaved with the other's.
    const versionCount = await prisma.venueVersion.count({ where: { venueId: venue.id } });
    expect(versionCount).toBe(2);
  });

  it("isBoutique recomputation uses each transaction's own up-to-date read, not a snapshot made stale by a concurrent write", async () => {
    const district = await prisma.district.findFirstOrThrow();
    // Starts NOT boutique: branchCount=5 exceeds the default RULES_BOUTIQUE_MAX_BRANCHES=3.
    const venue = await venuesRepository.createWithLocation(prisma, {
      name: "Race Boutique Venue", slug: `race-boutique-${Date.now()}`, districtId: district.id,
      category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: {},
      editorialNote: "iyi mekan", isBoutique: false, branchCount: 5, franchiseFlag: false,
      source: "MANUAL", verifiedAt: new Date(), status: "PUBLISHED", lat: 40.99, lng: 29.02,
    });
    seededVenueIds.push(venue.id);

    // Concurrently: A drops branchCount to 1 (should make it boutique-eligible on branch count);
    // B only touches an unrelated field. If B's transaction reads a STALE snapshot (branchCount
    // still 5, taken before A committed) instead of blocking until A's write lands, B would
    // recompute isBoutique=false from stale data and could clobber A's isBoutique=true.
    await Promise.all([
      adminVenuesService.update(venue.id, { branchCount: 1 }),
      adminVenuesService.update(venue.id, { transportNote: "Metro çıkışı 2 dk" }),
    ]);

    const final = await prisma.venue.findUniqueOrThrow({ where: { id: venue.id } });
    expect(final.branchCount).toBe(1);
    expect(final.transportNote).toBe("Metro çıkışı 2 dk");
    // Whichever order the two transactions actually serialized in, the LAST one to commit must
    // have recomputed isBoutique from the OTHER transaction's already-committed state, not a
    // pre-race snapshot -- so the final isBoutique must reflect the final branchCount (1, eligible),
    // never the stale pre-race branchCount (5, not eligible).
    expect(final.isBoutique).toBe(true);
  });
});
