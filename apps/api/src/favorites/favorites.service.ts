import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFavoriteList } from "@gurmego/shared";
import { FAVORITES_LIMITS } from "./favorites.config";

// Minimal venue projection nested under a favorite — matches `FavoriteVenueSchema` in
// `packages/shared/src/schemas/favorite-list.schema.ts`. Keep the two in sync.
const VENUE_SELECT = {
  id: true,
  name: true,
  slug: true,
  category: true,
  priceRange: true,
  isBoutique: true,
} as const;

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  // `orderBy` is required for determinism: without it, Postgres/Prisma do not guarantee row
  // order across requests, and callers like `FavoriteButton` rely on `lists[0]` being stable.
  listLists(userId: string) {
    return this.prisma.favoriteList.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { favorites: { include: { venue: { select: VENUE_SELECT } } } },
    });
  }

  // docs/DENETIM-RAPORU.md KRİTİK bulgu: nothing capped how many lists one account accumulates.
  // cross-model-review flagged this count-then-create as a TOCTOU race (two concurrent requests
  // could both read a count under the cap and both insert, landing one or two lists past it) --
  // accepted, not fixed: this is a soft anti-abuse cap paired with a 20/minute rate limit, not a
  // hard security invariant, and closing it properly needs a DB-level guard (e.g. an advisory
  // lock or a trigger-enforced count), which is more machinery than this deserves at pilot scale.
  async createList(userId: string, dto: CreateFavoriteList) {
    // §api-spec.md: business-rule violations are 422, not 400 (400 is reserved for input
    // validation -- the request body itself is well-formed here, it's the account's existing
    // state that makes it unprocessable).
    const listCount = await this.prisma.favoriteList.count({ where: { userId } });
    if (listCount >= FAVORITES_LIMITS.maxListsPerUser) {
      const limitReached = new UnprocessableEntityException({
        error: { code: "LIST_LIMIT_REACHED", message: "Liste sayısı sınırına ulaşıldı" },
      });
      limitReached.message = "Liste sayısı sınırına ulaşıldı";
      throw limitReached;
    }
    return this.prisma.favoriteList.create({
      data: { userId, name: dto.name },
      include: { favorites: { include: { venue: { select: VENUE_SELECT } } } },
    });
  }

  async addVenue(userId: string, listId: string, venueId: string) {
    const list = await this.prisma.favoriteList.findUnique({ where: { id: listId } });
    if (!list || list.userId !== userId) {
      // The HTTP response body must stay exactly `{ error: { code, message } }` per
      // docs/api-spec.md (no top-level `message`), but NestJS's HttpException only
      // derives `.message` (the Error message, used by e.g. `toThrow`) from a
      // top-level `message` property on the response object. Set it explicitly
      // after construction so the JSON body is unaffected.
      const notFound = new NotFoundException({ error: { code: "LIST_NOT_FOUND", message: "Liste bulunamadı" } });
      notFound.message = "Liste bulunamadı";
      throw notFound;
    }
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue || venue.status !== "PUBLISHED") {
      const notFound = new NotFoundException({ error: { code: "VENUE_NOT_FOUND", message: "Mekan bulunamadı" } });
      notFound.message = "Mekan bulunamadı";
      throw notFound;
    }
    // docs/DENETIM-RAPORU.md KRİTİK bulgu: nothing capped how many venues one list accumulates.
    // Only checked for a genuinely NEW favorite -- re-adding one already in the list (idempotent
    // upsert) must never be blocked by a cap it doesn't grow past.
    const alreadyFavorited = await this.prisma.favorite.findUnique({ where: { listId_venueId: { listId, venueId } } });
    if (!alreadyFavorited) {
      const venueCount = await this.prisma.favorite.count({ where: { listId } });
      if (venueCount >= FAVORITES_LIMITS.maxVenuesPerList) {
        const limitReached = new UnprocessableEntityException({
          error: { code: "VENUE_LIMIT_REACHED", message: "Mekan sayısı sınırına ulaşıldı" },
        });
        limitReached.message = "Mekan sayısı sınırına ulaşıldı";
        throw limitReached;
      }
    }
    return this.prisma.favorite.upsert({
      where: { listId_venueId: { listId, venueId } },
      create: { listId, venueId },
      update: {},
    });
  }

  async removeVenue(userId: string, listId: string, venueId: string) {
    const list = await this.prisma.favoriteList.findUnique({ where: { id: listId } });
    if (!list || list.userId !== userId) {
      const notFound = new NotFoundException({ error: { code: "LIST_NOT_FOUND", message: "Liste bulunamadı" } });
      notFound.message = "Liste bulunamadı";
      throw notFound;
    }
    const favorite = await this.prisma.favorite.findUnique({ where: { listId_venueId: { listId, venueId } } });
    if (!favorite) {
      const notFound = new NotFoundException({ error: { code: "VENUE_NOT_FOUND", message: "Favori bulunamadı" } });
      notFound.message = "Favori bulunamadı";
      throw notFound;
    }
    await this.prisma.favorite.delete({ where: { listId_venueId: { listId, venueId } } });
  }
}
