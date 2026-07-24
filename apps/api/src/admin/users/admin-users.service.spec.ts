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
});
