import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { RateLimitCountersRepository } from "./rate-limit-counters.repository";
import { RateLimitCleanupService } from "./rate-limit-cleanup.service";

// Home for cross-cutting scheduled jobs that don't belong to any single feature module.
// `ScheduleModule.forRoot()` is also imported by RuleEngineModule (for ReVerifyService's cron) --
// `@nestjs/schedule` registers cron jobs by name against a single global `SchedulerRegistry`
// regardless of how many modules call `forRoot()`, so this doesn't double-schedule anything; it
// just makes this module self-contained/independently testable.
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [RateLimitCountersRepository, RateLimitCleanupService],
  exports: [RateLimitCountersRepository],
})
export class CommonModule {}
