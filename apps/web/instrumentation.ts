// Next.js auto-loads this file's register() once per server/edge runtime start -- the
// server/edge counterpart to instrumentation-client.ts. Dynamic import keeps @sentry/nextjs's
// server bundle out of the edge runtime when NEXT_RUNTIME is "edge" but the DSN is unset.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    const { initSentry } = await import("./src/lib/sentry");
    initSentry();
  }
}
