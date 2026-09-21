import { Injectable, BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
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

function roleChangedConcurrently() {
  const ex = new ConflictException({
    error: { code: "ROLE_CHANGED_CONCURRENTLY", message: "Kullanıcının rolü başka bir işlemle değişti, tekrar deneyin" },
  });
  ex.message = "Kullanıcının rolü başka bir işlemle değişti, tekrar deneyin";
  return ex;
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
        // Conditional write ("only if the role is still what we just read") -- the same race-guard pattern as
        // AdminQueueService.approve. A plain read-then-update would let two concurrent assignments both record
        // `before = USER` even though the second one really changed CURATOR -> CURATOR: atomicity of the
        // transaction does not make the RECORDED predecessor true, this guard does. The loser gets a clean 409.
        const claimed = await tx.user.updateMany({
          where: { id: userId, role: existing.role },
          data: { role: role.toUpperCase() as UserRole },
        });
        if (claimed.count !== 1) throw roleChangedConcurrently();
        const updated = await tx.user.findUniqueOrThrow({ where: { id: userId } });
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
