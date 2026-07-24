// GurmeGo — minimal service worker (PWA installability, not offline-first).
//
// Scope, per docs/superpowers/specs/2026-07-24-web-pwa-client-design.md ("PWA"):
// "manifest.json + service worker ... Offline-first değil, yalnızca 'ana ekrana ekle'
// + temel önbellekleme." (add-to-home-screen + basic caching only.)
//
// - Caches the static app shell (root document, manifest, icons) on install.
// - Serves cached static assets cache-first so repeat loads are fast/offline-tolerant.
// - Everything else (navigations to other routes, API calls, venue data) goes straight
//   to the network — this app's data changes and there is no cache-invalidation
//   strategy, so caching dynamic venue listings would risk serving stale data.
// - Bumping CACHE_NAME on the next deploy causes `activate` to drop the old cache.

const CACHE_VERSION = "v1";
const CACHE_NAME = `gurmego-static-${CACHE_VERSION}`;

const APP_SHELL = ["/", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle same-origin GET requests for known static assets cache-first.
  // Everything else (navigations, API calls, cross-origin requests) passes through
  // to the network untouched — no caching of dynamic/venue data.
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  const isStaticAsset =
    APP_SHELL.includes(url.pathname) || url.pathname.startsWith("/icons/");

  if (!isStaticAsset) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        return response;
      });
    })
  );
});
