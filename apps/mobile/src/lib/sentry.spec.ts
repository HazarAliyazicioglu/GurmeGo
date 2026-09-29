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

  // cross-model-review (2026-09-29) MAJOR: DiscoveryScreen.tsx's keyset pagination cursor
  // (apps/api's encodeCursor) carries the previous page's distance-from-user in meters as a
  // `?cursor=` query param on the next getVenues() call -- Sentry's default fetch/XHR breadcrumb
  // integration records the full request URL, so an unscrubbed breadcrumb history leaks the
  // user's distance to specific venues.
  it("strips the query string and hash from breadcrumb URLs", () => {
    const event = {
      breadcrumbs: [
        { type: "http", data: { url: "http://localhost:3001/v1/venues?cursor=eyJsYXN0RGlzdGFuY2VNIjo0MjB9" } },
        { type: "navigation", data: { url: "/favoriler" } },
      ],
    } as any;

    const result = scrubEvent(event);

    expect(result.breadcrumbs?.[0].data?.url).toBe("http://localhost:3001/v1/venues");
    expect(result.breadcrumbs?.[1].data?.url).toBe("/favoriler");
  });

  it("strips the query string and hash from event.request.url", () => {
    const event = { request: { url: "http://localhost:3001/v1/venues?cursor=secret#fragment" } } as any;

    const result = scrubEvent(event);

    expect(result.request?.url).toBe("http://localhost:3001/v1/venues");
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
    // jest.resetModules() (beforeEach) means this require() is a fresh module instance -- its
    // scrubEvent is a different function object than the one imported at file scope above, so
    // the beforeSend assertion below must compare against THIS instance's scrubEvent.
    const { initSentry, scrubEvent: freshScrubEvent } = require("./sentry");

    initSentry();

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
        // cross-model-review (2026-09-29) MAJOR: objectContaining alone doesn't fail if
        // beforeSend were dropped from the real call -- assert it's wired to the actual scrub
        // function, not just that init() was called with a DSN.
        beforeSend: freshScrubEvent,
      }),
    );
  });
});
