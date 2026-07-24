"use client";

import { useEffect } from "react";

// Registers /sw.js after mount only — never during render — so this component is safe to
// compose into the server-rendered root layout (`RootLayout` stays a Server Component). Same
// client-boundary pattern as `WhatsappShareButton`/`ReportForm`/`FavoriteButton`: `navigator`
// only exists in the browser, so touching it outside an effect breaks server rendering.
//
// See docs/superpowers/specs/2026-07-24-web-pwa-client-design.md ("PWA") — the service worker
// exists for "ana ekrana ekle" (add to home screen) installability, not offline-first caching.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failure (unsupported browser, dev-server quirk, etc.) must never break
      // the app — PWA install/caching is a progressive enhancement, not a requirement.
    });
  }, []);

  return null;
}
