// Next.js auto-loads this file's register() once per server/edge runtime start -- the
// server/edge counterpart to instrumentation-client.ts. register()'s own dynamic import avoids
// evaluating src/lib/sentry.ts unless a runtime actually starts, but the onRequestError export
// below needs @sentry/nextjs itself at module scope regardless (Next.js only recognizes
// onRequestError as a static export, not one assigned after an await) -- this project has no
// edge routes today, so that's an acceptable, SDK-documented trade-off, not an oversight.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    const { initSentry } = await import("./src/lib/sentry");
    initSentry();
  }
}

// cross-model-review (2026-09-29) finding: without this, errors Next.js handles internally during
// server rendering (e.g. a Server Component throw) never reach Sentry -- error.tsx's
// captureException only sees what Next forwards to the client error boundary, which in
// production is a sanitized message/digest, not the original error. `onRequestError` is Next's
// own instrumentation hook for this and safely no-ops without an initialized Sentry client (same
// as every other capture call here), so it's exported unconditionally.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
