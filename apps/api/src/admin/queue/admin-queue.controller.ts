import { Controller, Get, ParseUUIDPipe, Post, Param, Query, Req, UseGuards } from "@nestjs/common";
import { AdminQueueListQuerySchema } from "@gurmego/shared";
import { AuthenticatedRequest } from "../../auth/jwt-auth.guard";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { RateLimit, RateLimitGuard } from "../../common/rate-limit.guard";
import { RATE_LIMITS } from "../../common/rate-limit.config";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { AdminQueueService } from "./admin-queue.service";

@Controller("admin/queue")
@UseGuards(RolesGuard, RateLimitGuard)
@RateLimit(RATE_LIMITS.admin.limit, RATE_LIMITS.admin.windowSeconds, { bucket: "admin" })
@Roles("curator", "admin")
export class AdminQueueController {
  constructor(private queue: AdminQueueService) {}

  @Get()
  list(@Query(new ZodValidationPipe(AdminQueueListQuerySchema)) query: ReturnType<(typeof AdminQueueListQuerySchema)["parse"]>) {
    return this.queue.list(query.type, query.status, query.limit);
  }

  @Post(":id/approve")
  approve(@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string, @Req() req: AuthenticatedRequest) {
    // Non-null assertion: `RolesGuard` (registered above via `@UseGuards`) already rejected the
    // request with 401 if `req.user` were missing, before this handler ever runs.
    return this.queue.approve(id, req.user!.id);
  }

  @Post(":id/reject")
  reject(@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string, @Req() req: AuthenticatedRequest) {
    return this.queue.reject(id, req.user!.id);
  }
}
