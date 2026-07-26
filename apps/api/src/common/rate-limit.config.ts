export const RATE_LIMITS = {
  read: {
    limit: Number(process.env.RATE_LIMIT_READ_PER_MINUTE ?? 100),
    windowSeconds: 60,
  },
  report: {
    limit: Number(process.env.RATE_LIMIT_REPORT_PER_DAY ?? 10),
    windowSeconds: 86400,
  },
};
