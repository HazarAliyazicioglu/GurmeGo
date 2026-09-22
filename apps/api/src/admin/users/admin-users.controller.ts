import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query, Req, UseGuards } from "@nestjs/common";
import { AssignRoleSchema, AdminUserSearchQuerySchema, type AssignRoleInput, type AdminUserSearchQuery } from "@gurmego/shared";
import { AuthenticatedRequest } from "../../auth/jwt-auth.guard";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { RateLimit, RateLimitGuard } from "../../common/rate-limit.guard";
import { RATE_LIMITS } from "../../common/rate-limit.config";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { AdminUsersService } from "./admin-users.service";

@Controller("admin/users")
@UseGuards(RolesGuard, RateLimitGuard)
@RateLimit(RATE_LIMITS.admin.limit, RATE_LIMITS.admin.windowSeconds, { bucket: "admin" })
@Roles("admin")
export class AdminUsersController {
  constructor(private users: AdminUsersService) {}

  @Get()
  search(@Query(new ZodValidationPipe(AdminUserSearchQuerySchema)) query: AdminUserSearchQuery) {
    return this.users.search(query.search);
  }

  @Put(":id/roles")
  assignRole(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body(new ZodValidationPipe(AssignRoleSchema)) body: AssignRoleInput,
    @Req() req: AuthenticatedRequest,
  ) {
    // `RolesGuard` already rejected the request with 401 if `req.user` were missing.
    return this.users.assignRole(id, body.role, req.user!.id);
  }
}
