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

export const CsvImportResultSchema = z.object({
  created: z.number().int().min(0),
  skipped: z.number().int().min(0),
  errors: z.array(z.object({ row: z.number().int(), message: z.string() })),
});
export type CsvImportResult = z.infer<typeof CsvImportResultSchema>;
