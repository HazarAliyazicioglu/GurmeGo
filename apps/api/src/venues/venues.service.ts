import { Injectable } from "@nestjs/common";
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
}
