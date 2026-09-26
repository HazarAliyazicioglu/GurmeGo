import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReport } from "@gurmego/shared";
import { getUrgentReportThreshold } from "../common/rule-config";

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async submit(venueId: string, dto: CreateReport) {
    // `venueId` has already passed `ParseUUIDPipe` at the controller -- well-formed but
    // non-existent otherwise reaches the `contributionQueue.create()` below, whose FK constraint on
    // `venueId` would then fail with a Prisma `P2003` and surface as a 500 via the global exception
    // filter. Checked explicitly up front (rather than catching P2003 after the fact) so a bad
    // venueId never even attempts the insert. Deliberately does NOT filter by `status: "PUBLISHED"`
    // -- unlike the public detail/list endpoints, a report should be acceptable against any venue
    // that genuinely exists (DRAFT/ARCHIVED included), since "this venue's data looks wrong" is a
    // valid report regardless of its current publish state.
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId }, select: { id: true } });
    if (!venue) {
      const notFound = new NotFoundException({ error: { code: "VENUE_NOT_FOUND", message: "Mekan bulunamadı" } });
      notFound.message = "Mekan bulunamadı";
      throw notFound;
    }
    const payload: Record<string, string> = { reason: dto.reason };
    if (dto.field) payload.field = dto.field;
    if (dto.suggestedValue) payload.suggestedValue = dto.suggestedValue;
    await this.prisma.contributionQueue.create({
      data: { type: "REPORT", venueId, payload, submittedBy: null },
    });
    const pendingCount = await this.prisma.contributionQueue.count({
      where: { venueId, type: "REPORT", status: "PENDING" },
    });
    return { urgent: pendingCount >= getUrgentReportThreshold() };
  }
}
