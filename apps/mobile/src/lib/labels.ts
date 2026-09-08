// Presentational label lookups -- mirrors apps/web's own DAY_LABELS (venue-detail.tsx) and price
// chip labels (venue-filters.tsx) so both clients show identical Turkish text for the same raw
// values. Pure display mapping, no business logic (the actual price tiers/day keys are decided by
// apps/api).

export const PRICE_LABELS: Record<string, string> = {
  BUDGET: "₺",
  MODERATE: "₺₺",
  EXPENSIVE: "₺₺₺",
  PREMIUM: "₺₺₺₺",
};

export const DAY_LABELS: Record<string, string> = {
  monday: "Pzt", mon: "Pzt",
  tuesday: "Sal", tue: "Sal",
  wednesday: "Çar", wed: "Çar",
  thursday: "Per", thu: "Per",
  friday: "Cum", fri: "Cum",
  saturday: "Cmt", sat: "Cmt",
  sunday: "Paz", sun: "Paz",
};
