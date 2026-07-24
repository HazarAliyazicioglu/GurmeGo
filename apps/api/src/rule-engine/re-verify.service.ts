import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

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
      const existing = await this.prisma.contributionQueue.findFirst({
        where: { venueId: venue.id, type: "EDIT", status: "PENDING", payload: { path: ["kind"], equals: "re_verify" } },
      });
      if (existing) continue;
      await this.prisma.contributionQueue.create({
        data: { type: "EDIT", venueId: venue.id, payload: { kind: "re_verify" }, submittedBy: null },
      });
      created++;
    }
    return created;
  }
}
