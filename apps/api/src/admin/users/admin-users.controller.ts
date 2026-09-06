import { Body, Controller, Param, ParseUUIDPipe, Put, UseGuards } from "@nestjs/common";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { AdminUsersService } from "./admin-users.service";

@Controller("admin/users")
@UseGuards(RolesGuard)
@Roles("admin")
export class AdminUsersController {
  constructor(private users: AdminUsersService) {}

  @Put(":id/roles")
  assignRole(@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string, @Body("role") role: string) {
    return this.users.assignRole(id, role);
  }
}
