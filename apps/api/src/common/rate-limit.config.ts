import { parsePositiveIntEnv } from "./env.util";

export const RATE_LIMITS = {
  read: {
    limit: parsePositiveIntEnv("RATE_LIMIT_READ_PER_MINUTE", process.env.RATE_LIMIT_READ_PER_MINUTE, 100),
    windowSeconds: 60,
  },
  report: {
    limit: parsePositiveIntEnv("RATE_LIMIT_REPORT_PER_DAY", process.env.RATE_LIMIT_REPORT_PER_DAY, 10),
    windowSeconds: 86400,
  },
  // docs/DENETIM-RAPORU.md KRİTİK bulgu: favorite-list write endpoints (create list, add/remove
  // venue) had no rate limit at all.
  write: {
    limit: parsePositiveIntEnv("RATE_LIMIT_WRITE_PER_MINUTE", process.env.RATE_LIMIT_WRITE_PER_MINUTE, 20),
    windowSeconds: 60,
  },
  // docs/DENETIM-RAPORU.md Orta: admin endpoints had no limit. `admin` is ONE shared budget per IP across
  // the whole admin API (see RateLimit's `bucket`); `adminImport` is separate because a CSV import is by far
  // the heaviest operation (file parse + N inserts).
  admin: {
    limit: parsePositiveIntEnv("RATE_LIMIT_ADMIN_PER_MINUTE", process.env.RATE_LIMIT_ADMIN_PER_MINUTE, 60),
    windowSeconds: 60,
  },
  adminImport: {
    limit: parsePositiveIntEnv("RATE_LIMIT_ADMIN_IMPORT_PER_HOUR", process.env.RATE_LIMIT_ADMIN_IMPORT_PER_HOUR, 5),
    windowSeconds: 3600,
  },
};

// How long an expired `rate_limit_counters` row is kept after its window closes before
// RateLimitCleanupService's cron deletes it (see that file). Kept as a buffer, not "delete the
// instant windowEnd passes," purely so a counter mid-flight in a request that started just before
// its window's boundary and increments a hair after `windowEnd` still finds its row instead of
// racing the cleanup job.
export const RATE_LIMIT_CLEANUP_RETENTION_MINUTES = parsePositiveIntEnv(
  "RATE_LIMIT_CLEANUP_RETENTION_MINUTES",
  process.env.RATE_LIMIT_CLEANUP_RETENTION_MINUTES,
  60,
);
