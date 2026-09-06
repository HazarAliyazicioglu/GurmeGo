import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { VenuesRepository } from "../src/venues/venues.repository";
import { ReVerifyService } from "../src/rule-engine/re-verify.service";

// Proves the MAJOR-severity finding from the pre-merge review: enqueueStale()'s "does a pending
// re-verify entry already exist" check and the insert were not atomic -- if the cron ran
// concurrently across multiple API instances, both could pass the check before either committed,
// producing duplicate `re_verify` ContributionQueue rows for the same venue. Fixed with a partial
// unique index (migration 20260727000000_add_contribution_queue_pending_edit_unique_index) plus a
// catch-and-skip on the resulting P2002. A mocked-Prisma test can't prove this -- it needs two
// genuinely concurrent calls against real Postgres.
describe("ReVerifyService.enqueueStale — concurrent cron runs do not create duplicate PENDING entries", () => {
  let prisma: PrismaClient;
  let venuesRepository: VenuesRepository;
  let service: ReVerifyService;
  let seededVenueIds: string[] = [];

  beforeAll(() => {
    prisma = new PrismaService();
    venuesRepository = new VenuesRepository(prisma as unknown as PrismaService);
    service = new ReVerifyService(prisma as unknown as PrismaService);
  });

  afterEach(async () => {
    if (seededVenueIds.length > 0) {
      await prisma.contributionQueue.deleteMany({ where: { venueId: { in: seededVenueIds } } });
      await prisma.venue.deleteMany({ where: { id: { in: seededVenueIds } } });
      seededVenueIds = [];
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("running enqueueStale() twice concurrently on the same stale venue creates exactly one PENDING re_verify entry", async () => {
    const district = await prisma.district.findFirstOrThrow();
    const staleDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000); // well past the 90-day default
    const venue = await venuesRepository.createWithLocation(prisma, {
      name: "Stale Race Venue", slug: `stale-race-${Date.now()}`, districtId: district.id,
      category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: {},
      isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
      verifiedAt: staleDate, status: "PUBLISHED", lat: 40.99, lng: 29.02,
    });
    seededVenueIds.push(venue.id);

    const [countA, countB] = await Promise.all([service.enqueueStale(), service.enqueueStale()]);

    // At most one of the two concurrent runs should report having created this venue's entry --
    // combined, exactly one row landed for it (the other either saw it already existing via the
    // fast-path check, or hit the unique-violation catch and skipped).
    expect(countA + countB).toBeGreaterThanOrEqual(1);

    const rows = await prisma.contributionQueue.findMany({
      where: { venueId: venue.id, type: "EDIT", status: "PENDING" },
    });
    expect(rows).toHaveLength(1);
  });

  it("does not affect REPORT contributions: multiple PENDING REPORT rows for the same venue remain legal (moderation depends on this)", async () => {
    const district = await prisma.district.findFirstOrThrow();
    const venue = await venuesRepository.createWithLocation(prisma, {
      name: "Report Coexist Venue", slug: `report-coexist-${Date.now()}`, districtId: district.id,
      category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: {},
      isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
      verifiedAt: new Date(), status: "PUBLISHED", lat: 40.99, lng: 29.02,
    });
    seededVenueIds.push(venue.id);

    await prisma.contributionQueue.create({ data: { type: "REPORT", venueId: venue.id, payload: { reason: "a" }, submittedBy: null, status: "PENDING" } });
    await prisma.contributionQueue.create({ data: { type: "REPORT", venueId: venue.id, payload: { reason: "b" }, submittedBy: null, status: "PENDING" } });
    await prisma.contributionQueue.create({ data: { type: "REPORT", venueId: venue.id, payload: { reason: "c" }, submittedBy: null, status: "PENDING" } });

    const pendingReports = await prisma.contributionQueue.count({ where: { venueId: venue.id, type: "REPORT", status: "PENDING" } });
    expect(pendingReports).toBe(3);
  });
});
