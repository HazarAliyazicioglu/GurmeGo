import * as Sentry from "@sentry/nextjs";

// Mirrors apps/api/src/common/sentry.ts's scrubEvent -- same two header keys, same reasoning.
// The web app has no server-side redact layer at all (unlike the API's pino config), so this is
// the only thing standing between a real DSN and a leaked coordinate/session token.
const SENSITIVE_HEADERS = ["x-user-location", "authorization"];

export function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const headers = event.request?.headers;
  if (!headers) return event;
  for (const key of Object.keys(headers)) {
    if (SENSITIVE_HEADERS.includes(key.toLowerCase())) delete headers[key];
  }
  return event;
}

// docs/infrastructure.md §5 has planned Sentry ("API + web tek projede") since MVP; apps/api
// wired it up in #60, this closes the web side. No-op without NEXT_PUBLIC_SENTRY_DSN -- creating
// a Sentry account/DSN is a real external signup, same as Supabase/Railway/Vercel were, and stays
// the user's step, not something set here. Public (not server-only) because the client bundle
// needs it too -- a Sentry DSN is a write-only ingest endpoint, not a secret.
export function initSentry(): void {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, environment: process.env.NODE_ENV ?? "development", beforeSend: scrubEvent });
}
