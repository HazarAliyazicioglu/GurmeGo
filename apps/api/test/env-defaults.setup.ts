// Runs before every test file (Jest `setupFiles`, one execution per test file). Rule-engine
// thresholds (rule-config.ts) are intentionally REQUIRED with no hardcoded fallback in source
// (CLAUDE.md: "Rule engine eşiklerini ... hardcode etme") -- the constants are read once, at
// module load, and throw if the env var is absent. That means every spec file that statically
// imports a service depending on rule-config.ts (boutique.service.ts, re-verify.service.ts,
// admin-reports.service.ts, admin-queue.service.ts, reports.service.ts) needs these vars present
// BEFORE that import runs, exactly like a real deployment's .env would provide them.
//
// Values match the documented real-deployment defaults in apps/api/.env.example / docs/rule-engine.md
// (RULES_BOUTIQUE_MAX_BRANCHES=3, RULES_STALE_DAYS=90, RULES_MOD_AUTO_HIDE_REPORTS=3). Using `??=`
// so a spec file that deliberately sets its own value before this runs (none currently do) isn't
// clobbered, and so rule-config.spec.ts's own "missing env var throws" tests -- which delete these
// and jest.resetModules() to re-require the module fresh -- aren't affected by this file re-running
// on the next test file.
process.env.RULES_BOUTIQUE_MAX_BRANCHES ??= "3";
process.env.RULES_STALE_DAYS ??= "90";
process.env.RULES_MOD_AUTO_HIDE_REPORTS ??= "3";
