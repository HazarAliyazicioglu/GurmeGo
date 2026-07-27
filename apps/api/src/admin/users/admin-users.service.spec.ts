import { Prisma } from "@prisma/client";
import { AdminUsersService } from "./admin-users.service";

describe("AdminUsersService.assignRole", () => {
  it("assigns curator role", async () => {
    const prisma = { user: { update: jest.fn().mockResolvedValue({ id: "u1", role: "CURATOR" }) } } as any;
    const service = new AdminUsersService(prisma);

    const result = await service.assignRole("u1", "curator");

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { role: "CURATOR" } });
    expect(result.role).toBe("CURATOR");
  });

  it("rejects approved_rater in MVP (Faz 2 only)", async () => {
    const prisma = { user: { update: jest.fn() } } as any;
    const service = new AdminUsersService(prisma);

    await expect(service.assignRole("u1", "approved_rater")).rejects.toThrow(
      "Bu rol MVP'de kullanılamaz (Faz 2)",
    );
  });

  it("rejects assigning the admin role in MVP", async () => {
    const prisma = { user: { update: jest.fn() } } as any;
    const service = new AdminUsersService(prisma);

    await expect(service.assignRole("u1", "admin")).rejects.toThrow(
      "Bu rol MVP'de kullanılamaz (Faz 2)",
    );
  });

  it("throws a clean 404 (not an uncaught Prisma error) when userId is well-formed but no such user exists (regression: was a raw P2025 surfacing as a 500)", async () => {
    const notFoundError = new Prisma.PrismaClientKnownRequestError("An operation failed because it depends on one or more records that were required but not found.", {
      code: "P2025",
      clientVersion: "5.22.0",
    });
    const prisma = { user: { update: jest.fn().mockRejectedValue(notFoundError) } } as any;
    const service = new AdminUsersService(prisma);

    try {
      await service.assignRole("missing-user-id", "curator");
      throw new Error("expected assignRole to throw");
    } catch (err: any) {
      expect(err.getResponse()).toEqual({ error: { code: "USER_NOT_FOUND", message: "Kullanıcı bulunamadı" } });
      expect(err.getResponse().message).toBeUndefined();
      expect(err.message).toBe("Kullanıcı bulunamadı");
    }
  });
});
