import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const MVP_ASSIGNABLE_ROLES = ["curator", "admin"];

@Injectable()
export class AdminUsersService {
  constructor(private prisma: PrismaService) {}

  async assignRole(userId: string, role: string) {
    if (!MVP_ASSIGNABLE_ROLES.includes(role)) {
      throw new BadRequestException({
        error: { code: "ROLE_NOT_AVAILABLE", message: "Bu rol MVP'de kullanılamaz (Faz 2)" },
        // Nest's HttpException#message only reads a top-level `message` string (see
        // @nestjs/common/exceptions/http.exception.js initMessage()) — duplicated here so
        // `.rejects.toThrow("...")` and internal logging see the real message, not the
        // generic "Bad Request Exception" fallback. HTTP clients still read `error.message`.
        message: "Bu rol MVP'de kullanılamaz (Faz 2)",
      });
    }
    return this.prisma.user.update({ where: { id: userId }, data: { role: role.toUpperCase() as any } });
  }
}
