import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { VenuesRepository } from "../../venues/venues.repository";
import { getUrgentReportThreshold } from "../../common/rule-config";

// The HTTP response body must stay exactly `{ error: { code, message } }` per docs/api-spec.md
// (no top-level `message`), but NestJS's HttpException only derives `.message` (used by e.g.
// `toThrow`) from a top-level `message` property on the response object. Set it explicitly
// after construction so the JSON body is unaffected. (Same pattern as venues.service.ts.)
function alreadyProcessedError() {
  const ex = new ConflictException({
    error: { code: "CONTRIBUTION_ALREADY_PROCESSED", message: "Bu katkı zaten işlenmiş" },
  });
  ex.message = "Bu katkı zaten işlenmiş";
  return ex;
}

@Injectable()
export class AdminQueueService {
  constructor(private prisma: PrismaService, private venuesRepository: VenuesRepository) {}

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
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const item = await tx.contributionQueue.findUniqueOrThrow({ where: { id } });
      if (item.status !== "PENDING") throw alreadyProcessedError();
      if (item.type === "EDIT" && item.venueId) {
        const snapshot = await this.venuesRepository.findRawForSnapshot(tx, item.venueId);
        await tx.venueVersion.create({ data: { venueId: item.venueId, snapshot: snapshot as unknown as Prisma.InputJsonValue, createdBy: reviewerId } });
        await tx.venue.update({ where: { id: item.venueId }, data: { verifiedAt: new Date() } });
      }
      // REPORT: intentionally does NOT touch Venue/VenueVersion -- approving a "this info is
      // wrong" report means "we've reviewed it," not "we've confirmed it's accurate." Any actual
      // correction happens through AdminVenuesService.update() (Step 15 above).
      return tx.contributionQueue.update({ where: { id }, data: { status: "APPROVED", reviewedBy: reviewerId, reviewedAt: new Date() } });
    });
  }

  reject(id: string, reviewerId: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const item = await tx.contributionQueue.findUniqueOrThrow({ where: { id } });
      if (item.status !== "PENDING") {
        throw alreadyProcessedError();
      }
      return tx.contributionQueue.update({
        where: { id },
        data: { status: "REJECTED", reviewedBy: reviewerId, reviewedAt: new Date() },
      });
    });
  }
}
