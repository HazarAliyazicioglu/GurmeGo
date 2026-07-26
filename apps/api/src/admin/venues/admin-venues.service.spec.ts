import { Prisma } from "@prisma/client";
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

describe("AdminVenuesService.create — status", () => {
  it("uses input.status when provided", async () => {
    const repo = { createWithLocation: jest.fn().mockResolvedValue({ id: "v1" }) } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const service = new AdminVenuesService({} as any, boutique, repo);
    await service.create({ name: "A", slug: "a", districtId: "d1", category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: {}, branchCount: 1, franchiseFlag: false, status: "PUBLISHED" } as any);
    expect(repo.createWithLocation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "PUBLISHED" }));
  });
  it("defaults to DRAFT when status is omitted", async () => {
    const repo = { createWithLocation: jest.fn().mockResolvedValue({ id: "v1" }) } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const service = new AdminVenuesService({} as any, boutique, repo);
    await service.create({ name: "A", slug: "a", districtId: "d1", category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: {}, branchCount: 1, franchiseFlag: false } as any);
    expect(repo.createWithLocation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "DRAFT" }));
  });
});

describe("AdminVenuesService.update — atomic snapshot + write, partial-update completeness", () => {
  it("wraps snapshot + update in a single transaction, completes isBoutique inputs from the DB", async () => {
    const prisma = { $transaction: jest.fn((fn) => fn({ venueVersion: { create: jest.fn() } })) } as any;
    const repo = {
      findRawForSnapshot: jest.fn().mockResolvedValue({ id: "v1", branchCount: 2, franchiseFlag: false, editorialNote: "old note", status: "PUBLISHED" }),
      updateWithLocation: jest.fn().mockResolvedValue({ id: "v1" }),
    } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(true) } as any;
    const service = new AdminVenuesService(prisma, boutique, repo);
    await service.update("v1", { branchCount: 5 } as any);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(boutique.evaluate).toHaveBeenCalledWith({ branchCount: 5, franchiseFlag: false, hasEditorialNote: true, status: "PUBLISHED" });
    expect(repo.updateWithLocation).toHaveBeenCalled();
  });
});

describe("AdminVenuesService.revert", () => {
  it("snapshots current state, applies the target version's snapshot via snapshotToUpdateInput, sets a fresh verifiedAt", async () => {
    const targetSnapshot = {
      id: "v1", name: "Old Name", lat: 40.9, lng: 29.0, status: "PUBLISHED", source: "MANUAL",
      cuisineType: null, priceRange: "MODERATE", signatureItems: [], transportNote: null,
      openingHours: {}, editorialNote: null, isBoutique: false, branchCount: 1, franchiseFlag: false,
      verifiedAt: new Date(), googleRating: null, googleRatingCount: null, googlePlaceId: null,
      featured: false, address: null, photos: [], createdAt: new Date(), updatedAt: new Date(),
    };
    const txClient = { venueVersion: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "ver1", venueId: "v1", snapshot: targetSnapshot }), create: jest.fn().mockResolvedValue({}) } };
    const prisma = { $transaction: jest.fn((fn) => fn(txClient)) } as any;
    const repo = {
      findRawForSnapshot: jest.fn().mockResolvedValue({ id: "v1", name: "Current Name", status: "PUBLISHED" }),
      updateWithLocation: jest.fn().mockResolvedValue({ id: "v1" }),
    } as any;
    const service = new AdminVenuesService(prisma, {} as any, repo);
    await service.revert("v1", "ver1");
    expect(txClient.venueVersion.create).toHaveBeenCalledWith({ data: { venueId: "v1", snapshot: expect.objectContaining({ name: "Current Name" }), createdBy: null } });
    expect(repo.updateWithLocation).toHaveBeenCalledWith(txClient, "v1", expect.objectContaining({ name: "Old Name", source: "MANUAL", verifiedAt: expect.any(Date) }));
  });
  it("throws NotFoundException if the version doesn't belong to this venue", async () => {
    const txClient = { venueVersion: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "ver1", venueId: "OTHER", snapshot: {} }) } };
    const prisma = { $transaction: jest.fn((fn) => fn(txClient)) } as any;
    const service = new AdminVenuesService(prisma, {} as any, { findRawForSnapshot: jest.fn() } as any);
    await expect(service.revert("v1", "ver1")).rejects.toThrow("Bu mekan için böyle bir versiyon bulunamadı");
  });
});

