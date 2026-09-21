import { describe, it, expect } from "vitest";
import { AssignRoleSchema } from "./admin-role.schema";

describe("AssignRoleSchema", () => {
  it("accepts a role name", () => {
    expect(AssignRoleSchema.parse({ role: "curator" })).toEqual({ role: "curator" });
  });
  it.each([{}, { role: 123 }, { role: "" }, { role: null }, { role: "x".repeat(51) }, "curator", null])(
    "rejects %j",
    (bad) => {
      expect(AssignRoleSchema.safeParse(bad).success).toBe(false);
    },
  );
  // Which roles are actually ASSIGNABLE is a business rule owned by AdminUsersService (MVP: curator only);
  // this schema only guarantees the body is a well-formed { role: string }.
  it("does not decide which roles are assignable (that is the service's job)", () => {
    expect(AssignRoleSchema.safeParse({ role: "admin" }).success).toBe(true);
  });
  it("strips unknown keys", () => {
    expect(AssignRoleSchema.parse({ role: "curator", userId: "x" })).toEqual({ role: "curator" });
  });
});
