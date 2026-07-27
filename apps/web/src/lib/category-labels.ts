// Real backend category values only (`apps/api/prisma/seed.ts` / `VenuesRepository`) — the API
// never returns anything else, so this map is exported and reused wherever a category needs a
// Turkish label instead of each caller inventing its own vocabulary.
export const CATEGORY_LABELS: Record<string, string> = {
  cafe: "Kahve",
  restaurant: "Restoran",
  bakery: "Fırın",
  "street-food": "Sokak lezzeti",
};
