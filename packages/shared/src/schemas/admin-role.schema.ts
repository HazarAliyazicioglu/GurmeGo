import { z } from "zod";

// PUT /admin/users/:id/roles body. Only the SHAPE is validated here; which roles are assignable is a
// business rule that stays in AdminUsersService (MVP allow-list), so tightening or opening it up is a
// config/service change, never a schema change.
export const AssignRoleSchema = z.object({
  role: z.string().min(1).max(50),
});
export type AssignRoleInput = z.infer<typeof AssignRoleSchema>;
