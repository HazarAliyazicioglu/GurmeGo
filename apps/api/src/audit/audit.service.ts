import { Injectable } from "@nestjs/common";
import type { $Enums, Prisma } from "@prisma/client";

export type AuditEntry = {
  actorId: string | null;
  action: $Enums.AuditAction;
  targetType: string;
  targetId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  meta?: Prisma.InputJsonValue;
};

// The ONLY write path to `audit_log` (ADR 006 v2). It takes a `Prisma.TransactionClient` -- not the plain
// PrismaService -- so that "the audit row is written in the same transaction as the action it records" is
// enforced by the type system: callers cannot write a record outside a transaction by accident, and a
// failure here rolls the whole admin action back (fail-closed). Append-only itself is enforced by a database
// trigger, not by this class.
//
// PII boundary (ADR 006): only ids, role names, minimal field-level diffs and counters. Never e-mail, name,
// user coordinates, free-text venue content or CSV row contents.
@Injectable()
export class AuditService {
  async record(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        ...(entry.targetId !== undefined ? { targetId: entry.targetId } : {}),
        ...(entry.before !== undefined ? { before: entry.before } : {}),
        ...(entry.after !== undefined ? { after: entry.after } : {}),
        ...(entry.meta !== undefined ? { meta: entry.meta } : {}),
      },
    });
  }
}
