import { z } from "zod";

// GET /admin/users?search=<term> query param. `min(2)`: a 1-character search would match a large
// fraction of any real email list and defeats the point of "find one specific user" -- same
// reasoning as AdminQueueListQuerySchema's `limit` cap, a deliberate ceiling on an internal tool's
// worst case, not a public-facing UX nicety.
export const AdminUserSearchQuerySchema = z.object({
  search: z.string().min(2).max(100),
});
export type AdminUserSearchQuery = z.infer<typeof AdminUserSearchQuerySchema>;

// GET /admin/users?search=<term>'s response: a capped list of matching users, email-substring
// matched. Role is the real `UserRole` enum (not just MVP_ASSIGNABLE_ROLES) -- this endpoint
// reports the CURRENT role, unlike AssignRoleSchema which only validates what can be SET.
export const AdminUserSearchResultSchema = z.array(
  z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: z.enum(["USER", "APPROVED_RATER", "CURATOR", "ADMIN"]),
  }),
);
export type AdminUserSearchResult = z.infer<typeof AdminUserSearchResultSchema>;
