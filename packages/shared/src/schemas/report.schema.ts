import { z } from "zod";

// Plain object form kept exported for its `.shape` (apps/mobile's ReportForm validates just
// `.shape.reason` client-side before the refined schema below ever runs) -- `.refine()` wraps it
// in a ZodEffects, which has no `.shape`.
export const CreateReportObjectSchema = z.object({
  reason: z.string().min(5).max(500),
  // "Düzeltme" (correction): naming the wrong field and the correct value, instead of only a
  // free-text reason. Kept on this REPORT schema, not a separate ContributionType -- see
  // reports.service.ts's comment on why approving a REPORT deliberately never touches Venue.
  field: z.string().min(1).max(100).optional(),
  suggestedValue: z.string().min(1).max(100).optional(),
});
export const CreateReportSchema = CreateReportObjectSchema.refine(
  (data) => data.field !== undefined || data.suggestedValue === undefined,
  { message: "suggestedValue requires field", path: ["field"] },
);
export type CreateReport = z.infer<typeof CreateReportSchema>;

export const ReportResponseSchema = z.object({ urgent: z.boolean() });
