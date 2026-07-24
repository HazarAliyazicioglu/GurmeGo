import { Module } from "@nestjs/common";
import { AdminVenuesController } from "./admin-venues.controller";
import { AdminVenuesService } from "./admin-venues.service";
import { CsvImportService } from "./csv-import.service";
import { RuleEngineModule } from "../../rule-engine/rule-engine.module";
import { VenuesModule } from "../../venues/venues.module";

@Module({
  imports: [RuleEngineModule, VenuesModule],
  controllers: [AdminVenuesController],
  providers: [AdminVenuesService, CsvImportService],
})
export class AdminVenuesModule {}
