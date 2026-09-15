import { describe, it, expect } from "vitest";
import { districtLocative } from "./district-locative";

// cross-model-review finding: a hardcoded "'de" suffix on every district name is grammatically
// wrong for two of the three MVP districts -- Turkish locative case needs vowel harmony
// ("Beşiktaş'ta", "Beyoğlu'nda"), not one suffix for every word.
describe("districtLocative", () => {
  it("returns the correct locative form for each of the three MVP districts", () => {
    expect(districtLocative("Kadıköy")).toBe("Kadıköy'de");
    expect(districtLocative("Beşiktaş")).toBe("Beşiktaş'ta");
    expect(districtLocative("Beyoğlu")).toBe("Beyoğlu'nda");
  });

  it("falls back to a plain '-de' suffix for an unrecognized district name", () => {
    expect(districtLocative("Şişli")).toBe("Şişli'de");
  });
});
