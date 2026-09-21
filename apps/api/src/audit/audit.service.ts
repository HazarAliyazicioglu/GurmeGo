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

// The ONLY write path to `audit_log` (ADR 006 v2). The parameter is typed `Prisma.TransactionClient` and every caller
// passes the `tx` of the transaction that performs the audited action, so the row commits (or rolls back) together
// with it, and a failure here rolls the whole admin action back (fail-closed). NOTE: this is a convention plus a
// signal, not a compile-time guarantee -- `TransactionClient` is structurally a subset of the plain client, so a
// PrismaService would also type-check. The e2e suite (test/admin-audit.e2e-spec.ts) is what proves atomicity.
// Append-only itself is enforced by a database trigger, not by this class.
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
