import { initSentry } from "./src/lib/sentry";

// Next.js auto-loads this file for client-side instrumentation (stable since 15.3) -- no manual
// import needed elsewhere.
initSentry();
