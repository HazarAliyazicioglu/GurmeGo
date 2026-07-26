import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const MVP_ASSIGNABLE_ROLES = ["curator"];

@Injectable()
export class AdminUsersService {
  constructor(private prisma: PrismaService) {}

  async assignRole(userId: string, role: string) {
    if (!MVP_ASSIGNABLE_ROLES.includes(role)) {
      // The HTTP response body must stay exactly `{ error: { code, message } }` per
      // docs/api-spec.md (no top-level `message`), but NestJS's HttpException only
      // derives `.message` (the Error message, used by e.g. `toThrow`) from a
      // top-level `message` property on the response object. Set it explicitly
      // after construction so the JSON body is unaffected.
      const ex = new BadRequestException({
        error: { code: "ROLE_NOT_AVAILABLE", message: "Bu rol MVP'de kullanılamaz (Faz 2)" },
      });
      ex.message = "Bu rol MVP'de kullanılamaz (Faz 2)";
      throw ex;
    }
    return this.prisma.user.update({ where: { id: userId }, data: { role: role.toUpperCase() as any } });
  }
}
