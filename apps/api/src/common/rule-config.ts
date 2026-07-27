// Single source of truth for every rule-engine threshold (CLAUDE.md: "Rule engine eşiklerini ...
// hardcode etme" -- these values must come from config/`RULES_*` env vars, never a hardcoded
// fallback baked into source). Mirrors the `requireEnv()` pattern established in
// apps/api/src/auth/jwt-auth.guard.ts: read once at module load, throw immediately with an
// actionable message if the var is missing or malformed, so a misconfigured deployment fails to
// start instead of silently running with a value nobody chose.
//
// Before this file, `RULES_STALE_DAYS` was read independently in both re-verify.service.ts and
// admin-reports.service.ts (each with its own `?? 90` fallback) -- two sources of truth for the
// same threshold that could drift apart. Both now import `getStaleDays()` from here.
function requirePositiveIntEnv(name: string): number {
  const raw = process.env[name];
  if (raw === undefined) {
    throw new Error(`${name} is required (set it in the environment/.env file)`);
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got: "${raw}"`);
  }
  return parsed;
}

// Computed once at module load (like rate-limit.config.ts's RATE_LIMITS) so a missing/invalid
// RULES_* env var surfaces as a boot-time crash, not a hard-to-trace failure deep in a request.
const RULE_THRESHOLDS = {
  urgentReportCount: requirePositiveIntEnv("RULES_MOD_AUTO_HIDE_REPORTS"),
  boutiqueMaxBranches: requirePositiveIntEnv("RULES_BOUTIQUE_MAX_BRANCHES"),
  staleDays: requirePositiveIntEnv("RULES_STALE_DAYS"),
};

export function getUrgentReportThreshold(): number {
  return RULE_THRESHOLDS.urgentReportCount;
}

export function getBoutiqueMaxBranches(): number {
  return RULE_THRESHOLDS.boutiqueMaxBranches;
}

export function getStaleDays(): number {
  return RULE_THRESHOLDS.staleDays;
}
