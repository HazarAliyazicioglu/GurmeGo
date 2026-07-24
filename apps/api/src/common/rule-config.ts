export function getUrgentReportThreshold(): number {
  return Number(process.env.RULES_MOD_AUTO_HIDE_REPORTS ?? 3);
}
