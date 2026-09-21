import { BadRequestException, Body, Controller, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { AdminVenueCreateSchema, AdminVenueUpdateSchema } from "@gurmego/shared";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { RateLimit, RateLimitGuard } from "../../common/rate-limit.guard";
import { RATE_LIMITS } from "../../common/rate-limit.config";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { AdminVenuesService } from "./admin-venues.service";
import { CsvImportService } from "./csv-import.service";

@Controller("admin")
@UseGuards(RolesGuard, RateLimitGuard)
@RateLimit(RATE_LIMITS.admin.limit, RATE_LIMITS.admin.windowSeconds, { bucket: "admin" })
@Roles("curator", "admin")
export class AdminVenuesController {
  constructor(private venues: AdminVenuesService, private csvImport: CsvImportService) {}

  @Post("venues")
  create(@Body(new ZodValidationPipe(AdminVenueCreateSchema)) body: ReturnType<(typeof AdminVenueCreateSchema)["parse"]>) {
    return this.venues.create(body);
  }

  @Put("venues/:id")
  update(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body(new ZodValidationPipe(AdminVenueUpdateSchema)) body: ReturnType<(typeof AdminVenueUpdateSchema)["parse"]>,
  ) {
    return this.venues.update(id, body);
  }

  @Post("venues/:id/revert/:versionId")
  revert(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Param("versionId", new ParseUUIDPipe({ errorHttpStatusCode: 400 })) versionId: string,
  ) {
    return this.venues.revert(id, versionId);
  }

  // Fastify app (see apps/api/src/main.ts) — `@fastify/multipart` is registered globally there, which
  // adds `req.file()` to the raw Fastify request. `@nestjs/platform-express`'s `FileInterceptor` cannot
  // be used here: it expects an Express request/response and 415s on every real Fastify multipart POST.
  // Its own, stricter bucket: a method-level @RateLimit overrides the controller-level shared admin one, so
  // an import spends only this budget (CSV parse + N inserts is by far the heaviest admin operation).
  @RateLimit(RATE_LIMITS.adminImport.limit, RATE_LIMITS.adminImport.windowSeconds, { bucket: "admin-import" })
  @Post("import")
  async importCsv(@Req() req: FastifyRequest) {
    const data = await req.file();
    if (!data) {
      throw new BadRequestException({ error: { code: "VALIDATION_ERROR", message: "file zorunlu" } });
    }
    const buffer = await data.toBuffer();
    const { valid, errors } = await this.csvImport.parseRows(buffer.toString("utf-8"));
    const { created, skipped, rowErrors } = await this.venues.importRows(valid);
    return { created, skipped, errors: [...errors, ...rowErrors] };
  }
}
