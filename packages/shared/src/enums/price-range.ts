export const PRICE_RANGE_VALUES = ["BUDGET", "MODERATE", "EXPENSIVE", "PREMIUM"] as const;
export type PriceRange = (typeof PRICE_RANGE_VALUES)[number];

export const PRICE_RANGE_LABELS: Record<PriceRange, string> = {
  BUDGET: "₺",
  MODERATE: "₺₺",
  EXPENSIVE: "₺₺₺",
  PREMIUM: "₺₺₺₺",
};
