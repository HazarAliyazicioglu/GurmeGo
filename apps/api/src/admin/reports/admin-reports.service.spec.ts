import { AdminReportsService } from "./admin-reports.service";

describe("AdminReportsService.dataQuality", () => {
  it("aggregates venue counts per district, stale count, and source breakdown", async () => {
    const prisma = {
      venue: {
        groupBy: jest.fn()
          .mockResolvedValueOnce([{ districtId: "d1", _count: 12 }])
          .mockResolvedValueOnce([{ source: "MANUAL", _count: 12 }]),
        count: jest.fn().mockResolvedValue(3),
      },
      district: { findMany: jest.fn().mockResolvedValue([{ id: "d1", name: "Kadıköy" }]) },
    } as any;
    const service = new AdminReportsService(prisma);

    const result = await service.dataQuality();

    expect(result.perDistrict).toEqual([{ name: "Kadıköy", count: 12 }]);
    expect(result.staleCount).toBe(3);
    expect(result.bySource).toEqual([{ source: "MANUAL", count: 12 }]);
  });
});

describe("AdminReportsService.exportVenues", () => {
  it("returns JSON stringified venues for format=json", async () => {
    const prisma = { venue: { findMany: jest.fn().mockResolvedValue([{ id: "v1", name: "A" }]) } } as any;
    const service = new AdminReportsService(prisma);

    const result = await service.exportVenues("json");

    expect(JSON.parse(result)).toEqual([{ id: "v1", name: "A" }]);
  });

  it("returns CSV header + rows for format=csv", async () => {
    const prisma = { venue: { findMany: jest.fn().mockResolvedValue([{ id: "v1", name: "A" }]) } } as any;
    const service = new AdminReportsService(prisma);

    const result = await service.exportVenues("csv");

    expect(result).toContain("id,name");
    expect(result).toContain("v1,A");
  });

  // §3.3 KRİTİK bulgu (docs/REVIEW-PLAN.md): a curator-approved contribution could carry a
  // spreadsheet formula in any free-text Venue field (name, editorialNote, transportNote,
  // address, cuisineType) -- opening the exported CSV in Excel/Sheets executes it automatically
  // (OWASP CSV/Formula Injection). Standard mitigation: prefix a leading `=`/`+`/`-`/`@` with a
  // single quote so spreadsheet apps treat the cell as plain text, not a formula.
  it("escapes a formula-injection payload (leading =) in a CSV string field with a leading single quote", async () => {
    const prisma = {
      venue: { findMany: jest.fn().mockResolvedValue([{ id: "v1", name: "=cmd|'/c calc'!A1" }]) },
    } as any;
    const service = new AdminReportsService(prisma);

    const result = await service.exportVenues("csv");

    expect(result).toContain(`v1,'=cmd|'/c calc'!A1`);
  });

  it.each(["+", "-", "@"])("escapes a formula-injection payload (leading %s) in a CSV string field", async (prefix) => {
    const prisma = {
      venue: { findMany: jest.fn().mockResolvedValue([{ id: "v1", name: `${prefix}SUM(1+1)` }]) },
    } as any;
    const service = new AdminReportsService(prisma);

    const result = await service.exportVenues("csv");

    expect(result).toContain(`v1,'${prefix}SUM(1+1)`);
  });

  it("leaves ordinary text (not starting with =/+/-/@) unescaped in CSV export", async () => {
    const prisma = {
      venue: { findMany: jest.fn().mockResolvedValue([{ id: "v1", name: "Kadıköy'ün en iyi kafesi" }]) },
    } as any;
    const service = new AdminReportsService(prisma);

    const result = await service.exportVenues("csv");

    expect(result).toContain(`v1,Kadıköy'ün en iyi kafesi`);
  });

  // cross-model-review finding (MAJOR): some spreadsheet import paths skip leading
  // whitespace/control characters before formula-prefix detection, so a value starting with a tab
  // could still land as a formula even though it doesn't visibly start with =/+/-/@.
  it.each(["\t", "\r", "\n"])("escapes a formula-injection payload with a leading control character (%j)", async (prefix) => {
    const prisma = {
      venue: { findMany: jest.fn().mockResolvedValue([{ id: "v1", name: `${prefix}=cmd|calc` }]) },
    } as any;
    const service = new AdminReportsService(prisma);

    const result = await service.exportVenues("csv");

    // Not anchored to `v1,` -- csv-stringify quotes a cell containing \n (its own record
    // delimiter), so the escaped payload's surrounding characters differ by which control
    // character it is; what matters is that the escaping single quote is actually present.
    expect(result).toContain(`'${prefix}=cmd|calc`);
  });

  // cross-model-review finding: the claim that array/JSON fields are already safe (csv-stringify
  // wraps them in `[`/`{`, never a formula-trigger character) was only documented in a comment,
  // never actually verified by a test.
  it("does not need escaping for array fields, since csv-stringify already wraps them starting with '['", async () => {
    const prisma = {
      venue: { findMany: jest.fn().mockResolvedValue([{ id: "v1", signatureItems: ["=cmd|calc", "Flat white"] }]) },
    } as any;
    const service = new AdminReportsService(prisma);

    const result = await service.exportVenues("csv");

    expect(result).toContain(`"[""=cmd|calc"",""Flat white""]"`);
    expect(result).not.toMatch(/,'?=cmd/);
  });

  it("does not need escaping for a JSON object field either, since csv-stringify already wraps it starting with '{'", async () => {
    const prisma = {
      venue: { findMany: jest.fn().mockResolvedValue([{ id: "v1", openingHours: { mon_fri: "=cmd|calc" } }]) },
    } as any;
    const service = new AdminReportsService(prisma);

    const result = await service.exportVenues("csv");

    expect(result).toContain(`"{""mon_fri"":""=cmd|calc""}"`);
    expect(result).not.toMatch(/,'?=cmd/);
  });

  it("does NOT escape a formula-injection payload in JSON export (not opened by a spreadsheet app)", async () => {
    const prisma = {
      venue: { findMany: jest.fn().mockResolvedValue([{ id: "v1", name: "=cmd|'/c calc'!A1" }]) },
    } as any;
    const service = new AdminReportsService(prisma);

    const result = await service.exportVenues("json");

    expect(JSON.parse(result)).toEqual([{ id: "v1", name: "=cmd|'/c calc'!A1" }]);
  });
});
