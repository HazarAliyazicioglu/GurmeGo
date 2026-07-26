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
// literal enum text and failed with 22P02, surfacing as a 500 instead of a clean 400. Enum values
// match `AdminQueueItemSchema.type`/`.status` above -- REPORT/EDIT is a deliberate subset of the
// full `ContributionType` (NEW_VENUE/OWNER_VERIFICATION are not queue-listed), matching that
// schema's established precedent (Task 2/3 of this plan).
export const AdminQueueListQuerySchema = z.object({
  type: z.enum(["REPORT", "EDIT"]).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});
export type AdminQueueListQuery = z.infer<typeof AdminQueueListQuerySchema>;

export const CsvImportResultSchema = z.object({
  created: z.number().int().min(0),
  skipped: z.number().int().min(0),
  errors: z.array(z.object({ row: z.number().int(), message: z.string() })),
});
export type CsvImportResult = z.infer<typeof CsvImportResultSchema>;
