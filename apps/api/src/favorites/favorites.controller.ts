import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req, UseGuards, UsePipes } from "@nestjs/common";
import { CreateFavoriteListSchema } from "@gurmego/shared";
import { AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { RateLimit, RateLimitGuard } from "../common/rate-limit.guard";
import { RATE_LIMITS } from "../common/rate-limit.config";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { FavoritesService } from "./favorites.service";

@Controller("me/lists")
@UseGuards(RolesGuard)
@Roles("user", "approved_rater", "curator", "admin")
export class FavoritesController {
  constructor(private favorites: FavoritesService) {}

  @Get()
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMITS.read.limit, RATE_LIMITS.read.windowSeconds)
  list(@Req() req: AuthenticatedRequest) {
    // Non-null assertion: `RolesGuard` (registered above via `@UseGuards`) already rejected the
    // request with 401 if `req.user` were missing, before this handler ever runs.
    return this.favorites.listLists(req.user!.id);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateFavoriteListSchema))
  create(@Req() req: AuthenticatedRequest, @Body() body: { name: string }) {
    return this.favorites.createList(req.user!.id, body);
  }

  @Post(":id/venues")
  addVenue(
    @Req() req: AuthenticatedRequest,
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) listId: string,
    @Body("venueId", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) venueId: string,
  ) {
    return this.favorites.addVenue(req.user!.id, listId, venueId);
  }

  @Delete(":id/venues/:venueId")
  removeVenue(
    @Req() req: AuthenticatedRequest,
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) listId: string,
    @Param("venueId", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) venueId: string,
  ) {
    return this.favorites.removeVenue(req.user!.id, listId, venueId);
  }
}
