import { Controller, Get, Post, Param, Query, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { AdminQueueService } from "./admin-queue.service";

@Controller("admin/queue")
@UseGuards(RolesGuard)
@Roles("curator", "admin")
export class AdminQueueController {
  constructor(private queue: AdminQueueService) {}

  @Get()
  list(@Query("type") type?: string, @Query("status") status?: string) {
    return this.queue.list(type, status);
  }

  @Post(":id/approve")
  approve(@Param("id") id: string, @Req() req: any) {
    return this.queue.approve(id, req.user.id);
  }

  @Post(":id/reject")
  reject(@Param("id") id: string, @Req() req: any) {
    return this.queue.reject(id, req.user.id);
  }
}
