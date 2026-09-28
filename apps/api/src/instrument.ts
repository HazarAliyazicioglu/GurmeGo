import { initSentry } from "./common/sentry";

// Cross-model review finding: initSentry() called from inside bootstrap() (main.ts) ran AFTER
// AppModule's own import graph had already been evaluated -- a module-load-time crash (e.g.
// common/rule-config.ts's requireEnv() throwing on a missing RULES_* var) would never reach
// Sentry. main.ts imports this file FIRST, before AppModule, so this side effect runs before any
// other module in the app's dependency graph does (Node's CommonJS module resolution runs a
// `require`'d module's body to completion before the next sibling `require` starts).
initSentry();
