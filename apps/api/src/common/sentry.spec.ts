const initMock = jest.fn();

jest.mock("@sentry/node", () => ({ init: (...args: unknown[]) => initMock(...args) }));

// Ops audit (2026-09-28): docs/infrastructure.md §5 has planned Sentry ("API + web tek projede")
// since MVP but nothing wired it up -- unexpected 500s vanish into Railway logs no one watches.
// Guarded by SENTRY_DSN so this is a no-op (no crash risk) until a real account/DSN exists --
// creating that account is a real external signup the user does themselves, same as Supabase/
// Railway/Vercel were.
describe("initSentry", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    initMock.mockReset();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("does not call Sentry.init when SENTRY_DSN is unset", async () => {
    delete process.env.SENTRY_DSN;
    const { initSentry } = await import("./sentry");

    initSentry();

    expect(initMock).not.toHaveBeenCalled();
  });

  it("calls Sentry.init with the DSN and environment when SENTRY_DSN is set", async () => {
    process.env.SENTRY_DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";
    process.env.NODE_ENV = "production";
    const { initSentry } = await import("./sentry");

    initSentry();

    expect(initMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
        environment: "production",
      }),
    );
  });

  it("defaults environment to 'development' when NODE_ENV is unset", async () => {
    process.env.SENTRY_DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";
    delete process.env.NODE_ENV;
    const { initSentry } = await import("./sentry");

    initSentry();

    expect(initMock).toHaveBeenCalledWith(expect.objectContaining({ environment: "development" }));
  });
});
