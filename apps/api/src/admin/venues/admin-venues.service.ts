import { Injectable } from "@nestjs/common";
import { AdminVenueCreateInput, AdminVenueUpdateInput } from "@gurmego/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { BoutiqueService } from "../../rule-engine/boutique.service";
import { VenuesRepository } from "../../venues/venues.repository";

@Injectable()
export class AdminVenuesService {
  constructor(
    private prisma: PrismaService,
    private boutique: BoutiqueService,
    private venuesRepository: VenuesRepository,
  ) {}

  create(input: AdminVenueCreateInput) {
    const isBoutique = this.boutique.evaluate({
      branchCount: input.branchCount,
      franchiseFlag: input.franchiseFlag,
      hasEditorialNote: !!input.editorialNote,
    });
    // `location` is a required PostGIS column the Prisma client can't write (ADR 002) — delegated to
    // the repository's raw-SQL insert, which also handles isBoutique/verifiedAt/status/source.
    return this.venuesRepository.createWithLocation({
      ...input,
      isBoutique,
      verifiedAt: new Date(),
      status: "DRAFT",
      source: "MANUAL",
    });
  }

  update(id: string, input: AdminVenueUpdateInput) {
    // `update` is a partial patch — only recompute isBoutique when both rule-engine inputs are present
    // in this request; otherwise leave it untouched (repository skips undefined fields).
    const isBoutique =
      input.branchCount !== undefined && input.franchiseFlag !== undefined
        ? this.boutique.evaluate({
            branchCount: input.branchCount,
            franchiseFlag: input.franchiseFlag,
            hasEditorialNote: !!input.editorialNote,
          })
        : undefined;
    return this.venuesRepository.updateWithLocation(id, { ...input, isBoutique });
  }

  async revert(venueId: string, versionId: string) {
    const version = await this.prisma.venueVersion.findUniqueOrThrow({ where: { id: versionId } });
    return this.prisma.venue.update({ where: { id: venueId }, data: version.snapshot as any });
  }
}
