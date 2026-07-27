import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

// Postgres unique_violation (SQLSTATE 23505) on the partial unique index added by migration
// 20260727000000_add_contribution_queue_pending_edit_unique_index (one PENDING "EDIT" row per
// venue). `contributionQueue.create()` here goes through the generated Prisma Client (no raw SQL),
// so a violation surfaces as P2002, not the P2010-wrapping-23505 shape
// admin-venues.service.ts's `isUniqueViolation` documents for its raw-SQL insert.
function isPendingReVerifyAlreadyQueued(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

@Injectable()
export class ReVerifyService {
  constructor(private prisma: PrismaService) {}

  async enqueueStale(): Promise<number> {
    const staleDays = Number(process.env.RULES_STALE_DAYS ?? 90);
    const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);
    const staleVenues = await this.prisma.venue.findMany({
      where: { status: "PUBLISHED", verifiedAt: { lt: cutoff } },
      select: { id: true },
    });

    let created = 0;
    for (const venue of staleVenues) {
      // This findFirst is a fast-path optimization, not the actual guard against duplicates: it's
      // not atomic with the create() below, so if this cron runs concurrently across multiple API
      // instances, two instances can both pass this check for the same venue before either
      // commits. The partial unique index (see isPendingReVerifyAlreadyQueued's comment above) is
      // the real source of truth -- the catch block below is what actually prevents a duplicate
      // row, this check just avoids throwing-and-catching in the common (non-concurrent) case.
      const existing = await this.prisma.contributionQueue.findFirst({
        where: { venueId: venue.id, type: "EDIT", status: "PENDING", payload: { path: ["kind"], equals: "re_verify" } },
      });
      if (existing) continue;
      try {
        await this.prisma.contributionQueue.create({
          data: { type: "EDIT", venueId: venue.id, payload: { kind: "re_verify" }, submittedBy: null, status: "PENDING" },
        });
        created++;
      } catch (err) {
        if (isPendingReVerifyAlreadyQueued(err)) continue;
        throw err;
      }
    }
    return created;
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: "re-verify-stale" })
  async handleCron(): Promise<void> {
    await this.enqueueStale();
  }
}
