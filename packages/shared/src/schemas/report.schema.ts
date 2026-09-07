import { z } from "zod";

export const CreateReportSchema = z.object({
  reason: z.string().min(5).max(500),
});
export type CreateReport = z.infer<typeof CreateReportSchema>;

export const ReportResponseSchema = z.object({ urgent: z.boolean() });
