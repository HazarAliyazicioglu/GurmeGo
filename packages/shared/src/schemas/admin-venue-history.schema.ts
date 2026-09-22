import { z } from "zod";

// GET /admin/venues?search=<term> query param. Same `min(2)` reasoning as
// AdminUserSearchQuerySchema: a 1-character term matches too broadly on an internal tool with no
// other filter.
export const AdminVenueSearchQuerySchema = z.object({
  search: z.string().min(2).max(100),
});
export type AdminVenueSearchQuery = z.infer<typeof AdminVenueSearchQuerySchema>;

// GET /admin/venues?search=<term>'s response: a capped list of matching venues, matched on name OR
// slug. `status` (not surfaced on the public VenueListItemSchema) is shown here because an admin
// picking a venue to inspect its history needs to distinguish a DRAFT from a PUBLISHED one.
export const AdminVenueSearchResultSchema = z.array(
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  }),
);
export type AdminVenueSearchResult = z.infer<typeof AdminVenueSearchResultSchema>;

// GET /admin/venues/:id/versions's response: newest-first list of a venue's VenueVersion rows,
// WITHOUT the full `snapshot` JSON blob -- the admin history screen only needs "when, by whom" to
// let a curator pick which version to revert to; the snapshot itself is applied server-side by
// POST /admin/venues/:id/revert/:versionId, never rendered client-side.
export const AdminVenueVersionListSchema = z.array(
  z.object({
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    createdBy: z.string().nullable(),
  }),
);
export type AdminVenueVersionList = z.infer<typeof AdminVenueVersionListSchema>;
