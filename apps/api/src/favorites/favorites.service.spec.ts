import { FavoritesService } from "./favorites.service";
import { FAVORITES_LIMITS } from "./favorites.config";

describe("FavoritesService", () => {
  it("createList creates a list scoped to the user", async () => {
    const prisma = {
      favoriteList: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: "l1", name: "Kadıköy turu" }),
      },
    } as any;
    const service = new FavoritesService(prisma);

    const result = await service.createList("user-1", { name: "Kadıköy turu" });

    expect(prisma.favoriteList.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(prisma.favoriteList.create).toHaveBeenCalledWith({
      data: { userId: "user-1", name: "Kadıköy turu" },
      include: { favorites: { include: { venue: { select: expect.any(Object) } } } },
    });
    expect(result).toEqual({ id: "l1", name: "Kadıköy turu" });
  });

  // docs/DENETIM-RAPORU.md KRİTİK bulgu: no cap on how many lists a single account accumulates.
  it("createList rejects once the user is already at the list cap, without creating another", async () => {
    const prisma = {
      favoriteList: {
        count: jest.fn().mockResolvedValue(FAVORITES_LIMITS.maxListsPerUser),
        create: jest.fn(),
      },
    } as any;
    const service = new FavoritesService(prisma);

    try {
      await service.createList("user-1", { name: "Bir liste daha" });
      throw new Error("expected createList to throw");
    } catch (err: any) {
      expect(err.getStatus()).toBe(422);
      expect(err.getResponse()).toEqual({
        error: { code: "LIST_LIMIT_REACHED", message: "Liste sayısı sınırına ulaşıldı" },
      });
    }
    expect(prisma.favoriteList.create).not.toHaveBeenCalled();
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

  describe("addVenue — PUBLISHED check", () => {
    it("rejects adding a DRAFT venue with 404 and clean error envelope", async () => {
      const prisma = {
        favoriteList: { findUnique: jest.fn().mockResolvedValue({ id: "l1", userId: "u1" }) },
        venue: { findUnique: jest.fn().mockResolvedValue({ id: "v1", status: "DRAFT" }) },
      } as any;
      const service = new FavoritesService(prisma);

      try {
        await service.addVenue("u1", "l1", "v1");
        throw new Error("expected addVenue to throw");
      } catch (err: any) {
        expect(err.getResponse()).toEqual({
          error: { code: "VENUE_NOT_FOUND", message: "Mekan bulunamadı" },
        });
        expect(err.getResponse().message).toBeUndefined();
      }
    });

    it("successfully adds a PUBLISHED venue to the favorite list", async () => {
      const prisma = {
        favoriteList: { findUnique: jest.fn().mockResolvedValue({ id: "l1", userId: "u1" }) },
        venue: { findUnique: jest.fn().mockResolvedValue({ id: "v1", status: "PUBLISHED" }) },
        favorite: {
          findUnique: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValue(0),
          upsert: jest.fn().mockResolvedValue({ listId: "l1", venueId: "v1" }),
        },
      } as any;
      const service = new FavoritesService(prisma);

      const result = await service.addVenue("u1", "l1", "v1");

      expect(prisma.favorite.upsert).toHaveBeenCalledWith({
        where: { listId_venueId: { listId: "l1", venueId: "v1" } },
        create: { listId: "l1", venueId: "v1" },
        update: {},
      });
      expect(result).toEqual({ listId: "l1", venueId: "v1" });
    });

    // docs/DENETIM-RAPORU.md KRİTİK bulgu: no cap on how many venues a single list accumulates.
    it("rejects adding a NEW venue once the list is already at the venue cap", async () => {
      const prisma = {
        favoriteList: { findUnique: jest.fn().mockResolvedValue({ id: "l1", userId: "u1" }) },
        venue: { findUnique: jest.fn().mockResolvedValue({ id: "v1", status: "PUBLISHED" }) },
        favorite: {
          findUnique: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValue(FAVORITES_LIMITS.maxVenuesPerList),
          upsert: jest.fn(),
        },
      } as any;
      const service = new FavoritesService(prisma);

      try {
        await service.addVenue("u1", "l1", "v1");
        throw new Error("expected addVenue to throw");
      } catch (err: any) {
        expect(err.getStatus()).toBe(422);
        expect(err.getResponse()).toEqual({
          error: { code: "VENUE_LIMIT_REACHED", message: "Mekan sayısı sınırına ulaşıldı" },
        });
      }
      expect(prisma.favorite.upsert).not.toHaveBeenCalled();
    });

    // Re-adding an already-favorited venue (idempotent upsert) must not be blocked by the cap --
    // it doesn't grow the list, so counting it against the cap would make removing and re-adding
    // your OWN last-favorited venue impossible right at the cap boundary.
    it("allows re-adding an already-favorited venue even when the list is at the venue cap", async () => {
      const prisma = {
        favoriteList: { findUnique: jest.fn().mockResolvedValue({ id: "l1", userId: "u1" }) },
        venue: { findUnique: jest.fn().mockResolvedValue({ id: "v1", status: "PUBLISHED" }) },
        favorite: {
          findUnique: jest.fn().mockResolvedValue({ listId: "l1", venueId: "v1" }),
          count: jest.fn().mockResolvedValue(FAVORITES_LIMITS.maxVenuesPerList),
          upsert: jest.fn().mockResolvedValue({ listId: "l1", venueId: "v1" }),
        },
      } as any;
      const service = new FavoritesService(prisma);

      await service.addVenue("u1", "l1", "v1");

      expect(prisma.favorite.upsert).toHaveBeenCalled();
    });
  });

  it("removeVenue rejects when list does not belong to user", async () => {
    const prisma = { favoriteList: { findUnique: jest.fn().mockResolvedValue({ id: "l1", userId: "someone-else" }) } } as any;
    const service = new FavoritesService(prisma);

    await expect(service.removeVenue("user-1", "l1", "v1")).rejects.toThrow("Liste bulunamadı");
  });

  it("removeVenue deletes the composite-key row when the list belongs to the user", async () => {
    const prisma = {
      favoriteList: { findUnique: jest.fn().mockResolvedValue({ id: "l1", userId: "u1" }) },
      favorite: { findUnique: jest.fn().mockResolvedValue({ id: "f1" }), delete: jest.fn().mockResolvedValue({ id: "f1" }) },
    } as any;
    const service = new FavoritesService(prisma);

    await service.removeVenue("u1", "l1", "v1");

    expect(prisma.favorite.delete).toHaveBeenCalledWith({ where: { listId_venueId: { listId: "l1", venueId: "v1" } } });
  });

  it("removeVenue rejects with VENUE_NOT_FOUND when the venue was never favorited", async () => {
    const prisma = {
      favoriteList: { findUnique: jest.fn().mockResolvedValue({ id: "l1", userId: "u1" }) },
      favorite: { findUnique: jest.fn().mockResolvedValue(null), delete: jest.fn() },
    } as any;
    const service = new FavoritesService(prisma);

    await expect(service.removeVenue("u1", "l1", "v1")).rejects.toThrow("Favori bulunamadı");
    expect(prisma.favorite.delete).not.toHaveBeenCalled();
  });
});
