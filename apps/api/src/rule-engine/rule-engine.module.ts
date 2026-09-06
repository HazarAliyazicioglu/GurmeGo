import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { BoutiqueService } from "./boutique.service";
import { ReVerifyService } from "./re-verify.service";

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [BoutiqueService, ReVerifyService],
  exports: [BoutiqueService, ReVerifyService],
})
export class RuleEngineModule {}
