import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyMultipart from "@fastify/multipart";
import { AdminVenuesController } from "./admin-venues.controller";
import { AdminVenuesService } from "./admin-venues.service";
import { CsvImportService } from "./csv-import.service";
import { CACHE_STORE } from "../../common/cache-store.interface";

const VENUE_ID = "d290f1ee-6c54-4b01-90e6-d701748f0851";
const VERSION_ID = "d290f1ee-6c54-4b01-90e6-d701748f0852";

const VALID_CREATE_PAYLOAD = {
  name: "A",
  slug: "a",
  districtId: "11111111-1111-1111-1111-111111111111",
  category: "cafe",
  priceRange: "MODERATE",
  signatureItems: [],
  openingHours: {},
  branchCount: 1,
  franchiseFlag: false,
  lat: 41.0,
  lng: 29.0,
};

describe("AdminVenuesController (e2e) — RolesGuard", () => {
  let app: NestFastifyApplication;
  let venues: { create: jest.Mock; update: jest.Mock; revert: jest.Mock; importRows: jest.Mock; importWithAudit: jest.Mock };
  let csvImport: { parseRows: jest.Mock };

  beforeAll(async () => {
    venues = { create: jest.fn(), update: jest.fn(), revert: jest.fn(), importRows: jest.fn(), importWithAudit: jest.fn() };
    csvImport = { parseRows: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminVenuesController],
      providers: [
        { provide: CACHE_STORE, useValue: { increment: jest.fn().mockResolvedValue(1) } },
        { provide: AdminVenuesService, useValue: venues },
        { provide: CsvImportService, useValue: csvImport },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.register(fastifyMultipart);
    // Test-only stand-in for JwtAuthGuard: sets req.user from a header instead of verifying a real JWT.
    app.getHttpAdapter()
      .getInstance()
      .addHook("onRequest", (req: any, _reply: any, done: () => void) => {
        const role = req.headers["x-test-role"];
        req.user = role ? { id: "test-user", role } : undefined;
        done();
      });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    venues.create.mockReset();
    venues.update.mockReset();
    venues.revert.mockReset();
    venues.importRows.mockReset();
    venues.importWithAudit.mockReset();
    csvImport.parseRows.mockReset();
  });

  it("allows a curator to create a venue", async () => {
    venues.create.mockResolvedValue({ id: "v1" });

    const res = await app.inject({
      method: "POST",
      url: "/admin/venues",
      headers: { "x-test-role": "curator" },
      payload: VALID_CREATE_PAYLOAD,
    });

    expect(res.statusCode).toBe(201);
    expect(venues.create).toHaveBeenCalledWith(expect.objectContaining({ name: "A", lat: 41.0, lng: 29.0 }), "test-user");
  });

  it("rejects an invalid create payload with 400 before reaching the service", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/admin/venues",
      headers: { "x-test-role": "curator" },
      payload: { name: "A" },
    });

    expect(res.statusCode).toBe(400);
    expect(venues.create).not.toHaveBeenCalled();
  });

  it("allows an admin to update a venue", async () => {
    venues.update.mockResolvedValue({ id: VENUE_ID });

    const res = await app.inject({
      method: "PUT",
      url: `/admin/venues/${VENUE_ID}`,
      headers: { "x-test-role": "admin" },
      payload: { branchCount: 2 },
    });

    expect(res.statusCode).toBe(200);
    expect(venues.update).toHaveBeenCalledWith(VENUE_ID, expect.objectContaining({ branchCount: 2 }), "test-user");
  });

  // Final whole-branch review finding: a lat-only (or lng-only) update payload used to reach
  // updateWithLocation, which silently drops the coordinate change (only writes `location` when
  // BOTH are present) while AdminVenuesService.update() still stamps a fresh verifiedAt --
  // falsely marking the venue as re-verified. AdminVenueUpdateSchema now rejects it up front.
  it("rejects a lat-only update payload with 400 before reaching the service", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/admin/venues/${VENUE_ID}`,
      headers: { "x-test-role": "admin" },
      payload: { lat: 40.99 },
    });

    expect(res.statusCode).toBe(400);
    expect(venues.update).not.toHaveBeenCalled();
  });

  it("rejects a non-UUID id on update with 400 before reaching the service", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/admin/venues/not-a-uuid",
      headers: { "x-test-role": "admin" },
      payload: { branchCount: 2 },
    });

    expect(res.statusCode).toBe(400);
    expect(venues.update).not.toHaveBeenCalled();
  });

  it("rejects a non-UUID id or versionId on revert with 400 before reaching the service", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/admin/venues/not-a-uuid/revert/${VERSION_ID}`,
      headers: { "x-test-role": "admin" },
    });

    expect(res.statusCode).toBe(400);
    expect(venues.revert).not.toHaveBeenCalled();
  });

  it("blocks a plain user from creating a venue", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/admin/venues",
      headers: { "x-test-role": "user" },
      payload: VALID_CREATE_PAYLOAD,
    });

    expect(res.statusCode).toBe(403);
    expect(venues.create).not.toHaveBeenCalled();
  });

  it("blocks an unauthenticated request to revert", async () => {
    const res = await app.inject({ method: "POST", url: `/admin/venues/${VENUE_ID}/revert/${VERSION_ID}` });

    expect(res.statusCode).toBe(401);
    expect(venues.revert).not.toHaveBeenCalled();
  });

  describe("POST /admin/import", () => {
    it("parses a real multipart CSV upload via @fastify/multipart and imports via importWithAudit (attributed to the authenticated actor)", async () => {
      csvImport.parseRows.mockReturnValue({ valid: [{ name: "A" }], errors: [] });
      venues.importWithAudit.mockResolvedValue({ created: 1, skipped: 0, rowErrors: [], createdVenueIds: ["v1"] });

      const csvContent = "name,districtSlug,category,priceRange,branchCount\nA,kadikoy,cafe,MODERATE,1\n";
      const boundary = "----gurmegoTestBoundary";
      const body =
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="venues.csv"\r\n` +
        `Content-Type: text/csv\r\n\r\n` +
        `${csvContent}\r\n` +
        `--${boundary}--\r\n`;

      const res = await app.inject({
        method: "POST",
        url: "/admin/import",
        headers: {
          "x-test-role": "curator",
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
        payload: body,
      });

      expect(res.statusCode).toBe(201);
      expect(csvImport.parseRows).toHaveBeenCalledWith(csvContent);
      expect(venues.importWithAudit).toHaveBeenCalledWith([{ name: "A" }], 0, "test-user");
      expect(JSON.parse(res.payload)).toEqual({ created: 1, skipped: 0, errors: [] });
    });

    it("answers 400 CSV_TOO_MANY_ROWS and performs ZERO writes when the file is over the row cap", async () => {
      csvImport.parseRows.mockRejectedValue(
        new BadRequestException({ error: { code: "CSV_TOO_MANY_ROWS", message: "En fazla 2000 satır" } }),
      );
      const boundary = "----gurmegoTestBoundaryBig";
      const body =
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="big.csv"\r\n` +
        `Content-Type: text/csv\r\n\r\n` +
        `name\r\n` +
        `--${boundary}--\r\n`;

      const res = await app.inject({
        method: "POST",
        url: "/admin/import",
        headers: { "x-test-role": "curator", "content-type": `multipart/form-data; boundary=${boundary}` },
        payload: body,
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error.code).toBe("CSV_TOO_MANY_ROWS");
      expect(venues.importWithAudit).not.toHaveBeenCalled();
    });

    it("counts only ROW-level parse errors towards the audited row count (a file-level error is row 0, not a row)", async () => {
      csvImport.parseRows.mockReturnValue({
        valid: [{ name: "A" }],
        errors: [{ row: 0, message: "CSV dosyası ayrıştırılamadı" }, { row: 3, message: "name zorunlu" }],
      });
      venues.importWithAudit.mockResolvedValue({ created: 1, skipped: 0, rowErrors: [], createdVenueIds: ["v1"] });
      const boundary = "----gurmegoTestBoundaryRow0";
      const body =
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="v.csv"\r\n` +
        `Content-Type: text/csv\r\n\r\n` +
        `name\r\n` +
        `--${boundary}--\r\n`;
      const res = await app.inject({
        method: "POST",
        url: "/admin/import",
        headers: { "x-test-role": "curator", "content-type": `multipart/form-data; boundary=${boundary}` },
        payload: body,
      });
      expect(res.statusCode).toBe(201);
      expect(venues.importWithAudit).toHaveBeenCalledWith([{ name: "A" }], 1, "test-user");
    });

    it("returns 400 when no file part is present", async () => {
      const boundary = "----gurmegoTestBoundaryEmpty";
      const body = `--${boundary}--\r\n`;

      const res = await app.inject({
        method: "POST",
        url: "/admin/import",
        headers: {
          "x-test-role": "curator",
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
        payload: body,
      });

      expect(res.statusCode).toBe(400);
      expect(csvImport.parseRows).not.toHaveBeenCalled();
      expect(venues.importWithAudit).not.toHaveBeenCalled();
    });
  });
});

describe("AdminVenuesController (e2e) — GET search & versions", () => {
  let app: NestFastifyApplication;
  let venues: { search: jest.Mock; listVersions: jest.Mock };

  beforeAll(async () => {
    venues = { search: jest.fn(), listVersions: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminVenuesController],
      providers: [
        { provide: CACHE_STORE, useValue: { increment: jest.fn().mockResolvedValue(1) } },
        { provide: AdminVenuesService, useValue: venues },
        { provide: CsvImportService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.register(fastifyMultipart);
    app.getHttpAdapter()
      .getInstance()
      .addHook("onRequest", (req: any, _reply: any, done: () => void) => {
        const role = req.headers["x-test-role"];
        req.user = role ? { id: "test-user", role } : undefined;
        done();
      });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    venues.search.mockReset();
    venues.listVersions.mockReset();
  });

  it("allows a curator to search venues by term", async () => {
    venues.search.mockResolvedValue([{ id: VENUE_ID, name: "A", slug: "a", status: "PUBLISHED" }]);
    const res = await app.inject({
      method: "GET",
      url: "/admin/venues?search=kadikoy",
      headers: { "x-test-role": "curator" },
    });
    expect(res.statusCode).toBe(200);
    expect(venues.search).toHaveBeenCalledWith("kadikoy");
  });

  it("rejects a search term shorter than 2 characters with 400", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/venues?search=k",
      headers: { "x-test-role": "curator" },
    });
    expect(res.statusCode).toBe(400);
    expect(venues.search).not.toHaveBeenCalled();
  });

  it("allows a curator to list a venue's versions", async () => {
    venues.listVersions.mockResolvedValue([{ id: VERSION_ID, createdAt: new Date(), createdBy: "admin-1" }]);
    const res = await app.inject({
      method: "GET",
      url: `/admin/venues/${VENUE_ID}/versions`,
      headers: { "x-test-role": "curator" },
    });
    expect(res.statusCode).toBe(200);
    expect(venues.listVersions).toHaveBeenCalledWith(VENUE_ID);
  });

  it("rejects a non-UUID venue id with 400 before reaching the service", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/venues/not-a-uuid/versions",
      headers: { "x-test-role": "curator" },
    });
    expect(res.statusCode).toBe(400);
    expect(venues.listVersions).not.toHaveBeenCalled();
  });

  it("blocks an unauthenticated request to search", async () => {
    const res = await app.inject({ method: "GET", url: "/admin/venues?search=kadikoy" });
    expect(res.statusCode).toBe(401);
    expect(venues.search).not.toHaveBeenCalled();
  });
});
