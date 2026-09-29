import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const initMock = vi.fn();
vi.mock("@sentry/nextjs", () => ({ init: (...args: unknown[]) => initMock(...args) }));

import { scrubEvent } from "./sentry";

// NFR-04 / mirrors apps/api/src/common/sentry.ts: pino's redact (API) has no web equivalent at
// all -- Sentry ships the raw event through its own pipe, so a leaked event could carry the
// user's coordinates (X-User-Location, set in api.ts's locationHeaders) or a live session token
// (Authorization) once a real DSN is set, unless scrubbed here first.
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

  // cross-model-review (2026-09-29) BLOCKER: supabase.ts's implicit auth flow (no `flowType`
  // override) puts recovery/magic-link tokens in the page URL hash (/sifre-yenile#access_token=
  // ...&refresh_token=...) -- Sentry's browser SDK attaches the current page URL to every event
  // via event.request.url regardless of what triggered the capture, so header scrubbing alone
  // left live session tokens exposed the moment a real DSN was set.
  it("strips the query string and hash from event.request.url", () => {
    const event = {
      request: { url: "https://gurmego.com/sifre-yenile#access_token=secret&refresh_token=also-secret" },
    } as any;

    const result = scrubEvent(event);

    expect(result.request?.url).toBe("https://gurmego.com/sifre-yenile");
  });

  // cross-model-review (2026-09-29) MAJOR: the venues list's keyset pagination cursor
  // (apps/api/src/venues/venues.repository.ts's encodeCursor) carries the previous page's
  // distance-from-user in meters, and both web and mobile send it back as a `?cursor=` query
  // param on the next page's request -- Sentry's default fetch/XHR breadcrumb integration
  // records the full request URL (including query string), so an unscrubbed breadcrumb history
  // leaks the user's distance to specific venues, which header scrubbing never touched.
  it("strips the query string and hash from breadcrumb URLs", () => {
    const event = {
      breadcrumbs: [
        { type: "http", data: { url: "https://gurmego.com/v1/venues?cursor=eyJsYXN0RGlzdGFuY2VNIjo0MjB9" } },
        { type: "navigation", data: { url: "/favoriler" } },
      ],
    } as any;

    const result = scrubEvent(event);

    expect(result.breadcrumbs?.[0].data?.url).toBe("https://gurmego.com/v1/venues");
    expect(result.breadcrumbs?.[1].data?.url).toBe("/favoriler");
  });
});

describe("initSentry", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    initMock.mockReset();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("does not call Sentry.init when NEXT_PUBLIC_SENTRY_DSN is unset", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    const { initSentry } = await import("./sentry");

    initSentry();

    expect(initMock).not.toHaveBeenCalled();
  });

  it("calls Sentry.init with the DSN and environment when NEXT_PUBLIC_SENTRY_DSN is set", async () => {
    process.env = {
      ...process.env,
      NEXT_PUBLIC_SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0",
      NODE_ENV: "production",
    };
    // vi.resetModules() (beforeEach) means this dynamic import is a fresh module instance --
    // its scrubEvent is a different function object than the one imported at file scope above,
    // so the beforeSend assertion below must compare against THIS instance's scrubEvent.
    const { initSentry, scrubEvent: freshScrubEvent } = await import("./sentry");

    initSentry();

    expect(initMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
        environment: "production",
        // cross-model-review (2026-09-29) MAJOR: objectContaining alone doesn't fail if
        // beforeSend were dropped from the real call -- assert it's wired to the actual scrub
        // function, not just that init() was called with a DSN.
        beforeSend: freshScrubEvent,
      }),
    );
  });

  it("defaults environment to 'development' when NODE_ENV is unset", async () => {
    const { NODE_ENV: _unused, ...envWithoutNodeEnv } = process.env;
    process.env = {
      ...envWithoutNodeEnv,
      NEXT_PUBLIC_SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0",
    } as unknown as NodeJS.ProcessEnv;
    const { initSentry } = await import("./sentry");

    initSentry();

    expect(initMock).toHaveBeenCalledWith(expect.objectContaining({ environment: "development" }));
  });
});
