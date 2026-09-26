import { describe, it, expect } from "vitest";
import { CreateReportSchema } from "./report.schema";

describe("CreateReportSchema", () => {
  it("accepts a plain report (reason only, existing behavior)", () => {
    expect(CreateReportSchema.safeParse({ reason: "Fiyat yanlış görünüyor" }).success).toBe(true);
  });

  // "Düzeltme" (correction): a report can optionally name WHICH field is wrong and what the
  // correct value should be, instead of just a free-text reason. Kept on the REPORT type
  // (not a new ContributionType) deliberately -- approving a REPORT never touches
  // Venue/VenueVersion (see reports.service.ts's own comment), so a curator can apply the
  // suggested fix themselves via AdminVenuesService.update() without the approval flow
  // accidentally marking the venue as "re-verified accurate" the way approving an EDIT does.
  it("accepts an optional field + suggestedValue correction", () => {
    const result = CreateReportSchema.safeParse({
      reason: "Fiyat aralığı güncel değil",
      field: "Fiyat aralığı",
      suggestedValue: "MID",
    });
    expect(result.success).toBe(true);
  });

  it("rejects suggestedValue without field (a correction needs to name what it's correcting)", () => {
    expect(CreateReportSchema.safeParse({ reason: "geçersiz", suggestedValue: "MID" }).success).toBe(false);
  });

  it("accepts field without suggestedValue (curator can still see what's being flagged)", () => {
    expect(CreateReportSchema.safeParse({ reason: "geçersiz", field: "Telefon" }).success).toBe(true);
  });

  it("rejects a field or suggestedValue longer than 100 characters", () => {
    expect(CreateReportSchema.safeParse({ reason: "geçersiz", field: "a".repeat(101) }).success).toBe(false);
    expect(CreateReportSchema.safeParse({ reason: "geçersiz", field: "Telefon", suggestedValue: "a".repeat(101) }).success).toBe(false);
  });
});
