import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFavoriteList } from "@gurmego/shared";

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  listLists(userId: string) {
    return this.prisma.favoriteList.findMany({ where: { userId }, include: { favorites: true } });
  }

  createList(userId: string, dto: CreateFavoriteList) {
    return this.prisma.favoriteList.create({ data: { userId, name: dto.name } });
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
