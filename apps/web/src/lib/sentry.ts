import * as Sentry from "@sentry/nextjs";

// Mirrors apps/api/src/common/sentry.ts's scrubEvent -- same two header keys, same reasoning.
// The web app has no server-side redact layer at all (unlike the API's pino config), so this is
// the only thing standing between a real DSN and a leaked coordinate/session token.
const SENSITIVE_HEADERS = ["x-user-location", "authorization"];

// cross-model-review (2026-09-29) finding: header scrubbing alone left two more leak paths open.
// 1) BLOCKER: supabase.ts uses the default implicit auth flow (no `flowType` override), so
//    Supabase's recovery/magic-link redirect puts live session tokens in the page URL hash
//    (/sifre-yenile#access_token=...&refresh_token=...) -- Sentry's browser SDK attaches the
//    current page URL to every event via event.request.url, independent of what triggered the
//    capture.
// 2) MAJOR: the venues list's keyset pagination cursor (apps/api's encodeCursor) carries the
//    previous page's distance-from-user in meters; both apps send it back as a `?cursor=` query
//    param, and Sentry's default fetch/XHR breadcrumb integration records the full request URL.
// Stripping everything from `?`/`#` onward closes both without needing to enumerate every
// possible sensitive query key.
function stripQueryAndHash(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

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

// docs/infrastructure.md §5 has planned Sentry ("API + web tek projede") since MVP; apps/api
// wired it up in #60, this closes the web side. Without NEXT_PUBLIC_SENTRY_DSN, Sentry.init() is
// never called -- creating a Sentry account/DSN is a real external signup, same as Supabase/
// Railway/Vercel were, and stays the user's step, not something set here. (The @sentry/nextjs
// module itself is still imported/evaluated either way -- this only guarantees init() doesn't
// run, not that the import is a zero-cost no-op.) Public (not server-only) because the client
// bundle needs it too -- a Sentry DSN is a write-only ingest endpoint, not a secret.
export function initSentry(): void {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, environment: process.env.NODE_ENV ?? "development", beforeSend: scrubEvent });
}
