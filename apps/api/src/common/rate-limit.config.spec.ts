describe("RATE_LIMITS — env override", () => {
  const original = process.env.RATE_LIMIT_READ_PER_MINUTE;
  const originalReport = process.env.RATE_LIMIT_REPORT_PER_DAY;
  const originalWrite = process.env.RATE_LIMIT_WRITE_PER_MINUTE;
  const originalAdmin = process.env.RATE_LIMIT_ADMIN_PER_MINUTE;
  const originalAdminImport = process.env.RATE_LIMIT_ADMIN_IMPORT_PER_HOUR;

  afterEach(() => {
    // `process.env.X = undefined` stores the literal string "undefined", not an absent var --
    // when `original`/`originalReport` were unset to begin with, restoring "as before" means
    // deleting, not assigning `undefined`. This mattered less before boot-time validation existed
    // (Number("undefined") was just NaN, silently accepted); now a leaked "undefined" string from
    // a previous test would fail the new positive-integer check for every test running after it.
    if (original === undefined) delete process.env.RATE_LIMIT_READ_PER_MINUTE;
    else process.env.RATE_LIMIT_READ_PER_MINUTE = original;
    if (originalReport === undefined) delete process.env.RATE_LIMIT_REPORT_PER_DAY;
    else process.env.RATE_LIMIT_REPORT_PER_DAY = originalReport;
    if (originalWrite === undefined) delete process.env.RATE_LIMIT_WRITE_PER_MINUTE;
    else process.env.RATE_LIMIT_WRITE_PER_MINUTE = originalWrite;
    if (originalAdmin === undefined) delete process.env.RATE_LIMIT_ADMIN_PER_MINUTE;
    else process.env.RATE_LIMIT_ADMIN_PER_MINUTE = originalAdmin;
    if (originalAdminImport === undefined) delete process.env.RATE_LIMIT_ADMIN_IMPORT_PER_HOUR;
    else process.env.RATE_LIMIT_ADMIN_IMPORT_PER_HOUR = originalAdminImport;
    jest.resetModules();
  });

  it("uses the env value when set", () => {
    process.env.RATE_LIMIT_READ_PER_MINUTE = "42";
    jest.resetModules();
    // require() (not import) is required here: after jest.resetModules(), only a fresh
    // require() call re-evaluates the module against the mutated process.env; a static ESM
    // import is resolved once and cached, so it would never see the new env value.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require("./rate-limit.config").RATE_LIMITS.read.limit).toBe(42);
  });

  it("falls back to 100 when unset", () => {
    delete process.env.RATE_LIMIT_READ_PER_MINUTE;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require("./rate-limit.config").RATE_LIMITS.read.limit).toBe(100);
  });

  it("uses env value for report limit when set", () => {
    process.env.RATE_LIMIT_REPORT_PER_DAY = "5";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require("./rate-limit.config").RATE_LIMITS.report.limit).toBe(5);
  });

  it("falls back to 10 for report limit when unset", () => {
    delete process.env.RATE_LIMIT_REPORT_PER_DAY;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require("./rate-limit.config").RATE_LIMITS.report.limit).toBe(10);
  });

  // Security/ops finding: a set-but-non-numeric env var used to silently become NaN, and
  // `count > NaN` is always false -- rate limiting became a permanent no-op with no indication
  // anything was wrong. Boot-time validation must fail loudly instead.
  it("throws at module load when RATE_LIMIT_READ_PER_MINUTE is set but not a valid positive integer", () => {
    process.env.RATE_LIMIT_READ_PER_MINUTE = "not-a-number";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(() => require("./rate-limit.config")).toThrow(/RATE_LIMIT_READ_PER_MINUTE/);
  });

  it("throws at module load when RATE_LIMIT_REPORT_PER_DAY is set to zero or a negative number", () => {
    process.env.RATE_LIMIT_REPORT_PER_DAY = "0";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(() => require("./rate-limit.config")).toThrow(/RATE_LIMIT_REPORT_PER_DAY/);
  });

  it("throws at module load when RATE_LIMIT_REPORT_PER_DAY is set to a non-integer decimal", () => {
    process.env.RATE_LIMIT_REPORT_PER_DAY = "5.5";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(() => require("./rate-limit.config")).toThrow(/RATE_LIMIT_REPORT_PER_DAY/);
  });

  // docs/DENETIM-RAPORU.md KRİTİK bulgu: favorite-list write endpoints (create/add/remove) had
  // no rate limit at all -- any signed-up account could hammer them.
  it("has a write tier, falling back to 20 per minute when unset", () => {
    delete process.env.RATE_LIMIT_WRITE_PER_MINUTE;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require("./rate-limit.config").RATE_LIMITS.write.limit).toBe(20);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require("./rate-limit.config").RATE_LIMITS.write.windowSeconds).toBe(60);
  });

  it("uses the env value for the write tier when set", () => {
    process.env.RATE_LIMIT_WRITE_PER_MINUTE = "7";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require("./rate-limit.config").RATE_LIMITS.write.limit).toBe(7);
  });

  // docs/DENETIM-RAPORU.md Orta: admin endpoints had no rate limit (a hijacked curator account or a
  // UI bug that keeps firing requests had nothing to stop it).
  it("has an admin tier: 60 per minute, shared across the admin API, when unset", () => {
    delete process.env.RATE_LIMIT_ADMIN_PER_MINUTE;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RATE_LIMITS } = require("./rate-limit.config");
    expect(RATE_LIMITS.admin.limit).toBe(60);
    expect(RATE_LIMITS.admin.windowSeconds).toBe(60);
  });

  it("has a much stricter admin-import tier: 5 per hour when unset", () => {
    delete process.env.RATE_LIMIT_ADMIN_IMPORT_PER_HOUR;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RATE_LIMITS } = require("./rate-limit.config");
    expect(RATE_LIMITS.adminImport.limit).toBe(5);
    expect(RATE_LIMITS.adminImport.windowSeconds).toBe(3600);
  });

  it("uses env values for the admin tiers when set", () => {
    process.env.RATE_LIMIT_ADMIN_PER_MINUTE = "30";
    process.env.RATE_LIMIT_ADMIN_IMPORT_PER_HOUR = "2";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RATE_LIMITS } = require("./rate-limit.config");
    expect(RATE_LIMITS.admin.limit).toBe(30);
    expect(RATE_LIMITS.adminImport.limit).toBe(2);
  });

  it("throws at module load for an invalid admin limit (a NaN limit would silently disable the guard)", () => {
    process.env.RATE_LIMIT_ADMIN_PER_MINUTE = "lots";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(() => require("./rate-limit.config")).toThrow(/RATE_LIMIT_ADMIN_PER_MINUTE/);
  });
});
