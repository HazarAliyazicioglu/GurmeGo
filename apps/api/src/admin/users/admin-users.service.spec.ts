import { AdminUsersService } from "./admin-users.service";

// assignRole now runs in ONE transaction: read current role -> update -> audit row (ADR 006).
function harness(opts: { existing?: { role: string } | null; updateImpl?: jest.Mock } = {}) {
  const existing = opts.existing === undefined ? { role: "USER" } : opts.existing;
  const tx = {
    user: {
      findUnique: jest.fn().mockResolvedValue(existing),
      // conditional update ("only if the role is still what we read") -- the race guard, same pattern as the queue
      updateMany: opts.updateImpl ?? jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "u1", role: "CURATOR" }),
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

    expect(tx.user.updateMany).toHaveBeenCalledWith({ where: { id: "u1", role: "USER" }, data: { role: "CURATOR" } });
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
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("answers a clean 409 and writes NO audit row when the role changed between read and write (lost the race)", async () => {
    const { service, audit } = harness({ updateImpl: jest.fn().mockResolvedValue({ count: 0 }) });
    await expect(service.assignRole("u1", "curator", "admin-1")).rejects.toMatchObject({ status: 409 });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("is fail-closed: an audit failure propagates so the surrounding transaction rolls back", async () => {
    const { service, audit } = harness();
    audit.record.mockRejectedValue(new Error("audit down"));
    await expect(service.assignRole("u1", "curator", "admin-1")).rejects.toThrow("audit down");
  });
});
