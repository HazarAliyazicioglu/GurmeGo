import { describe, it, expect } from "vitest";
import { AdminQueueItemSchema, AdminQueueMutationResultSchema, AdminQueueListQuerySchema } from "./admin-queue.schema";

describe("AdminQueueItemSchema / AdminQueueMutationResultSchema type enum", () => {
  const itemBase = {
    id: "d290f1ee-6c54-4b01-90e6-d701748f0851", venueId: "d290f1ee-6c54-4b01-90e6-d701748f0852",
    payload: { kind: "re_verify" }, submittedBy: null, status: "PENDING" as const,
    reviewedBy: null, reviewedAt: null, createdAt: "2026-07-24T00:00:00.000Z",
    venue: { name: "X", slug: "x" }, urgent: false,
  };
  const mutationBase = {
    id: itemBase.id, venueId: itemBase.venueId, payload: itemBase.payload,
    submittedBy: null, status: "PENDING" as const, reviewedBy: null, reviewedAt: null,
    createdAt: itemBase.createdAt,
  };
  it("AdminQueueItemSchema accepts type EDIT, not just REPORT", () => {
    expect(AdminQueueItemSchema.safeParse({ ...itemBase, type: "EDIT" }).success).toBe(true);
  });
  it("AdminQueueMutationResultSchema accepts type EDIT, not just REPORT", () => {
    expect(AdminQueueMutationResultSchema.safeParse({ ...mutationBase, type: "EDIT" }).success).toBe(true);
  });
});

// Final whole-branch review finding: AdminQueueController's `list()` cast raw `type`/`status`
// query strings directly to their Prisma enum types with no validation, so an invalid value
// reached Postgres as literal enum text and failed with a 500 (22P02) instead of a clean 400.
describe("AdminQueueListQuerySchema", () => {
  it("accepts valid type/status", () => {
    const r = AdminQueueListQuerySchema.safeParse({ type: "EDIT", status: "APPROVED" });
    expect(r.success && r.data).toEqual({ type: "EDIT", status: "APPROVED" });
  });
  it("accepts absent type/status (both optional)", () => expect(AdminQueueListQuerySchema.safeParse({}).success).toBe(true));
  it("rejects an invalid status", () => expect(AdminQueueListQuerySchema.safeParse({ status: "NOTAREALSTATUS" }).success).toBe(false));
  it("rejects an invalid type", () => expect(AdminQueueListQuerySchema.safeParse({ type: "NOT_A_TYPE" }).success).toBe(false));
});
