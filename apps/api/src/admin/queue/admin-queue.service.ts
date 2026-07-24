import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { getUrgentReportThreshold } from "../../common/rule-config";

@Injectable()
export class AdminQueueService {
  constructor(private prisma: PrismaService) {}

  async list(type?: string, status?: string) {
    const items = await this.prisma.contributionQueue.findMany({
      where: { type: type as any, status: (status as any) ?? "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { venue: { select: { name: true, slug: true } } },
    });
    // Urgent (>= threshold pending REPORTs on same venue) sort first, then re_verify, then rest
    const threshold = getUrgentReportThreshold();
    const withUrgency = await Promise.all(
      items.map(async (item) => {
        if (item.type !== "REPORT") return { item, urgent: false };
        const count = await this.prisma.contributionQueue.count({
          where: { venueId: item.venueId!, type: "REPORT", status: "PENDING" },
        });
        return { item, urgent: count >= threshold };
      }),
    );
    return withUrgency.sort((a, b) => Number(b.urgent) - Number(a.urgent)).map((w) => ({ ...w.item, urgent: w.urgent }));
  }

  async approve(id: string, reviewerId: string) {
    const item = await this.prisma.contributionQueue.findUniqueOrThrow({ where: { id } });
    if (item.venueId) {
      const venue = await this.prisma.venue.findUniqueOrThrow({ where: { id: item.venueId } });
      await this.prisma.venueVersion.create({ data: { venueId: venue.id, snapshot: venue, createdBy: reviewerId } });
      await this.prisma.venue.update({ where: { id: venue.id }, data: { verifiedAt: new Date() } });
    }
    return this.prisma.contributionQueue.update({
      where: { id },
      data: { status: "APPROVED", reviewedBy: reviewerId, reviewedAt: new Date() },
    });
  }

  reject(id: string, reviewerId: string) {
    return this.prisma.contributionQueue.update({
      where: { id },
      data: { status: "REJECTED", reviewedBy: reviewerId, reviewedAt: new Date() },
    });
  }
}
