import { describe, it, expect } from "vitest";
import { AdminUserSearchQuerySchema, AdminUserSearchResultSchema } from "./admin-user-search.schema";

describe("AdminUserSearchQuerySchema", () => {
  it("accepts a search term of at least 2 characters", () => {
    expect(AdminUserSearchQuerySchema.safeParse({ search: "ha" }).success).toBe(true);
  });

  it("rejects a 1-character search term (too broad, would return too many rows)", () => {
    expect(AdminUserSearchQuerySchema.safeParse({ search: "h" }).success).toBe(false);
  });

  it("rejects a missing search term", () => {
    expect(AdminUserSearchQuerySchema.safeParse({}).success).toBe(false);
  });
});

describe("AdminUserSearchResultSchema", () => {
  it("accepts a list of matching users with id/email/role", () => {
    const result = AdminUserSearchResultSchema.safeParse([
      { id: "550e8400-e29b-41d4-a716-446655440000", email: "hazar@example.com", role: "CURATOR" },
    ]);
    expect(result.success).toBe(true);
  });
});
