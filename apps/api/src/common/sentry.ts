import * as Sentry from "@sentry/node";

// docs/infrastructure.md §5 has planned Sentry since MVP but nothing wired it up until now.
// No-op without SENTRY_DSN -- creating a Sentry account/DSN is a real external signup, same as
// Supabase/Railway/Vercel were, and stays the user's step, not something set here.
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, environment: process.env.NODE_ENV ?? "development" });
}
