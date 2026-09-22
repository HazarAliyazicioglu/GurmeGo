import { z } from "zod";

// GET /admin/reports/data-quality's response (AdminReportsService.dataQuality). `perDistrict[].name`
// is a plain string, not nullable -- every Venue.districtId is a real FK to an existing District row,
// so the service's `districtMap.get(row.districtId)` lookup always resolves in practice.
export const DataQualityReportSchema = z.object({
  perDistrict: z.array(z.object({ name: z.string(), count: z.number().int().min(0) })),
  staleCount: z.number().int().min(0),
  bySource: z.array(z.object({ source: z.enum(["MANUAL", "USER", "AUTO"]), count: z.number().int().min(0) })),
});
export type DataQualityReport = z.infer<typeof DataQualityReportSchema>;
