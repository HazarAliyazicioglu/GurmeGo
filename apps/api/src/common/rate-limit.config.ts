// `Number(someTypoString)` is `NaN`, and `count > NaN` is always `false` -- a rate-limit guard
// comparing a request count against a NaN limit silently becomes a permanent no-op instead of
// failing loudly. Validated once here, at module load (boot time), not per-request: a set-but-
// invalid env var (typo, wrong format) throws immediately on startup with a clear message,
// instead of quietly disabling rate limiting for the life of the process.
function parsePositiveIntEnv(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer if set, got: "${raw}"`);
  }
  return parsed;
}

export const RATE_LIMITS = {
  read: {
    limit: parsePositiveIntEnv("RATE_LIMIT_READ_PER_MINUTE", process.env.RATE_LIMIT_READ_PER_MINUTE, 100),
    windowSeconds: 60,
  },
  report: {
    limit: parsePositiveIntEnv("RATE_LIMIT_REPORT_PER_DAY", process.env.RATE_LIMIT_REPORT_PER_DAY, 10),
    windowSeconds: 86400,
  },
};
