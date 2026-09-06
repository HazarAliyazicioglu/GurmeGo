import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

const MVP_ASSIGNABLE_ROLES = ["curator"];

// Prisma's `update()` throws P2025 ("record not found") for a well-formed but non-existent
// `userId` -- left uncaught, the global exception filter turns that into a 500, not a clean 404.
function isRecordNotFound(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

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
    try {
      return await this.prisma.user.update({ where: { id: userId }, data: { role: role.toUpperCase() as any } });
    } catch (err) {
      if (isRecordNotFound(err)) {
        const notFound = new NotFoundException({ error: { code: "USER_NOT_FOUND", message: "Kullanıcı bulunamadı" } });
        notFound.message = "Kullanıcı bulunamadı";
        throw notFound;
      }
      throw err;
    }
  }
}
