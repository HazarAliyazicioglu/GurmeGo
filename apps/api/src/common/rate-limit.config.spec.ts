describe("RATE_LIMITS — env override", () => {
  const original = process.env.RATE_LIMIT_READ_PER_MINUTE;
  const originalReport = process.env.RATE_LIMIT_REPORT_PER_DAY;

  afterEach(() => {
    process.env.RATE_LIMIT_READ_PER_MINUTE = original;
    process.env.RATE_LIMIT_REPORT_PER_DAY = originalReport;
    jest.resetModules();
  });

  it("uses the env value when set", () => {
    process.env.RATE_LIMIT_READ_PER_MINUTE = "42";
    jest.resetModules();
    expect(require("./rate-limit.config").RATE_LIMITS.read.limit).toBe(42);
  });

  it("falls back to 100 when unset", () => {
    delete process.env.RATE_LIMIT_READ_PER_MINUTE;
    jest.resetModules();
    expect(require("./rate-limit.config").RATE_LIMITS.read.limit).toBe(100);
  });

  it("uses env value for report limit when set", () => {
    process.env.RATE_LIMIT_REPORT_PER_DAY = "5";
    jest.resetModules();
    expect(require("./rate-limit.config").RATE_LIMITS.report.limit).toBe(5);
  });

  it("falls back to 10 for report limit when unset", () => {
    delete process.env.RATE_LIMIT_REPORT_PER_DAY;
    jest.resetModules();
    expect(require("./rate-limit.config").RATE_LIMITS.report.limit).toBe(10);
  });
});
