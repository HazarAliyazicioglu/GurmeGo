import { Injectable, NotFoundException } from "@nestjs/common";
import { VenueListQuery } from "@gurmego/shared";
import { VenuesRepository } from "./venues.repository";

@Injectable()
export class VenuesService {
  constructor(private repo: VenuesRepository) {}

  async list(filters: VenueListQuery) {
    const { items, nextCursor } = await this.repo.searchPublished(filters);
    return {
      data: items,
      meta: { next_cursor: nextCursor, has_more: nextCursor !== null },
    };
  }

  mapView(bbox: [number, number, number, number]) {
    return this.repo.findInBbox(bbox);
  }

  async detail(slug: string) {
    const venue = await this.repo.findBySlug(slug);
    if (!venue) {
      // The HTTP response body must stay exactly `{ error: { code, message } }` per
      // docs/api-spec.md (no top-level `message`), but NestJS's HttpException only
      // derives `.message` (the Error message, used by e.g. `toThrow`) from a
      // top-level `message` property on the response object. Set it explicitly
      // after construction so the JSON body is unaffected.
      const notFound = new NotFoundException({ error: { code: "VENUE_NOT_FOUND", message: "Mekan bulunamadı" } });
      notFound.message = "Mekan bulunamadı";
      throw notFound;
    }
    return venue;
  }
}
