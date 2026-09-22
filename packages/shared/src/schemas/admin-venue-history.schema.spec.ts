import { describe, it, expect } from "vitest";
import {
  AdminVenueSearchQuerySchema,
  AdminVenueSearchResultSchema,
  AdminVenueVersionListSchema,
} from "./admin-venue-history.schema";

describe("AdminVenueSearchQuerySchema", () => {
  it("accepts a search term of at least 2 characters", () => {
    expect(AdminVenueSearchQuerySchema.safeParse({ search: "ka" }).success).toBe(true);
  });

  it("rejects a 1-character search term", () => {
    expect(AdminVenueSearchQuerySchema.safeParse({ search: "k" }).success).toBe(false);
  });
});

describe("AdminVenueSearchResultSchema", () => {
  it("accepts a list of matching venues with id/name/slug/status", () => {
    const result = AdminVenueSearchResultSchema.safeParse([
      { id: "550e8400-e29b-41d4-a716-446655440000", name: "Kadıköy Kahvecisi", slug: "kadikoy-kahvecisi", status: "PUBLISHED" },
    ]);
    expect(result.success).toBe(true);
  });
});

describe("AdminVenueVersionListSchema", () => {
  it("accepts a list of versions with id/createdAt/createdBy", () => {
    const result = AdminVenueVersionListSchema.safeParse([
      { id: "660e8400-e29b-41d4-a716-446655440000", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "admin-1" },
    ]);
    expect(result.success).toBe(true);
  });

  it("accepts a null createdBy (system-generated version)", () => {
    const result = AdminVenueVersionListSchema.safeParse([
      { id: "660e8400-e29b-41d4-a716-446655440000", createdAt: "2026-01-01T00:00:00.000Z", createdBy: null },
    ]);
    expect(result.success).toBe(true);
  });
});
