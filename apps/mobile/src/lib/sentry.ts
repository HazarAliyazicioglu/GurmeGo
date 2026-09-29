import * as Sentry from "@sentry/react-native";

// Mirrors apps/api/src/common/sentry.ts and apps/web/src/lib/sentry.ts -- same two header keys,
// same reasoning. The mobile app has no server-side redact layer of its own; this is what stops a
// leaked X-User-Location (src/lib/api.ts's locationHeaders) or Authorization header from reaching
// Sentry once a real DSN is set.
const SENSITIVE_HEADERS = ["x-user-location", "authorization"];

export function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const headers = event.request?.headers;
  if (!headers) return event;
  for (const key of Object.keys(headers)) {
    if (SENSITIVE_HEADERS.includes(key.toLowerCase())) delete headers[key];
  }
  return event;
}

// docs/infrastructure.md §5 planned Sentry since MVP; API (#60) and web wired it up first, this
// closes the mobile side. No-op without EXPO_PUBLIC_SENTRY_DSN -- creating a Sentry account/DSN
// is a real external signup, same as Supabase/Railway/Vercel were, and stays the user's step.
// EXPO_PUBLIC_ prefix required for Metro to inline it into the native bundle (Expo SDK 49+); a
// literal `process.env.EXPO_PUBLIC_...` expression, not a dynamic lookup, per src/lib/env.ts.
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, environment: __DEV__ ? "development" : "production", beforeSend: scrubEvent });
}
