import { describe, it, expect } from "vitest";
import { toggleViewMode } from "./discovery-client";

describe("toggleViewMode", () => {
  it("switches between list and map", () => {
    expect(toggleViewMode("list")).toBe("map");
    expect(toggleViewMode("map")).toBe("list");
  });
});
