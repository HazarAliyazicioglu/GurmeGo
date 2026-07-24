import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReport } from "@gurmego/shared";
import { getUrgentReportThreshold } from "../common/rule-config";

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async submit(venueId: string, dto: CreateReport) {
    await this.prisma.contributionQueue.create({
      data: { type: "REPORT", venueId, payload: { reason: dto.reason }, submittedBy: null },
    });
    const pendingCount = await this.prisma.contributionQueue.count({
      where: { venueId, type: "REPORT", status: "PENDING" },
    });
    return { urgent: pendingCount >= getUrgentReportThreshold() };
  }
}
