describe("rule-config — required RULES_* thresholds (no hardcoded fallback)", () => {
  const originalBoutique = process.env.RULES_BOUTIQUE_MAX_BRANCHES;
  const originalStale = process.env.RULES_STALE_DAYS;
  const originalMod = process.env.RULES_MOD_AUTO_HIDE_REPORTS;

  afterEach(() => {
    // Same "undefined" string leak concern rate-limit.config.spec.ts documents: `= undefined`
    // stores the literal string, not an absent var. Restore-or-delete explicitly.
    if (originalBoutique === undefined) delete process.env.RULES_BOUTIQUE_MAX_BRANCHES;
    else process.env.RULES_BOUTIQUE_MAX_BRANCHES = originalBoutique;
    if (originalStale === undefined) delete process.env.RULES_STALE_DAYS;
    else process.env.RULES_STALE_DAYS = originalStale;
    if (originalMod === undefined) delete process.env.RULES_MOD_AUTO_HIDE_REPORTS;
    else process.env.RULES_MOD_AUTO_HIDE_REPORTS = originalMod;
    jest.resetModules();
  });

  it("throws at module load when RULES_BOUTIQUE_MAX_BRANCHES is missing", () => {
    delete process.env.RULES_BOUTIQUE_MAX_BRANCHES;
    process.env.RULES_STALE_DAYS = "90";
    process.env.RULES_MOD_AUTO_HIDE_REPORTS = "3";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(() => require("./rule-config")).toThrow(/RULES_BOUTIQUE_MAX_BRANCHES is required/);
  });

  it("throws at module load when RULES_STALE_DAYS is missing", () => {
    process.env.RULES_BOUTIQUE_MAX_BRANCHES = "3";
    delete process.env.RULES_STALE_DAYS;
    process.env.RULES_MOD_AUTO_HIDE_REPORTS = "3";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(() => require("./rule-config")).toThrow(/RULES_STALE_DAYS is required/);
  });

  it("throws at module load when RULES_MOD_AUTO_HIDE_REPORTS is missing", () => {
    process.env.RULES_BOUTIQUE_MAX_BRANCHES = "3";
    process.env.RULES_STALE_DAYS = "90";
    delete process.env.RULES_MOD_AUTO_HIDE_REPORTS;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(() => require("./rule-config")).toThrow(/RULES_MOD_AUTO_HIDE_REPORTS is required/);
  });

  it("throws at module load when a RULES_* var is set but not a positive integer", () => {
    process.env.RULES_BOUTIQUE_MAX_BRANCHES = "not-a-number";
    process.env.RULES_STALE_DAYS = "90";
    process.env.RULES_MOD_AUTO_HIDE_REPORTS = "3";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(() => require("./rule-config")).toThrow(/RULES_BOUTIQUE_MAX_BRANCHES must be a positive integer/);
  });

  it("returns the configured values when all three vars are set", () => {
    process.env.RULES_BOUTIQUE_MAX_BRANCHES = "5";
    process.env.RULES_STALE_DAYS = "45";
    process.env.RULES_MOD_AUTO_HIDE_REPORTS = "4";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./rule-config");
    expect(mod.getBoutiqueMaxBranches()).toBe(5);
    expect(mod.getStaleDays()).toBe(45);
    expect(mod.getUrgentReportThreshold()).toBe(4);
  });

  it("consolidates the stale-days threshold to a single source shared by re-verify and admin-reports", async () => {
    // Regression guard for the documented duplication finding: RULES_STALE_DAYS used to be read
    // independently in re-verify.service.ts and admin-reports.service.ts, each with its own `?? 90`
    // fallback -- two sources of truth that could silently drift apart. Both now call
    // getStaleDays() from this module, so a single env value drives both.
    //
    // Merely asserting both modules import/reference a getStaleDays()-shaped function (as a
    // previous version of this test did) would still pass if one of them regressed to reading its
    // own independent RULES_STALE_DAYS fallback again -- the import would still be there, just
    // unused at the call site. To actually catch that regression, this test spies on the shared
    // getStaleDays() export, forces it to return a distinctive value, and proves BOTH services'
    // real runtime behavior (the cutoff Date each one computes and hands to Prisma) reflects that
    // exact mocked value -- which is only possible if each service is actually invoking this same
    // function, not its own env fallback.
    process.env.RULES_BOUTIQUE_MAX_BRANCHES = "3";
    process.env.RULES_STALE_DAYS = "30";
    process.env.RULES_MOD_AUTO_HIDE_REPORTS = "3";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ruleConfig = require("./rule-config");
    const getStaleDaysSpy = jest.spyOn(ruleConfig, "getStaleDays").mockReturnValue(50);
    const fixedNow = new Date("2026-01-01T00:00:00Z").getTime();
    const dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(fixedNow);
    const expectedCutoff = new Date(fixedNow - 50 * 24 * 60 * 60 * 1000);

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ReVerifyService } = require("../rule-engine/re-verify.service");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AdminReportsService } = require("../admin/reports/admin-reports.service");

      const reVerifyPrisma = {
        venue: { findMany: jest.fn().mockResolvedValue([]) },
        contributionQueue: { findFirst: jest.fn(), create: jest.fn() },
      } as any;
      await new ReVerifyService(reVerifyPrisma).enqueueStale();
      expect(reVerifyPrisma.venue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ verifiedAt: { lt: expectedCutoff } }) }),
      );

      const adminReportsPrisma = {
        venue: { groupBy: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        district: { findMany: jest.fn().mockResolvedValue([]) },
      } as any;
      await new AdminReportsService(adminReportsPrisma).dataQuality();
      expect(adminReportsPrisma.venue.count).toHaveBeenCalledWith({ where: { verifiedAt: { lt: expectedCutoff } } });

      // Both call sites actually invoked the shared, mocked function -- not two independent reads.
      expect(getStaleDaysSpy).toHaveBeenCalledTimes(2);
    } finally {
      dateNowSpy.mockRestore();
      getStaleDaysSpy.mockRestore();
    }
  });
});
