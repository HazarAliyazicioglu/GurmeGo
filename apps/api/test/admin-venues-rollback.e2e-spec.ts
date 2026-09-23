import { AuditService } from "../src/audit/audit.service";
import { Prisma, PrismaClient } from "@prisma/client";
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
    adminVenuesService = new AdminVenuesService(prisma as unknown as PrismaService, new BoutiqueService(), venuesRepository, new AuditService());
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
    // update() uses in production. A bare `.rejects.toThrow()` would also pass if some earlier step
    // in the transaction (e.g. snapshot serialization) threw for an unrelated reason, without ever
    // reaching the FK violation this test exists to exercise -- so assert on the actual error
    // instead. `updateWithLocation`'s UPDATE runs via `$queryRaw` (ADR 002), so the FK violation
    // surfaces the same way admin-venues.service.ts's `isUniqueViolation()` documents: a
    // `PrismaClientKnownRequestError` with code `P2010` ("raw query failed") and, on Prisma 7's
    // driver-adapter engine, the underlying Postgres error code nested at
    // `meta.driverAdapterError.cause.originalCode` -- `23503` (foreign_key_violation) here instead
    // of `23505` (under Prisma 5 this same code lived directly at `meta.code`). Verified empirically
    // against the local Postgres stack.
    let caught: unknown;
    await adminVenuesService.update(venue.id, { districtId: "00000000-0000-0000-0000-000000000000" }, "e2e-actor").catch((err) => {
      caught = err;
    });
    expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    const knownError = caught as Prisma.PrismaClientKnownRequestError;
    expect(knownError.code).toBe("P2010");
    expect(
      (knownError.meta as { driverAdapterError?: { cause?: { originalCode?: string } } } | undefined)?.driverAdapterError?.cause
        ?.originalCode,
    ).toBe("23503");
    const versionsAfter = await prisma.venueVersion.count({ where: { venueId: venue.id } });
    expect(versionsAfter).toBe(versionsBefore);
  });
});
