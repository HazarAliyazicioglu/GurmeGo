import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFavoriteList } from "@gurmego/shared";

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

  createList(userId: string, dto: CreateFavoriteList) {
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
    return this.prisma.favorite.upsert({
      where: { listId_venueId: { listId, venueId } },
      create: { listId, venueId },
      update: {},
    });
  }
}
