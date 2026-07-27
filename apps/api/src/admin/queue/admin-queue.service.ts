import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ContributionStatus, ContributionType, Prisma } from "@prisma/client";
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

// `id` here has already passed `ParseUUIDPipe` at the controller (admin-queue.controller.ts) --
// this is the clean "well-formed id, no such row" case, which must surface as 404, not a raw
// Prisma "not found" bubbling up to a 500 via the global exception filter.
function notFoundError() {
  const ex = new NotFoundException({ error: { code: "CONTRIBUTION_NOT_FOUND", message: "Katkı bulunamadı" } });
  ex.message = "Katkı bulunamadı";
  return ex;
}

@Injectable()
export class AdminQueueService {
  constructor(private prisma: PrismaService, private venuesRepository: VenuesRepository) {}

  // Security/ops finding: this endpoint used to (a) fetch every matching row with no limit at
  // all, and (b) run one SEPARATE `count()` query per REPORT row to compute urgency -- the same
  // venue's report count getting recomputed redundantly across its own multiple queue rows, and
  // the whole endpoint getting slower (both in row count and query count) as the queue grows.
  // `limit` (default 100, validated by `AdminQueueListQuerySchema`) caps (a); a single `groupBy`
  // over all REPORT rows' distinct venueIds in the current page -- computed once, not once per
  // row -- replaces the N separate `count()` calls for (b).
  async list(type?: ContributionType, status?: ContributionStatus, limit = 100) {
    const items = await this.prisma.contributionQueue.findMany({
      where: {
        // `type`/`status` are now validated by `AdminQueueListQuerySchema` (@gurmego/shared) via
        // `ZodValidationPipe` in admin-queue.controller.ts before reaching this service -- an
        // invalid value is rejected with a clean 400 there and never reaches Prisma/Postgres.
        // (Final whole-branch review finding: this used to be an unvalidated `@Query()` string
        // cast directly to the enum type, so a bad value reached Postgres as literal enum text
        // and failed with 22P02, surfacing as a 500 on this admin-only endpoint.)
        type,
        status: status ?? "PENDING",
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      include: { venue: { select: { name: true, slug: true } } },
    });

    const threshold = getUrgentReportThreshold();
    const reportVenueIds = Array.from(
      new Set(items.filter((item) => item.type === "REPORT" && item.venueId).map((item) => item.venueId as string)),
    );
    // Only queried when the current page actually contains REPORT rows -- an empty `in: []` filter
    // would still be a valid (if pointless) query, but skipping it entirely avoids a round-trip
    // when the page is all EDIT/NEW_VENUE/OWNER_VERIFICATION items.
    const grouped = reportVenueIds.length
      ? await this.prisma.contributionQueue.groupBy({
          by: ["venueId"],
          where: { venueId: { in: reportVenueIds }, type: "REPORT", status: "PENDING" },
          _count: { _all: true },
        })
      : [];
    const countByVenueId = new Map(grouped.map((g) => [g.venueId as string, g._count._all]));

    // Urgent (>= threshold pending REPORTs on same venue) sort first, then re_verify, then rest
    const withUrgency = items.map((item) => {
      const urgent = item.type === "REPORT" && item.venueId ? (countByVenueId.get(item.venueId) ?? 0) >= threshold : false;
      return { item, urgent };
    });
    return withUrgency.sort((a, b) => Number(b.urgent) - Number(a.urgent)).map((w) => ({ ...w.item, urgent: w.urgent }));
  }

  async approve(id: string, reviewerId: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const item = await tx.contributionQueue.findUnique({ where: { id } });
      if (!item) throw notFoundError();
      // Race fix: two concurrent approve/reject calls on the same PENDING row (two admin tabs, a
      // double-click) must not both succeed. A plain read-then-write (the old code: read status,
      // branch on it, then unconditionally `.update()`) has a window between the read and the
      // write where a second transaction can read the same PENDING status and also proceed.
      // `updateMany` with `status: "PENDING"` in the WHERE turns the write itself into the guard:
      // Postgres's row-level UPDATE lock means only one of two concurrent transactions can
      // actually flip status away from PENDING -- the other blocks until the first commits, then
      // its own WHERE re-evaluates against the now-changed status and matches zero rows. Checking
      // `count === 1` after the fact is what turns "zero rows affected" into a clean conflict
      // response instead of silently doing nothing.
      const claimed = await tx.contributionQueue.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "APPROVED", reviewedBy: reviewerId, reviewedAt: new Date() },
      });
      if (claimed.count !== 1) throw alreadyProcessedError();
      if (item.type === "EDIT" && item.venueId) {
        const snapshot = await this.venuesRepository.findRawForSnapshot(tx, item.venueId);
        await tx.venueVersion.create({ data: { venueId: item.venueId, snapshot: snapshot as unknown as Prisma.InputJsonValue, createdBy: reviewerId } });
        await tx.venue.update({ where: { id: item.venueId }, data: { verifiedAt: new Date() } });
      }
      // REPORT: intentionally does NOT touch Venue/VenueVersion -- approving a "this info is
      // wrong" report means "we've reviewed it," not "we've confirmed it's accurate." Any actual
      // correction happens through AdminVenuesService.update() (Step 15 above).
      return tx.contributionQueue.findUniqueOrThrow({ where: { id } });
    });
  }

  reject(id: string, reviewerId: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const item = await tx.contributionQueue.findUnique({ where: { id } });
      if (!item) throw notFoundError();
      // Same conditional-update race guard as approve() above.
      const claimed = await tx.contributionQueue.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "REJECTED", reviewedBy: reviewerId, reviewedAt: new Date() },
      });
      if (claimed.count !== 1) throw alreadyProcessedError();
      return tx.contributionQueue.findUniqueOrThrow({ where: { id } });
    });
  }
}
