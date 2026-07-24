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
      throw new NotFoundException("Liste bulunamadı");
    }
    return this.prisma.favorite.upsert({
      where: { listId_venueId: { listId, venueId } },
      create: { listId, venueId },
      update: {},
    });
  }
}
