import { z } from "zod";

export const CreateReportSchema = z
  .object({
    reason: z.string().min(5).max(500),
    // "Düzeltme" (correction): naming the wrong field and the correct value, instead of only a
    // free-text reason. Kept on this REPORT schema, not a separate ContributionType -- see
    // reports.service.ts's comment on why approving a REPORT deliberately never touches Venue.
    field: z.string().min(1).max(100).optional(),
    suggestedValue: z.string().min(1).max(100).optional(),
  })
  .refine((data) => data.field !== undefined || data.suggestedValue === undefined, {
    message: "suggestedValue requires field",
    path: ["field"],
  });
export type CreateReport = z.infer<typeof CreateReportSchema>;

export const ReportResponseSchema = z.object({ urgent: z.boolean() });
