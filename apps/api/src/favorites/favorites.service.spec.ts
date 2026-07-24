import { FavoritesService } from "./favorites.service";

describe("FavoritesService", () => {
  it("createList creates a list scoped to the user", async () => {
    const prisma = { favoriteList: { create: jest.fn().mockResolvedValue({ id: "l1", name: "Kadıköy turu" }) } } as any;
    const service = new FavoritesService(prisma);

    const result = await service.createList("user-1", { name: "Kadıköy turu" });

    expect(prisma.favoriteList.create).toHaveBeenCalledWith({
      data: { userId: "user-1", name: "Kadıköy turu" },
      include: { favorites: { include: { venue: { select: expect.any(Object) } } } },
    });
    expect(result).toEqual({ id: "l1", name: "Kadıköy turu" });
  });

  it("addVenue rejects when list does not belong to user", async () => {
    const prisma = { favoriteList: { findUnique: jest.fn().mockResolvedValue({ id: "l1", userId: "other-user" }) } } as any;
    const service = new FavoritesService(prisma);

    await expect(service.addVenue("user-1", "l1", "v1")).rejects.toThrow("Liste bulunamadı");
  });

  it("addVenue rejects with a clean error envelope (regression: no top-level message field)", async () => {
    const prisma = { favoriteList: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
    const service = new FavoritesService(prisma);

    try {
      await service.addVenue("user-1", "l1", "v1");
      throw new Error("expected addVenue to throw");
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        error: { code: "LIST_NOT_FOUND", message: "Liste bulunamadı" },
      });
      expect(err.getResponse().message).toBeUndefined();
    }
  });
});
