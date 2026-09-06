import { BoutiqueService } from "./boutique.service";

describe("BoutiqueService.evaluate", () => {
  const service = new BoutiqueService();

  it("returns true when branch count under threshold, not franchise, has editorial note", () => {
    expect(service.evaluate({ branchCount: 2, franchiseFlag: false, hasEditorialNote: true, status: "PUBLISHED" })).toBe(true);
  });

  it("returns false when branch count exceeds RULES_BOUTIQUE_MAX_BRANCHES", () => {
    // RULES_BOUTIQUE_MAX_BRANCHES is set to "3" by test/env-defaults.setup.ts before this file's
    // static import of rule-config.ts ever runs, so a per-test assignment here would be a no-op
    // (rule-config.ts reads and freezes the value at module load, not per-call).
    expect(service.evaluate({ branchCount: 5, franchiseFlag: false, hasEditorialNote: true, status: "PUBLISHED" })).toBe(false);
  });

  it("returns false when franchiseFlag is true regardless of branch count", () => {
    expect(service.evaluate({ branchCount: 1, franchiseFlag: true, hasEditorialNote: true, status: "PUBLISHED" })).toBe(false);
  });

  it("returns false when no editorial note (B3 unmet)", () => {
    expect(service.evaluate({ branchCount: 1, franchiseFlag: false, hasEditorialNote: false, status: "PUBLISHED" })).toBe(false);
  });
});

describe("BoutiqueService.evaluate — status gate", () => {
  const service = new BoutiqueService();
  it("returns false for DRAFT even if all other rules pass", () => {
    expect(service.evaluate({ branchCount: 1, franchiseFlag: false, hasEditorialNote: true, status: "DRAFT" })).toBe(false);
  });
  it("returns true for PUBLISHED meeting all rules", () => {
    expect(service.evaluate({ branchCount: 1, franchiseFlag: false, hasEditorialNote: true, status: "PUBLISHED" })).toBe(true);
  });
});
