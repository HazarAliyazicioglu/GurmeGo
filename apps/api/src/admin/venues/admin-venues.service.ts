import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { BoutiqueService } from "../../rule-engine/boutique.service";

@Injectable()
export class AdminVenuesService {
  constructor(private prisma: PrismaService, private boutique: BoutiqueService) {}

  create(input: any) {
    const isBoutique = this.boutique.evaluate({
      branchCount: input.branchCount,
      franchiseFlag: input.franchiseFlag,
      hasEditorialNote: !!input.editorialNote,
    });
    // Cast: Venue.location is a required `Unsupported("geography(...)")` field, so Prisma omits
    // `create`/`upsert` from the generated VenueDelegate typing (no valid input type exists for it).
    // See admin-venues.service self-review note for the runtime implication (location is not set here).
    return (this.prisma.venue as any).create({
      data: { ...input, isBoutique, verifiedAt: new Date(), status: "DRAFT", source: "MANUAL" },
    });
  }

  update(id: string, input: any) {
    const isBoutique = this.boutique.evaluate({
      branchCount: input.branchCount,
      franchiseFlag: input.franchiseFlag,
      hasEditorialNote: !!input.editorialNote,
    });
    return this.prisma.venue.update({ where: { id }, data: { ...input, isBoutique } });
  }

  async revert(venueId: string, versionId: string) {
    const version = await this.prisma.venueVersion.findUniqueOrThrow({ where: { id: versionId } });
    return this.prisma.venue.update({ where: { id: venueId }, data: version.snapshot as any });
  }
}
