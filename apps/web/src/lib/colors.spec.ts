import { describe, it, expect } from "vitest";
import { PRIMITIVE_COLORS, SEMANTIC_COLORS } from "./colors";

describe("PRIMITIVE_COLORS", () => {
  // Every tone found in production className strings before this token system existed
  // (`grep -rohE "#[0-9a-fA-F]{3,8}" apps/web/src` on 2026-09-22) must have a name here —
  // an incomplete list was the idea-red-team's finding against the first draft of this work.
  it("names every hex tone actually used in the codebase before this change", () => {
    const expected = [
      "#201d18", "#2d2923", "#d75d3b", "#bd4c30", "#9e422b", "#e77959", "#e67b5e",
      "#f4f0e7", "#faf7f0", "#fffdf8", "#eadfce", "#e8e1d5", "#eee5d7", "#75402f",
    ];
    const actual = Object.values(PRIMITIVE_COLORS);
    for (const hex of expected) {
      expect(actual).toContain(hex);
    }
    expect(actual).toHaveLength(expected.length);
  });
});

describe("SEMANTIC_COLORS", () => {
  it("defines brandSolid as the AA-contrast-safe terracotta (4.95:1 vs white, not the 3.81:1 default)", () => {
    expect(SEMANTIC_COLORS.brandSolid).toBe(PRIMITIVE_COLORS.terracottaDark);
  });

  it("defines brand as the decorative terracotta (not text-bearing)", () => {
    expect(SEMANTIC_COLORS.brand).toBe(PRIMITIVE_COLORS.terracotta);
  });
});
