import { parsePositiveIntEnv } from "../common/env.util";

// docs/DENETIM-RAPORU.md KRİTİK bulgu: rate limiting alone only bounds how FAST a user can write
// favorites, not how MUCH they accumulate over days/weeks. Validated once at module load, same
// fail-loud-on-typo pattern as rate-limit.config.ts and rule-config.ts.
export const FAVORITES_LIMITS = {
  maxListsPerUser: parsePositiveIntEnv(
    "FAVORITES_MAX_LISTS_PER_USER",
    process.env.FAVORITES_MAX_LISTS_PER_USER,
    20,
  ),
  maxVenuesPerList: parsePositiveIntEnv(
    "FAVORITES_MAX_VENUES_PER_LIST",
    process.env.FAVORITES_MAX_VENUES_PER_LIST,
    200,
  ),
};
