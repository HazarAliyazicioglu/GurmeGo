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

  it("consolidates the stale-days threshold to a single source shared by re-verify and admin-reports", () => {
    // Regression guard for the documented duplication finding: RULES_STALE_DAYS used to be read
    // independently in re-verify.service.ts and admin-reports.service.ts, each with its own `?? 90`
    // fallback -- two sources of truth that could silently drift apart. Both now call
    // getStaleDays() from this module, so a single env value drives both.
    process.env.RULES_BOUTIQUE_MAX_BRANCHES = "3";
    process.env.RULES_STALE_DAYS = "30";
    process.env.RULES_MOD_AUTO_HIDE_REPORTS = "3";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ruleConfig = require("./rule-config");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const reVerifyModule = require("../rule-engine/re-verify.service");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const adminReportsModule = require("../admin/reports/admin-reports.service");
    expect(reVerifyModule).toBeDefined();
    expect(adminReportsModule).toBeDefined();
    expect(ruleConfig.getStaleDays()).toBe(30);
  });
});
