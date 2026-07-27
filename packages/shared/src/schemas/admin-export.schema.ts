import { z } from "zod";

// `GET /admin/export`'s `format` query param. MINOR finding: the controller previously read this
// as an unvalidated `@Query("format") format: "json" | "csv" = "json"` — a TypeScript-only
// annotation with no runtime check, so an invalid value (e.g. `?format=xml`) fell through
// untouched to `AdminReportsService.exportVenues`, which only branches on `format === "json"` and
// silently treats anything else as CSV instead of rejecting the request. Same
// `ZodValidationPipe` convention as `AdminQueueListQuerySchema`.
export const AdminExportQuerySchema = z.object({
  format: z.enum(["json", "csv"]).default("json"),
});
export type AdminExportQuery = z.infer<typeof AdminExportQuerySchema>;
