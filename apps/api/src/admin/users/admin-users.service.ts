import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma, type UserRole } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";

const MVP_ASSIGNABLE_ROLES = ["curator"];

// Prisma's `update()` throws P2025 ("record not found") for a well-formed but non-existent
// `userId` -- left uncaught, the global exception filter turns that into a 500, not a clean 404.
function isRecordNotFound(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

function userNotFound() {
  const notFound = new NotFoundException({ error: { code: "USER_NOT_FOUND", message: "Kullanıcı bulunamadı" } });
  notFound.message = "Kullanıcı bulunamadı";
  return notFound;
}

@Injectable()
export class AdminUsersService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async assignRole(userId: string, role: string, actorId: string) {
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
      // Role change and its audit row commit together or not at all (ADR 006): if the audit write
      // fails, the role is NOT changed (fail-closed).
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const existing = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
        if (!existing) throw userNotFound();
        const updated = await tx.user.update({ where: { id: userId }, data: { role: role.toUpperCase() as UserRole } });
        await this.audit.record(tx, {
          actorId,
          action: "ROLE_ASSIGNED",
          targetType: "User",
          targetId: userId,
          before: { role: existing.role },
          after: { role: updated.role },
        });
        return updated;
      });
    } catch (err) {
      // Race: the row vanished between findUnique and update.
      if (isRecordNotFound(err)) throw userNotFound();
      throw err;
    }
  }
}
