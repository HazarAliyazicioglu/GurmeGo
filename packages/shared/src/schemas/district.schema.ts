import { z } from "zod";

export const DistrictSchema = z.object({
  id: z.string().uuid(),
  cityId: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
});
export type District = z.infer<typeof DistrictSchema>;
