import { z } from "zod";
import { PRICE_RANGE_VALUES } from "../enums/price-range";

export const CreateFavoriteListSchema = z.object({
  name: z.string().min(1).max(80),
});
export type CreateFavoriteList = z.infer<typeof CreateFavoriteListSchema>;

// Minimal venue projection nested under a favorite (apps/api's `FavoritesService.listLists`
// selects only these fields on `favorite.venue` — enough to render a link back to the venue,
// not the full `Venue` shape).
const FavoriteVenueSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(220),
  category: z.string().min(1),
  priceRange: z.enum(PRICE_RANGE_VALUES),
  isBoutique: z.boolean(),
});

// `POST /me/lists/:id/venues` (apps/api's `FavoritesService.addVenue`) returns the upserted
// Prisma `Favorite` row.
export const FavoriteSchema = z.object({
  id: z.string().uuid(),
  listId: z.string().uuid(),
  venueId: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type Favorite = z.infer<typeof FavoriteSchema>;

// `GET /me/lists` (apps/api's `FavoritesService.listLists`) includes each list's `favorites`,
// each with a nested `venue` — see the `include` in `favorites.service.ts`. Zod strips unknown
// keys by default, so this relation must be declared here or the client silently loses it.
export const FavoriteListSchema = CreateFavoriteListSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.string().datetime(),
  favorites: z.array(
    z.object({
      id: z.string().uuid(),
      venueId: z.string().uuid(),
      venue: FavoriteVenueSchema,
    }),
  ),
});
export type FavoriteList = z.infer<typeof FavoriteListSchema>;
