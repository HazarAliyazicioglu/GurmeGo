import { Controller, Get, Query, UsePipes } from "@nestjs/common";
import { VenueListQuerySchema } from "@gurmego/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { VenuesService } from "./venues.service";

@Controller("venues")
export class VenuesController {
  constructor(private venues: VenuesService) {}

  @Get()
  @UsePipes(new ZodValidationPipe(VenueListQuerySchema))
  list(@Query() query: ReturnType<(typeof VenueListQuerySchema)["parse"]>) {
    return this.venues.list(query);
  }
}
