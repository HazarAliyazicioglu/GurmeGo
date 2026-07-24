import { Body, Controller, Get, Param, Post, Req, UseGuards, UsePipes } from "@nestjs/common";
import { CreateFavoriteListSchema } from "@gurmego/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { RateLimit, RateLimitGuard } from "../common/rate-limit.guard";
import { FavoritesService } from "./favorites.service";

@Controller("me/lists")
export class FavoritesController {
  constructor(private favorites: FavoritesService) {}

  @Get()
  @UseGuards(RateLimitGuard)
  @RateLimit(100, 60)
  list(@Req() req: any) {
    return this.favorites.listLists(req.user.id);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateFavoriteListSchema))
  create(@Req() req: any, @Body() body: { name: string }) {
    return this.favorites.createList(req.user.id, body);
  }

  @Post(":id/venues")
  addVenue(@Req() req: any, @Param("id") listId: string, @Body("venueId") venueId: string) {
    return this.favorites.addVenue(req.user.id, listId, venueId);
  }
}
