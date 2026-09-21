describe("CSV_IMPORT_LIMITS", () => {
  const original = process.env.CSV_IMPORT_MAX_ROWS;
  afterEach(() => {
    if (original === undefined) delete process.env.CSV_IMPORT_MAX_ROWS;
    else process.env.CSV_IMPORT_MAX_ROWS = original;
    jest.resetModules();
  });

  it("defaults to 2000 rows", () => {
    delete process.env.CSV_IMPORT_MAX_ROWS;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require("./csv-import.config").CSV_IMPORT_LIMITS.maxRows).toBe(2000);
  });
  it("uses CSV_IMPORT_MAX_ROWS when set", () => {
    process.env.CSV_IMPORT_MAX_ROWS = "50";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require("./csv-import.config").CSV_IMPORT_LIMITS.maxRows).toBe(50);
  });
  it("throws at load for an invalid value", () => {
    process.env.CSV_IMPORT_MAX_ROWS = "many";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(() => require("./csv-import.config")).toThrow(/CSV_IMPORT_MAX_ROWS/);
  });
});