describe("AdminVenuesService.importRows", () => {
  const csvRow = (row: number, data: Record<string, unknown>) => ({ row, data: data as any });

  it("creates new-slug rows, skips existing-slug rows, and reports district-not-found as a row error, using ORIGINAL CSV row numbers", async () => {
    // Row numbers are deliberately non-contiguous (5, 9, 12) — as if earlier rows in the original CSV
    // failed structural validation and were filtered out before reaching importRows. If importRows used
    // its own loop index instead of the tagged `row` number, these errors would be misreported as 1/2/3.
    const rows = [
      csvRow(5, {
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
      }),
      csvRow(9, {
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
      }),
      csvRow(12, {
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
      }),
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
          .mockResolvedValueOnce({ id: "v-existing" }) // existing-cafe: already exists
          .mockResolvedValueOnce(null), // bad-district-venue: doesn't exist yet, district lookup fails next
      },
    } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const venuesRepository = { createWithLocation: jest.fn().mockResolvedValue({ id: "v1" }) } as any;
    const service = new AdminVenuesService(prisma, boutique, venuesRepository);

    const result = await service.importRows(rows);

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.rowErrors).toEqual([{ row: 12, message: expect.stringContaining("ilçe") }]);
    expect(venuesRepository.createWithLocation).toHaveBeenCalledTimes(1);
    expect(venuesRepository.createWithLocation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ slug: "new-cafe", districtId: "d1", signatureItems: [] }),
    );
  });

  it("skips an existing-slug row even when its districtSlug is stale/invalid, instead of reporting it as an error", async () => {
    // Idempotent-on-slug contract: re-importing a CSV whose district assignments have since changed
    // (or gone stale) must still cleanly skip already-imported rows, not error on them for unrelated
    // reasons. This requires checking slug-exists BEFORE the district lookup.
    const rows = [
      csvRow(1, {
        name: "Existing Cafe",
        slug: "existing-cafe",
        districtSlug: "no-longer-a-real-district",
        category: "cafe",
        priceRange: "MODERATE" as const,
        branchCount: 1,
        franchiseFlag: false,
        lat: 40.98,
        lng: 29.03,
        openingHours: { mon_fri: "09:00-18:00" },
      }),
    ];
    const prisma = {
      district: { findUnique: jest.fn().mockResolvedValue(null) },
      venue: { findUnique: jest.fn().mockResolvedValue({ id: "v-existing" }) },
    } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const venuesRepository = { createWithLocation: jest.fn() } as any;
    const service = new AdminVenuesService(prisma, boutique, venuesRepository);

    const result = await service.importRows(rows);

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.rowErrors).toEqual([]);
    expect(prisma.district.findUnique).not.toHaveBeenCalled();
    expect(venuesRepository.createWithLocation).not.toHaveBeenCalled();
  });

  it("reports a generic error message and does not leak internal error detail when create() throws", async () => {
    const rows = [
      csvRow(1, {
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
      }),
    ];
    const prisma = {
      district: { findUnique: jest.fn().mockResolvedValue({ id: "d1", slug: "kadikoy" }) },
      venue: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const venuesRepository = {
      createWithLocation: jest.fn().mockRejectedValue(new Error("relation \"venues\" violates constraint fk_district_internal_detail")),
    } as any;
    const service = new AdminVenuesService(prisma, boutique, venuesRepository);
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await service.importRows(rows);

    expect(result.created).toBe(0);
    expect(result.rowErrors).toEqual([{ row: 1, message: "Mekan oluşturulamadı: beklenmeyen hata" }]);
    expect(result.rowErrors[0].message).not.toContain("fk_district_internal_detail");
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("treats a unique-constraint violation on insert as a clean skip, not a row error (concurrent-import race)", async () => {
    // The pre-check (findUnique by slug) is not atomic with the insert: two concurrent imports of the
    // same new slug can both pass the pre-check and both attempt to create, so the DB's unique
    // constraint — not this code — is the real source of truth. This must surface as "skipped,
    // already exists", the same outcome as the pre-check catching it, not as a row error.
    const rows = [
      {
        row: 1,
        data: {
          name: "Race Cafe",
          slug: "race-cafe",
          districtSlug: "kadikoy",
          category: "cafe",
          priceRange: "MODERATE" as const,
          branchCount: 1,
          franchiseFlag: false,
          lat: 40.99,
          lng: 29.02,
          openingHours: { mon_fri: "09:00-18:00" },
        },
      },
    ];
    const prisma = {
      district: { findUnique: jest.fn().mockResolvedValue({ id: "d1", slug: "kadikoy" }) },
      // Pre-check sees "does not exist yet" (a concurrent import hasn't committed when this reads).
      venue: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    const boutique = { evaluate: jest.fn().mockReturnValue(false) } as any;
    const uniqueViolation = new Prisma.PrismaClientKnownRequestError("Raw query failed.", {
      code: "P2010",
      clientVersion: "5.22.0",
      meta: { code: "23505", message: 'duplicate key value violates unique constraint "Venue_slug_key"' },
    });
    const venuesRepository = { createWithLocation: jest.fn().mockRejectedValue(uniqueViolation) } as any;
    const service = new AdminVenuesService(prisma, boutique, venuesRepository);
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await service.importRows(rows);

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.rowErrors).toEqual([]);
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
