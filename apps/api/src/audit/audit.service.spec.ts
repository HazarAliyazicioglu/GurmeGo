import type { Prisma } from "@prisma/client";
import { AuditService } from "./audit.service";

function fakeTx() {
  return { auditLog: { create: jest.fn().mockResolvedValue({}) } } as unknown as Prisma.TransactionClient & {
    auditLog: { create: jest.Mock };
  };
}

describe("AuditService.record", () => {
  const service = new AuditService();

  it("inserts exactly one row through the transaction client it is given", async () => {
    const tx = fakeTx();
    await service.record(tx, { actorId: "u1", action: "ROLE_ASSIGNED", targetType: "User", targetId: "u2", before: { role: "USER" }, after: { role: "CURATOR" } });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: { actorId: "u1", action: "ROLE_ASSIGNED", targetType: "User", targetId: "u2", before: { role: "USER" }, after: { role: "CURATOR" } },
    });
  });

  it("omits optional fields it was not given instead of writing explicit nulls/undefined", async () => {
    const tx = fakeTx();
    await service.record(tx, { actorId: null, action: "CSV_IMPORT_STARTED", targetType: "VenueImport" });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: { actorId: null, action: "CSV_IMPORT_STARTED", targetType: "VenueImport" } });
  });

  it("propagates a write failure to the caller (fail-closed: the surrounding transaction must roll back)", async () => {
    const tx = fakeTx();
    tx.auditLog.create.mockRejectedValue(new Error("db down"));
    await expect(service.record(tx, { actorId: "u1", action: "VENUE_CREATED", targetType: "Venue" })).rejects.toThrow("db down");
  });
});
