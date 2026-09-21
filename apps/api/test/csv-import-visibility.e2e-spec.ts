import { AuditService } from "../src/audit/audit.service";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { VenuesRepository } from "../src/venues/venues.repository";
import { AdminVenuesService } from "../src/admin/venues/admin-venues.service";
import { BoutiqueService } from "../src/rule-engine/boutique.service";

describe("CSV import -> GET /venues visibility", () => {
  let prisma: PrismaClient;
  let adminVenuesService: AdminVenuesService;
  let seededSlug: string;

  beforeAll(() => {
    prisma = new PrismaService();
    const venuesRepository = new VenuesRepository(prisma as unknown as PrismaService);
    adminVenuesService = new AdminVenuesService(prisma as unknown as PrismaService, new BoutiqueService(), venuesRepository, new AuditService());
  });

  afterEach(async () => {
    if (seededSlug) await prisma.venue.deleteMany({ where: { slug: seededSlug } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("a CSV row with no status column becomes PUBLISHED and appears in searchPublished", async () => {
    const district = await prisma.district.findFirstOrThrow();
    seededSlug = `csv-visibility-${Date.now()}`;
    const { rowErrors } = await adminVenuesService.importRows([{
      row: 1,
      data: {
        name: "CSV Visibility Test", slug: seededSlug, districtSlug: district.slug, category: "cafe",
        priceRange: "MODERATE", branchCount: 1, franchiseFlag: false, lat: 40.99, lng: 29.02,
        openingHours: {},
      } as any,
    }]);
    expect(rowErrors).toEqual([]);
    const created = await prisma.venue.findUniqueOrThrow({ where: { slug: seededSlug } });
    expect(created.status).toBe("PUBLISHED");
    const venuesRepository = new VenuesRepository(prisma as unknown as PrismaService);
    const { items } = await venuesRepository.searchPublished({ sort: "newest", limit: 50 } as any);
    expect(items.map((i: any) => i.slug)).toContain(seededSlug);
  });
});
