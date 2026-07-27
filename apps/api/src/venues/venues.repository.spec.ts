import { Prisma } from "@prisma/client";
import { VenuesRepository, AdminVenueRow, UpdateVenueWithLocationInput, snapshotToUpdateInput } from "./venues.repository";
import { PrismaService } from "../prisma/prisma.service";

describe("VenuesRepository.searchPublished", () => {
  it("builds a distance-sorted query when lat/lng given and returns cursor", async () => {
    const rows = [
      { id: "v1", name: "A", slug: "a", distance_m: 120 },
      { id: "v2", name: "B", slug: "b", distance_m: 340 },
      { id: "v3", name: "C", slug: "c", distance_m: 560 },
    ];
    const prisma = { $queryRaw: jest.fn().mockResolvedValue(rows) } as unknown as PrismaService;
    const repo = new VenuesRepository(prisma);

    const result = await repo.searchPublished({
      lat: 40.99,
      lng: 29.02,
      radiusM: 3000,
      sort: "distance",
      limit: 2,
    } as any);

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
  });

  it("returns null cursor when fewer rows than limit", async () => {
    const rows = [{ id: "v1", name: "A", slug: "a", distance_m: 120 }];
    const prisma = { $queryRaw: jest.fn().mockResolvedValue(rows) } as unknown as PrismaService;
    const repo = new VenuesRepository(prisma);

    const result = await repo.searchPublished({ sort: "newest", limit: 20 } as any);

    expect(result.nextCursor).toBeNull();
  });
});

describe("VenuesRepository.searchPublished — B11 zero-coordinate handling", () => {
  it("still applies distance sort and radius filter when lat=0/lng=0 (not falsy-and-ignored)", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    await new VenuesRepository(prisma).searchPublished({ sort: "distance", limit: 20, lat: 0, lng: 0, radiusM: 500 } as any);
    const sqlText = prisma.$queryRaw.mock.calls[0][0].strings.join("");
    // distance_m's SELECT expression and the ORDER BY clause now deliberately share the exact same
    // `<->` expression (not a separate `ST_Distance` call) -- see venues.repository.ts's
    // `distanceExpr` comment: this guarantees the value encoded into a "distance" sort cursor lines
    // up exactly with what the ORDER BY/WHERE keyset filter compares against on the next page.
    expect(sqlText).toContain("AS distance_m");
    expect(sqlText).toContain("ST_DWithin");
    expect(sqlText).toMatch(/ORDER BY v\.location <->/);
  });
});

describe("VenuesRepository.searchPublished — openNow", () => {
  it("adds a fail-open CASE barrier (PostgreSQL NOT(NULL) is NULL, not TRUE)", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    await new VenuesRepository(prisma).searchPublished({ sort: "newest", limit: 20, openNow: true } as any);
    const sqlText = prisma.$queryRaw.mock.calls[0][0].strings.join("");
    expect(sqlText).toContain("Europe/Istanbul");
    expect(sqlText).toMatch(/CASE\s+WHEN/i);
    expect(sqlText).toMatch(/ELSE\s+true/i);
  });
  it("adds no openNow condition when the filter is absent", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    await new VenuesRepository(prisma).searchPublished({ sort: "newest", limit: 20 } as any);
    expect(prisma.$queryRaw.mock.calls[0][0].strings.join("")).not.toContain("Europe/Istanbul");
  });
});

describe("open_now opening-hours format regex (extracted for direct testing)", () => {
  const HOURS_FORMAT = /^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$/;
  it("accepts a valid HH:MM-HH:MM range", () => expect(HOURS_FORMAT.test("09:00-18:00")).toBe(true));
  it("accepts the boundary hour 23", () => expect(HOURS_FORMAT.test("00:00-23:59")).toBe(true));
  it("rejects an out-of-range hour", () => expect(HOURS_FORMAT.test("29:00-10:00")).toBe(false));
  it("rejects an empty string", () => expect(HOURS_FORMAT.test("")).toBe(false));
  it("rejects a non-numeric value", () => expect(HOURS_FORMAT.test("kapalı")).toBe(false));
});

describe("VenuesRepository.createWithLocation — client parameter and Google fields", () => {
  it("accepts an explicit Prisma client as the first argument", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1" }]) } as any;
    const repo = new VenuesRepository({} as any);
    const result = await repo.createWithLocation(client, {
      name: "A", slug: "a", districtId: "d1", category: "cafe", priceRange: "MODERATE",
      signatureItems: [], openingHours: {}, isBoutique: false, branchCount: 1, franchiseFlag: false,
      source: "MANUAL", verifiedAt: new Date(), status: "DRAFT", lat: 40.99, lng: 29.02,
    });
    expect(client.$queryRaw).toHaveBeenCalled();
    expect(result).toEqual({ id: "v1" });
  });

  it("includes googleRating/googleRatingCount/googlePlaceId/address/photos in the INSERT", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1" }]) } as any;
    const repo = new VenuesRepository({} as any);
    await repo.createWithLocation(client, {
      name: "A", slug: "a", districtId: "d1", category: "cafe", priceRange: "MODERATE",
      signatureItems: [], openingHours: {}, isBoutique: false, branchCount: 1, franchiseFlag: false,
      source: "MANUAL", verifiedAt: new Date(), status: "DRAFT", lat: 40.99, lng: 29.02,
      googleRating: 4.5, googleRatingCount: 10, googlePlaceId: "place123", address: "Adres 1", photos: ["p1"],
    });
    const call = client.$queryRaw.mock.calls[0][0];
    expect(call.strings.join("")).toContain("googleRating");
    expect(call.values).toEqual(expect.arrayContaining([4.5, 10, "place123", "Adres 1"]));
  });
});

