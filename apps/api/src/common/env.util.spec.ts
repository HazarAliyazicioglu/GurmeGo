import { parsePositiveIntEnv } from "./env.util";

describe("parsePositiveIntEnv", () => {
  it("returns the fallback when the variable is unset", () => {
    expect(parsePositiveIntEnv("X", undefined, 7)).toBe(7);
  });
  it("parses a positive integer", () => {
    expect(parsePositiveIntEnv("X", "42", 7)).toBe(42);
  });
  // `Number("lots")` is NaN and `count > NaN` is always false: a typo'd limit must fail at boot, not silently
  // turn the guard into a no-op.
  it.each(["lots", "0", "-3", "5.5", ""])("throws naming the variable for %p", (raw) => {
    expect(() => parsePositiveIntEnv("MY_LIMIT", raw, 7)).toThrow(/MY_LIMIT must be a positive integer if set/);
  });
});
