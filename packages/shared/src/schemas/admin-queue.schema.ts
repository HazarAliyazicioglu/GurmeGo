import { z } from "zod";

export const AdminQueueItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("REPORT"), // this app only ever queries type=REPORT (see getQueue in api.ts) — a
  // non-REPORT item reaching this schema would mean the query filter itself broke, not a shape we
  // need to tolerate rendering
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
  type: z.literal("REPORT"),
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
