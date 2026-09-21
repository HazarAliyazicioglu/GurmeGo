// `Number(someTypoString)` is `NaN`, and `count > NaN` is always `false` -- a limit compared against a NaN
// silently turns its guard into a permanent no-op. Validated once at module load (boot time), not per
// request: a set-but-invalid env var (typo, wrong format) throws immediately with a clear message instead
// of quietly disabling the limit for the life of the process.
export function parsePositiveIntEnv(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer if set, got: "${raw}"`);
  }
  return parsed;
}
