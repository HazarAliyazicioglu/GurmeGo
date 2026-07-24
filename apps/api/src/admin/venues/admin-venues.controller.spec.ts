import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyMultipart from "@fastify/multipart";
import { AdminVenuesController } from "./admin-venues.controller";
import { AdminVenuesService } from "./admin-venues.service";
import { CsvImportService } from "./csv-import.service";

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
  let venues: { create: jest.Mock; update: jest.Mock; revert: jest.Mock };
  let csvImport: { parseRows: jest.Mock };

  beforeAll(async () => {
    venues = { create: jest.fn(), update: jest.fn(), revert: jest.fn() };
    csvImport = { parseRows: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminVenuesController],
      providers: [
        { provide: AdminVenuesService, useValue: venues },
        { provide: CsvImportService, useValue: csvImport },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.register(fastifyMultipart);
    // Test-only stand-in for JwtAuthMiddleware: sets req.user from a header instead of verifying a real JWT.
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
    expect(venues.create).toHaveBeenCalledWith(expect.objectContaining({ name: "A", lat: 41.0, lng: 29.0 }));
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
    venues.update.mockResolvedValue({ id: "v1" });

    const res = await app.inject({
      method: "PUT",
      url: "/admin/venues/v1",
      headers: { "x-test-role": "admin" },
      payload: { branchCount: 2 },
    });

    expect(res.statusCode).toBe(200);
    expect(venues.update).toHaveBeenCalledWith("v1", expect.objectContaining({ branchCount: 2 }));
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
    const res = await app.inject({ method: "POST", url: "/admin/venues/v1/revert/ver1" });

    expect(res.statusCode).toBe(403);
    expect(venues.revert).not.toHaveBeenCalled();
  });

  describe("POST /admin/import", () => {
    it("parses a real multipart CSV upload via @fastify/multipart", async () => {
      csvImport.parseRows.mockReturnValue({ valid: [{ name: "A" }], errors: [] });

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
      expect(JSON.parse(res.payload)).toEqual({ valid: [{ name: "A" }], errors: [] });
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
    });
  });
});
