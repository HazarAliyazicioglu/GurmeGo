import { z } from "zod";

export const CreateFavoriteListSchema = z.object({
  name: z.string().min(1).max(80),
});
export type CreateFavoriteList = z.infer<typeof CreateFavoriteListSchema>;

export const FavoriteListSchema = CreateFavoriteListSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});
export type FavoriteList = z.infer<typeof FavoriteListSchema>;
