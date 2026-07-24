import { Module } from "@nestjs/common";
import { BoutiqueService } from "./boutique.service";
import { ReVerifyService } from "./re-verify.service";

@Module({
  providers: [BoutiqueService, ReVerifyService],
  exports: [BoutiqueService, ReVerifyService],
})
export class RuleEngineModule {}
