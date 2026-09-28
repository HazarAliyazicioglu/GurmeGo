import * as Sentry from "@sentry/node";

// NFR-04 / cross-model review finding: pino's redact config (app.module.ts) only scrubs the
// structured request log -- Sentry ships the raw event through a separate pipe redact never
// touches. Same two header keys pino redacts, so a leaked event can't carry the user's
// coordinates (x-user-location) or a live session token (authorization) once a real DSN is set.
const SENSITIVE_HEADERS = ["x-user-location", "authorization"];

export function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const headers = event.request?.headers;
  if (!headers) return event;
  for (const key of Object.keys(headers)) {
    if (SENSITIVE_HEADERS.includes(key.toLowerCase())) delete headers[key];
  }
  return event;
}

// docs/infrastructure.md §5 has planned Sentry since MVP but nothing wired it up until now.
// No-op without SENTRY_DSN -- creating a Sentry account/DSN is a real external signup, same as
// Supabase/Railway/Vercel were, and stays the user's step, not something set here.
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, environment: process.env.NODE_ENV ?? "development", beforeSend: scrubEvent });
}
