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
    expect(r.success && r.data).toEqual({ type: "EDIT", status: "APPROVED", limit: 100 });
  });
  it("accepts absent type/status (both optional)", () => expect(AdminQueueListQuerySchema.safeParse({}).success).toBe(true));
  it("rejects an invalid status", () => expect(AdminQueueListQuerySchema.safeParse({ status: "NOTAREALSTATUS" }).success).toBe(false));
  it("rejects an invalid type", () => expect(AdminQueueListQuerySchema.safeParse({ type: "NOT_A_TYPE" }).success).toBe(false));

  // Re-review finding: this schema is a QUERY FILTER over the admin queue list, unlike
  // AdminQueueItemSchema.type (which models what a single already-queued item's payload shape
  // looks like today, deliberately narrowed to REPORT/EDIT). A curator filtering the list must be
  // able to select on ANY of the real `ContributionType` enum's 4 values (confirmed against
  // apps/api/prisma/schema.prisma), including NEW_VENUE and OWNER_VERIFICATION -- narrowing this
  // query schema to REPORT/EDIT silently regressed a previously-working filter (?type=NEW_VENUE
  // used to work, now 400s).
  it("accepts type=NEW_VENUE (full ContributionType, not the item-schema's narrower subset)", () => {
    const r = AdminQueueListQuerySchema.safeParse({ type: "NEW_VENUE" });
    expect(r.success && r.data).toEqual({ type: "NEW_VENUE", limit: 100 });
  });
  it("accepts type=OWNER_VERIFICATION (full ContributionType, not the item-schema's narrower subset)", () => {
    const r = AdminQueueListQuerySchema.safeParse({ type: "OWNER_VERIFICATION" });
    expect(r.success && r.data).toEqual({ type: "OWNER_VERIFICATION", limit: 100 });
  });

  // Security/ops finding: `GET /admin/queue` used to fetch every matching row with no limit at
  // all -- getting slower and more expensive as the queue grows with no ceiling. `limit` bounds
  // that; unset defaults to 100 (an internal curator tool, so higher than the public venues list's
  // `limit.max(50)`), and it's still capped so a caller can't ask for an unbounded page.
  it("coerces a string `limit` query param to a number", () => {
    const r = AdminQueueListQuerySchema.safeParse({ limit: "25" });
    expect(r.success && r.data.limit).toBe(25);
  });
  it("defaults `limit` to 100 when absent", () => {
    const r = AdminQueueListQuerySchema.safeParse({});
    expect(r.success && r.data.limit).toBe(100);
  });
  it("rejects a `limit` above the 500 ceiling", () => {
    expect(AdminQueueListQuerySchema.safeParse({ limit: "501" }).success).toBe(false);
  });
  it("rejects a `limit` below 1", () => {
    expect(AdminQueueListQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
  });
});
