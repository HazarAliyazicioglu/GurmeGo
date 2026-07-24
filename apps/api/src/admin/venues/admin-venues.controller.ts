import { Body, Controller, Param, Post, Put, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { AdminVenuesService } from "./admin-venues.service";
import { CsvImportService } from "./csv-import.service";

@Controller("admin")
@UseGuards(RolesGuard)
@Roles("curator", "admin")
export class AdminVenuesController {
  constructor(private venues: AdminVenuesService, private csvImport: CsvImportService) {}

  @Post("venues")
  create(@Body() body: any) {
    return this.venues.create(body);
  }

  @Put("venues/:id")
  update(@Param("id") id: string, @Body() body: any) {
    return this.venues.update(id, body);
  }

  @Post("venues/:id/revert/:versionId")
  revert(@Param("id") id: string, @Param("versionId") versionId: string) {
    return this.venues.revert(id, versionId);
  }

  @Post("import")
  @UseInterceptors(FileInterceptor("file"))
  importCsv(@UploadedFile() file: { buffer: Buffer }) {
    return this.csvImport.parseRows(file.buffer.toString("utf-8"));
  }
}
