const mockInit = jest.fn();

jest.mock("@sentry/react-native", () => ({
  init: (...args: unknown[]) => mockInit(...args),
  captureException: jest.fn(),
}));

import { scrubEvent } from "./sentry";

// NFR-04 / mirrors apps/api/src/common/sentry.ts and apps/web/src/lib/sentry.ts: the mobile app
// sends the user's coordinates as the X-User-Location header (src/lib/api.ts's locationHeaders)
// on every location-aware request -- an unscrubbed Sentry event carrying that header, or a live
// session token via Authorization, would leak once a real DSN is set.
describe("scrubEvent", () => {
  it("removes x-user-location and authorization headers (any casing) from the event", () => {
    const event = {
      request: {
        headers: {
          "x-user-location": "40.99,29.02",
          Authorization: "Bearer secret-token",
          "content-type": "application/json",
        },
      },
    } as any;

    const result = scrubEvent(event);

    expect(result.request?.headers).toEqual({ "content-type": "application/json" });
  });

  it("passes through an event with no request/headers unchanged", () => {
    const event = { message: "boom" } as any;
    expect(scrubEvent(event)).toEqual(event);
  });
});

describe("initSentry", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    mockInit.mockReset();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("does not call Sentry.init when EXPO_PUBLIC_SENTRY_DSN is unset", () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    const { initSentry } = require("./sentry");

    initSentry();

    expect(mockInit).not.toHaveBeenCalled();
  });

  it("calls Sentry.init with the DSN when EXPO_PUBLIC_SENTRY_DSN is set", () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";
    const { initSentry } = require("./sentry");

    initSentry();

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: "https://examplePublicKey@o0.ingest.sentry.io/0" }),
    );
  });
});
