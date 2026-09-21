import { AuditService } from "../src/audit/audit.service";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { VenuesRepository } from "../src/venues/venues.repository";
import { AdminQueueService } from "../src/admin/queue/admin-queue.service";

// Proves the MAJOR-severity finding from the pre-merge review: approve()/reject() read a PENDING
// row and then did an unconditional update with no row lock or `WHERE status = 'PENDING'` guard,
// so two concurrent requests (two admin tabs, a double-click) could BOTH succeed on the same
// contribution -- e.g. an EDIT approval racing a REJECT, leaving reviewedBy/reviewedAt/status
// inconsistent. A mocked-Prisma test cannot prove a real concurrency fix (it can only assert on
// call shape); this exercises two genuinely concurrent transactions against real Postgres.
describe("AdminQueueService.approve/reject — concurrent calls on the same row", () => {
  let prisma: PrismaClient;
  let service: AdminQueueService;
  let seededContributionIds: string[] = [];

  beforeAll(() => {
    prisma = new PrismaService();
    const venuesRepository = new VenuesRepository(prisma as unknown as PrismaService);
    service = new AdminQueueService(prisma as unknown as PrismaService, venuesRepository, new AuditService());
  });

  afterEach(async () => {
    if (seededContributionIds.length > 0) {
      await prisma.contributionQueue.deleteMany({ where: { id: { in: seededContributionIds } } });
      seededContributionIds = [];
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("exactly one of a concurrent approve()+reject() pair succeeds; the other is rejected as already-processed, and the row ends in a consistent state", async () => {
    const contribution = await prisma.contributionQueue.create({
      data: { type: "REPORT", venueId: null, payload: { reason: "race test" }, submittedBy: null, status: "PENDING" },
    });
    seededContributionIds.push(contribution.id);

    const results = await Promise.allSettled([
      service.approve(contribution.id, "curator-a"),
      service.reject(contribution.id, "curator-b"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      response: { error: { code: "CONTRIBUTION_ALREADY_PROCESSED" } },
    });

    const final = await prisma.contributionQueue.findUniqueOrThrow({ where: { id: contribution.id } });
    // Whichever call won, the row must be in EXACTLY one terminal state -- not PENDING (both calls
    // ran), and its reviewedBy must match whichever call actually won (never a mix, e.g.
    // status=APPROVED but reviewedBy=the reject caller, which the pre-fix race could produce if
    // both writes landed in an unlucky interleaving).
    expect(["APPROVED", "REJECTED"]).toContain(final.status);
    const winner = final.status === "APPROVED" ? "curator-a" : "curator-b";
    expect(final.reviewedBy).toBe(winner);
  });

  it("running approve() twice concurrently on the same row: only one succeeds, the other sees CONTRIBUTION_ALREADY_PROCESSED (not a duplicate VenueVersion for an EDIT item)", async () => {
    const district = await prisma.district.findFirstOrThrow();
    const venuesRepository = new VenuesRepository(prisma as unknown as PrismaService);
    const venue = await venuesRepository.createWithLocation(prisma, {
      name: "Race Approve Venue", slug: `race-approve-${Date.now()}`, districtId: district.id,
      category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: {},
      isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
      verifiedAt: new Date(), status: "PUBLISHED", lat: 40.99, lng: 29.02,
    });
    const contribution = await prisma.contributionQueue.create({
      data: { type: "EDIT", venueId: venue.id, payload: { kind: "re_verify" }, submittedBy: null, status: "PENDING" },
    });
    seededContributionIds.push(contribution.id);

    const results = await Promise.allSettled([
      service.approve(contribution.id, "curator-a"),
      service.approve(contribution.id, "curator-b"),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);

    const versionCount = await prisma.venueVersion.count({ where: { venueId: venue.id } });
    expect(versionCount).toBe(1); // not 2 -- the losing transaction's snapshot/version work never ran

    await prisma.venueVersion.deleteMany({ where: { venueId: venue.id } });
    await prisma.venue.delete({ where: { id: venue.id } });
  });
});
