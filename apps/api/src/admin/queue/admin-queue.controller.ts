import { Controller, Get, ParseUUIDPipe, Post, Param, Query, Req, UseGuards } from "@nestjs/common";
import { AdminQueueListQuerySchema } from "@gurmego/shared";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { AdminQueueService } from "./admin-queue.service";

@Controller("admin/queue")
@UseGuards(RolesGuard)
@Roles("curator", "admin")
export class AdminQueueController {
  constructor(private queue: AdminQueueService) {}

  @Get()
  list(@Query(new ZodValidationPipe(AdminQueueListQuerySchema)) query: ReturnType<(typeof AdminQueueListQuerySchema)["parse"]>) {
    return this.queue.list(query.type, query.status);
  }

  @Post(":id/approve")
  approve(@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string, @Req() req: any) {
    return this.queue.approve(id, req.user.id);
  }

  @Post(":id/reject")
  reject(@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string, @Req() req: any) {
    return this.queue.reject(id, req.user.id);
  }
}
