import { z } from "zod";

export const AdminQueueItemSchema = z.object({
  id: z.string().uuid(),
  // list()/getQueue() still filters by type=REPORT by design (the queue UI is REPORT-focused, per
  // the design doc) — that part is unchanged. But a single item fetched or mutated by id
  // (approve()/reject()) can genuinely be an EDIT item, so this schema must accept both.
  type: z.enum(["REPORT", "EDIT"]),
  venueId: z.string().uuid().nullable(),
  payload: z.record(z.string(), z.unknown()),
  submittedBy: z.string().nullable(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  venue: z.object({ name: z.string(), slug: z.string() }).nullable(),
  urgent: z.boolean(),
});
export type AdminQueueItem = z.infer<typeof AdminQueueItemSchema>;

export const AdminQueueListSchema = z.array(AdminQueueItemSchema);

// approve()/reject() return the raw updated ContributionQueue row (no `venue`/`urgent` enrichment —
// those are computed only inside list()'s mapping step, verified against admin-queue.service.ts).
export const AdminQueueMutationResultSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["REPORT", "EDIT"]),
  venueId: z.string().uuid().nullable(),
  payload: z.record(z.string(), z.unknown()),
  submittedBy: z.string().nullable(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

// `GET /admin/queue`'s `type`/`status` query params. Final whole-branch review finding:
// AdminQueueController previously cast these raw strings directly to their Prisma enum types
// with no validation, so an invalid value (e.g. `?status=NOTAREALSTATUS`) reached Postgres as
// literal enum text and failed with 22P02, surfacing as a 500 instead of a clean 400.
//
// Re-review finding (round 2): `type` here is a FILTER over the admin queue LIST, not a shape of
// an already-queued item's payload -- it is a different concern from `AdminQueueItemSchema.type`,
// which is deliberately narrowed to REPORT/EDIT and stays that way (see that schema's own
// comment). A curator filtering the list must be able to select on ANY of the 4 real
// `ContributionType` values (confirmed against apps/api/prisma/schema.prisma): REPORT, NEW_VENUE,
// EDIT, OWNER_VERIFICATION. The previous REPORT/EDIT-only version of this schema was copied from
// AdminQueueItemSchema and silently regressed a working filter (`?type=NEW_VENUE` 400'd instead of
// returning a filtered list).
// `limit`: security/ops finding -- this endpoint used to fetch every matching row with no cap at
// all, getting slower (and more expensive) as the queue grows with no ceiling. Defaults to a much
// higher value than the public venues list's `limit.max(50)` (packages/shared's
// `VenueListQuerySchema`) -- this is an internal curator tool where seeing more rows at once is
// useful, not a public endpoint needing tight pagination -- but a bounded default all the same,
// same `z.coerce.number()` pattern as that schema's own `limit`.
export const AdminQueueListQuerySchema = z.object({
  type: z.enum(["REPORT", "NEW_VENUE", "EDIT", "OWNER_VERIFICATION"]).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type AdminQueueListQuery = z.infer<typeof AdminQueueListQuerySchema>;

export const CsvImportResultSchema = z.object({
  created: z.number().int().min(0),
  skipped: z.number().int().min(0),
  errors: z.array(z.object({ row: z.number().int(), message: z.string() })),
});
export type CsvImportResult = z.infer<typeof CsvImportResultSchema>;
