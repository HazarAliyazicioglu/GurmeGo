import { PrismaClient } from "@prisma/client";
import { AuditService } from "../src/audit/audit.service";

// ADR 006 v2: the audit table is append-only ENFORCED BY THE DATABASE (trigger), not by application code.
// Rows are never cleaned up (that is the point), so every test scopes its assertions to a unique targetId.
describe("AuditLog (real Postgres)", () => {
  let prisma: PrismaClient;
  const service = new AuditService();
  const uniqueTarget = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  beforeAll(() => {
    prisma = new PrismaClient();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("persists a record written inside a committed transaction", async () => {
    const targetId = uniqueTarget();
    await prisma.$transaction((tx) =>
      service.record(tx, { actorId: "actor-1", action: "ROLE_ASSIGNED", targetType: "User", targetId, before: { role: "USER" }, after: { role: "CURATOR" } }),
    );
    const rows = await prisma.auditLog.findMany({ where: { targetId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorId: "actor-1", action: "ROLE_ASSIGNED", targetType: "User", before: { role: "USER" }, after: { role: "CURATOR" } });
    expect(rows[0].createdAt).toBeInstanceOf(Date);
  });

  it("leaves NO record when the surrounding transaction rolls back (atomic with the action)", async () => {
    const targetId = uniqueTarget();
    await expect(
      prisma.$transaction(async (tx) => {
        await service.record(tx, { actorId: "actor-1", action: "VENUE_UPDATED", targetType: "Venue", targetId });
        throw new Error("the admin action itself failed");
      }),
    ).rejects.toThrow("the admin action itself failed");
    expect(await prisma.auditLog.count({ where: { targetId } })).toBe(0);
  });

  it("refuses UPDATE at the database level, and the row stays unchanged", async () => {
    const targetId = uniqueTarget();
    await prisma.$transaction((tx) => service.record(tx, { actorId: "actor-1", action: "VENUE_CREATED", targetType: "Venue", targetId }));
    await expect(prisma.auditLog.updateMany({ where: { targetId }, data: { actorId: "attacker" } })).rejects.toThrow(/append-only/);
    expect((await prisma.auditLog.findFirstOrThrow({ where: { targetId } })).actorId).toBe("actor-1");
  });

  it("refuses DELETE at the database level, and the row survives", async () => {
    const targetId = uniqueTarget();
    await prisma.$transaction((tx) => service.record(tx, { actorId: "actor-1", action: "QUEUE_APPROVED", targetType: "ContributionQueue", targetId }));
    await expect(prisma.auditLog.deleteMany({ where: { targetId } })).rejects.toThrow(/append-only/);
    expect(await prisma.auditLog.count({ where: { targetId } })).toBe(1);
  });

  it("refuses TRUNCATE at the database level", async () => {
    await expect(prisma.$executeRawUnsafe(`TRUNCATE TABLE audit_log`)).rejects.toThrow(/append-only/);
  });

  it("does not tie the record to a User row (no FK): an actor id with no user row is accepted and survives", async () => {
    const targetId = uniqueTarget();
    await prisma.$transaction((tx) => service.record(tx, { actorId: "00000000-0000-0000-0000-00000000dead", action: "QUEUE_REJECTED", targetType: "ContributionQueue", targetId }));
    expect(await prisma.auditLog.count({ where: { targetId } })).toBe(1);
  });
});
