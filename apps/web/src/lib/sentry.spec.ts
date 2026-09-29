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
