import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const initSentryMock = vi.fn();
vi.mock("./src/lib/sentry", () => ({ initSentry: () => initSentryMock() }));

const captureRequestErrorMock = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureRequestError: captureRequestErrorMock }));

describe("register", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    initSentryMock.mockReset();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("calls initSentry for the nodejs runtime", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    const { register } = await import("./instrumentation");

    await register();

    expect(initSentryMock).toHaveBeenCalledOnce();
  });

  it("calls initSentry for the edge runtime", async () => {
    process.env.NEXT_RUNTIME = "edge";
    const { register } = await import("./instrumentation");

    await register();

    expect(initSentryMock).toHaveBeenCalledOnce();
  });

  it("does not call initSentry outside a recognized runtime", async () => {
    delete process.env.NEXT_RUNTIME;
    const { register } = await import("./instrumentation");

    await register();

    expect(initSentryMock).not.toHaveBeenCalled();
  });
});

// cross-model-review (2026-09-29) finding: without this export, errors Next.js handles
// internally during server rendering never reach Sentry -- error.tsx's captureException only
// sees what Next forwards to the client boundary, which in production is a sanitized
// message/digest, not the original error.
describe("onRequestError", () => {
  it("is wired to Sentry's own captureRequestError", async () => {
    const { onRequestError } = await import("./instrumentation");
    expect(onRequestError).toBe(captureRequestErrorMock);
  });
});
