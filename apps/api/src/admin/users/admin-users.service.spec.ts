import { Prisma } from "@prisma/client";
import { AdminUsersService } from "./admin-users.service";

// assignRole now runs in ONE transaction: read current role -> update -> audit row (ADR 006).
function harness(opts: { existing?: { role: string } | null; updateImpl?: jest.Mock } = {}) {
  const existing = opts.existing === undefined ? { role: "USER" } : opts.existing;
  const tx = {
    user: {
      findUnique: jest.fn().mockResolvedValue(existing),
      update: opts.updateImpl ?? jest.fn().mockResolvedValue({ id: "u1", role: "CURATOR" }),
    },
  };
  const prisma = { $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) } as any;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
  return { tx, prisma, audit, service: new AdminUsersService(prisma, audit) };
}

describe("AdminUsersService.assignRole", () => {
  it("assigns curator role and records ROLE_ASSIGNED with the actor and before/after, in the same transaction", async () => {
    const { tx, service, audit } = harness();

    const result = await service.assignRole("u1", "curator", "admin-1");

    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { role: "CURATOR" } });
    expect(result.role).toBe("CURATOR");
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(tx, {
      actorId: "admin-1",
      action: "ROLE_ASSIGNED",
      targetType: "User",
      targetId: "u1",
      before: { role: "USER" },
      after: { role: "CURATOR" },
    });
  });

  it("rejects approved_rater in MVP (Faz 2 only) without touching the database", async () => {
    const { prisma, service, audit } = harness();
    await expect(service.assignRole("u1", "approved_rater", "admin-1")).rejects.toThrow("Bu rol MVP'de kullanılamaz (Faz 2)");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("rejects assigning the admin role in MVP", async () => {
    const { service } = harness();
    await expect(service.assignRole("u1", "admin", "admin-1")).rejects.toThrow("Bu rol MVP'de kullanılamaz (Faz 2)");
  });

  it("throws a clean 404 and writes NO audit row when the user does not exist", async () => {
    const { service, audit, tx } = harness({ existing: null });
    await expect(service.assignRole("missing-user-id", "curator", "admin-1")).rejects.toMatchObject({
      status: 404,
      message: "Kullanıcı bulunamadı",
    });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("still maps a P2025 from update() (row deleted between read and write) to the same clean 404", async () => {
    const p2025 = new Prisma.PrismaClientKnownRequestError("record not found", { code: "P2025", clientVersion: "5.22.0" });
    const { service } = harness({ updateImpl: jest.fn().mockRejectedValue(p2025) });
    try {
      await service.assignRole("u1", "curator", "admin-1");
      throw new Error("expected assignRole to throw");
    } catch (err: any) {
      expect(err.getResponse()).toEqual({ error: { code: "USER_NOT_FOUND", message: "Kullanıcı bulunamadı" } });
      expect(err.getResponse().message).toBeUndefined();
      expect(err.message).toBe("Kullanıcı bulunamadı");
    }
  });

  it("is fail-closed: an audit failure propagates so the surrounding transaction rolls back", async () => {
    const { service, audit } = harness();
    audit.record.mockRejectedValue(new Error("audit down"));
    await expect(service.assignRole("u1", "curator", "admin-1")).rejects.toThrow("audit down");
  });
});
