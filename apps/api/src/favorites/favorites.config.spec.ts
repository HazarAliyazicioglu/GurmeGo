describe("FAVORITES_LIMITS — env override", () => {
  const originalLists = process.env.FAVORITES_MAX_LISTS_PER_USER;
  const originalVenues = process.env.FAVORITES_MAX_VENUES_PER_LIST;

  afterEach(() => {
    if (originalLists === undefined) delete process.env.FAVORITES_MAX_LISTS_PER_USER;
    else process.env.FAVORITES_MAX_LISTS_PER_USER = originalLists;
    if (originalVenues === undefined) delete process.env.FAVORITES_MAX_VENUES_PER_LIST;
    else process.env.FAVORITES_MAX_VENUES_PER_LIST = originalVenues;
    jest.resetModules();
  });

  it("falls back to 20 lists per user and 200 venues per list when unset", () => {
    delete process.env.FAVORITES_MAX_LISTS_PER_USER;
    delete process.env.FAVORITES_MAX_VENUES_PER_LIST;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FAVORITES_LIMITS } = require("./favorites.config");
    expect(FAVORITES_LIMITS.maxListsPerUser).toBe(20);
    expect(FAVORITES_LIMITS.maxVenuesPerList).toBe(200);
  });

  it("uses env values when set", () => {
    process.env.FAVORITES_MAX_LISTS_PER_USER = "5";
    process.env.FAVORITES_MAX_VENUES_PER_LIST = "50";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FAVORITES_LIMITS } = require("./favorites.config");
    expect(FAVORITES_LIMITS.maxListsPerUser).toBe(5);
    expect(FAVORITES_LIMITS.maxVenuesPerList).toBe(50);
  });

  it("throws at module load when a limit is set but not a valid positive integer", () => {
    process.env.FAVORITES_MAX_LISTS_PER_USER = "not-a-number";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(() => require("./favorites.config")).toThrow(/FAVORITES_MAX_LISTS_PER_USER/);
  });
});
