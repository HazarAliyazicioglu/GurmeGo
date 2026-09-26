import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SuggestVenue } from "@gurmego/shared";

@Injectable()
export class VenueSuggestionsService {
  constructor(private prisma: PrismaService) {}

  async submit(dto: SuggestVenue) {
    // districtSlug is a free string from the web form's <select>, not itself validated against
    // real districts by the zod schema (districts are DB data, not a fixed enum) -- checked
    // explicitly here, same "clean 404 up front" pattern as ReportsService.submit's venue check,
    // rather than letting a bad slug through into an opaque payload the admin curator can't parse.
    const district = await this.prisma.district.findUnique({ where: { slug: dto.districtSlug } });
    if (!district) {
      const notFound = new NotFoundException({ error: { code: "DISTRICT_NOT_FOUND", message: "İlçe bulunamadı" } });
      notFound.message = "İlçe bulunamadı";
      throw notFound;
    }

    const payload: Record<string, string> = {
      name: dto.name,
      districtSlug: dto.districtSlug,
      districtName: district.name,
      category: dto.category,
    };
    if (dto.address) payload.address = dto.address;
    if (dto.note) payload.note = dto.note;

    await this.prisma.contributionQueue.create({
      data: { type: "NEW_VENUE", venueId: null, submittedBy: null, payload },
    });
    return { ok: true as const };
  }
}
