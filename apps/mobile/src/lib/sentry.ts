import * as Sentry from "@sentry/react-native";

// Mirrors apps/api/src/common/sentry.ts and apps/web/src/lib/sentry.ts -- same two header keys,
// same reasoning. The mobile app has no server-side redact layer of its own; this is what stops a
// leaked X-User-Location (src/lib/api.ts's locationHeaders) or Authorization header from reaching
// Sentry once a real DSN is set.
const SENSITIVE_HEADERS = ["x-user-location", "authorization"];

// cross-model-review (2026-09-29) MAJOR finding (apps/web/src/lib/sentry.ts has the full writeup):
// the venues list's keyset pagination cursor (apps/api's encodeCursor) carries the previous
// page's distance-from-user in meters, and DiscoveryScreen.tsx sends it back as a `cursor` query
// param on the next page's request -- Sentry's default fetch/XHR breadcrumb integration records
// the full request URL, so an unscrubbed breadcrumb history leaks the user's distance to specific
// venues. Stripping everything from `?`/`#` onward closes this without enumerating query keys.
function stripQueryAndHash(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

// cross-model-review (2026-09-29) MAJOR finding, documented not coded around: this beforeSend
// only runs for events the JS layer captures and hands to the JS SDK. @sentry/react-native also
// has a native layer (iOS/Android) that captures native crashes and their own native HTTP
// breadcrumbs independently -- those do NOT pass through this JS beforeSend before being queued
// for send. Closing that gap needs native-side scrubbing config (native init options or
// dashboard-side data scrubbing rules), which only matters once a real DSN/project exists -- out
// of scope while this stays a no-op. Revisit when EXPO_PUBLIC_SENTRY_DSN is actually set.
export function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const headers = event.request?.headers;
  if (headers) {
    for (const key of Object.keys(headers)) {
      if (SENSITIVE_HEADERS.includes(key.toLowerCase())) delete headers[key];
    }
  }
  if (event.request?.url) {
    event.request.url = stripQueryAndHash(event.request.url);
  }
  if (event.breadcrumbs) {
    for (const breadcrumb of event.breadcrumbs) {
      const url = breadcrumb.data?.url;
      if (typeof url === "string") breadcrumb.data!.url = stripQueryAndHash(url);
    }
  }
  return event;
}

// docs/infrastructure.md §5 planned Sentry since MVP; API (#60) and web wired it up first, this
// closes the mobile side. Without EXPO_PUBLIC_SENTRY_DSN, Sentry.init() is never called --
// creating a Sentry account/DSN is a real external signup, same as Supabase/Railway/Vercel were,
// and stays the user's step. (The @sentry/react-native module itself is still imported/evaluated
// either way, including its native module resolution -- this only guarantees init() doesn't run,
// not that the import is a zero-cost no-op.) EXPO_PUBLIC_ prefix required for Metro to inline it
// into the native bundle (Expo SDK 49+); a literal `process.env.EXPO_PUBLIC_...` expression, not
// a dynamic lookup, per src/lib/env.ts.
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, environment: __DEV__ ? "development" : "production", beforeSend: scrubEvent });
}
