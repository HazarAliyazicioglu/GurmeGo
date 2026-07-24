import { BadRequestException, Body, Controller, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { AdminVenueCreateSchema, AdminVenueUpdateSchema } from "@gurmego/shared";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { AdminVenuesService } from "./admin-venues.service";
import { CsvImportService } from "./csv-import.service";

@Controller("admin")
@UseGuards(RolesGuard)
@Roles("curator", "admin")
export class AdminVenuesController {
  constructor(private venues: AdminVenuesService, private csvImport: CsvImportService) {}

  @Post("venues")
  create(@Body(new ZodValidationPipe(AdminVenueCreateSchema)) body: ReturnType<(typeof AdminVenueCreateSchema)["parse"]>) {
    return this.venues.create(body);
  }

  @Put("venues/:id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(AdminVenueUpdateSchema)) body: ReturnType<(typeof AdminVenueUpdateSchema)["parse"]>,
  ) {
    return this.venues.update(id, body);
  }

  @Post("venues/:id/revert/:versionId")
  revert(@Param("id") id: string, @Param("versionId") versionId: string) {
    return this.venues.revert(id, versionId);
  }

  // Fastify app (see apps/api/src/main.ts) — `@fastify/multipart` is registered globally there, which
  // adds `req.file()` to the raw Fastify request. `@nestjs/platform-express`'s `FileInterceptor` cannot
  // be used here: it expects an Express request/response and 415s on every real Fastify multipart POST.
  @Post("import")
  async importCsv(@Req() req: FastifyRequest) {
    const data = await req.file();
    if (!data) {
      throw new BadRequestException({ error: { code: "VALIDATION_ERROR", message: "file zorunlu" } });
    }
    const buffer = await data.toBuffer();
    const { valid, errors } = this.csvImport.parseRows(buffer.toString("utf-8"));
    const { created, skipped, rowErrors } = await this.venues.importRows(valid);
    return { created, skipped, errors: [...errors, ...rowErrors] };
  }
}