describe("VenuesRepository.updateWithLocation — zero-coordinate and explicit-null handling", () => {
  it("includes a lat=0/lng=0 update", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1" }]) } as any;
    await new VenuesRepository({} as any).updateWithLocation(client, "v1", { lat: 0, lng: 0 });
    const call = client.$queryRaw.mock.calls[0][0];
    expect(call.strings.join("")).toContain("location");
    expect(call.values).toContain(0);
  });
  it("accepts explicit null for nullable fields (needed by revert restoring a cleared field)", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1" }]) } as any;
    await new VenuesRepository({} as any).updateWithLocation(client, "v1", { editorialNote: null, address: null });
    expect(client.$queryRaw.mock.calls[0][0].values).toContain(null);
  });
  it("includes photos in the UPDATE (round 4 catch: previously silently dropped)", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1" }]) } as any;
    await new VenuesRepository({} as any).updateWithLocation(client, "v1", { photos: ["p1", "p2"] });
    const call = client.$queryRaw.mock.calls[0][0];
    expect(call.strings.join("")).toContain("photos");
    expect(call.values).toEqual(expect.arrayContaining([["p1", "p2"]]));
  });
});

describe("VenuesRepository.findRawForSnapshot", () => {
  it("returns the full row including lat/lng via raw SQL", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1", lat: 40.99, lng: 29.02 }]) } as any;
    const result = await new VenuesRepository({} as any).findRawForSnapshot(client, "v1");
    const sqlText = client.$queryRaw.mock.calls[0][0].strings.join("");
    expect(sqlText).toContain("ST_Y");
    expect(sqlText).toContain("ST_X");
    expect(result).toEqual({ id: "v1", lat: 40.99, lng: 29.02 });
  });
  it("throws NotFoundException when not found", async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    await expect(new VenuesRepository({} as any).findRawForSnapshot(client, "missing")).rejects.toThrow("Mekan bulunamadı");
  });
});

describe("snapshotToUpdateInput", () => {
  it("maps a raw snapshot row into a fully-typed update input including source, no cast needed", () => {
    const row: AdminVenueRow = {
      id: "v1", name: "A", slug: "a", districtId: "d1", category: "cafe", cuisineType: null,
      priceRange: "MODERATE", signatureItems: [], transportNote: null, openingHours: {},
      editorialNote: null, isBoutique: false, branchCount: 1, franchiseFlag: false,
      source: "MANUAL", verifiedAt: new Date(), status: "PUBLISHED", googleRating: null,
      googleRatingCount: null, googlePlaceId: null, featured: false, address: null, photos: [],
      createdAt: new Date(), updatedAt: new Date(), lat: 40.99, lng: 29.02,
    };
    const input: UpdateVenueWithLocationInput = snapshotToUpdateInput(row);
    expect(input).toMatchObject({
      name: "A", slug: "a", districtId: "d1", category: "cafe", cuisineType: null,
      priceRange: "MODERATE", isBoutique: false, branchCount: 1, franchiseFlag: false,
      status: "PUBLISHED", source: "MANUAL", googleRating: null, address: null, photos: [], lat: 40.99, lng: 29.02,
    });
  });
});

describe("VenuesRepository.updateWithLocation", () => {
  it("throws a clean error envelope when the venue does not exist (regression: no top-level message field)", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as unknown as PrismaService;
    const repo = new VenuesRepository(prisma);

    try {
      await repo.updateWithLocation(prisma, "missing-id", { name: "New name" });
      throw new Error("expected updateWithLocation to throw");
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        error: { code: "VENUE_NOT_FOUND", message: "Mekan bulunamadı" },
      });
      expect(err.getResponse().message).toBeUndefined();
      expect(err.message).toBe("Mekan bulunamadı");
    }
  });
});

describe("VenuesRepository.findInBbox", () => {
  it("queries venues within the bounding box", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ id: "v1", name: "A", location: {} }]) } as any;
    const repo = new VenuesRepository(prisma);

    const result = await repo.findInBbox([28.9, 40.9, 29.1, 41.1]);

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });
});

describe("VenuesRepository.findBySlug — location and new fields", () => {
  it("returns lat/lng, address, photos, nested district via raw SQL, filters PUBLISHED", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{
      id: "v1", slug: "a", name: "A", lat: 40.99, lng: 29.02, address: "Adres 1", photos: ["p1"],
      district: { name: "Kadıköy", slug: "kadikoy" },
    }]) } as any;
    const result = await new VenuesRepository(prisma as any).findBySlug("a");
    const sqlText = prisma.$queryRaw.mock.calls[0][0].strings.join("");
    expect(sqlText).toContain("ST_Y");
    expect(sqlText).toContain("ST_X");
    expect(sqlText).toContain("json_build_object");
    expect(sqlText).toContain("status = 'PUBLISHED'");
    expect(result).toMatchObject({ lat: 40.99, lng: 29.02, address: "Adres 1", photos: ["p1"], district: { name: "Kadıköy", slug: "kadikoy" } });
  });
  it("returns undefined when not found", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    expect(await new VenuesRepository(prisma as any).findBySlug("missing")).toBeUndefined();
  });
});
