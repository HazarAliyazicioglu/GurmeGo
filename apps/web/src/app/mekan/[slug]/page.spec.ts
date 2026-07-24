import { describe, it, expect, vi } from "vitest";
import { generateStaticParams } from "./page";

vi.mock("@/lib/api", () => ({
  getVenueBySlug: vi.fn(),
}));

describe("venue detail page", () => {
  it("generateStaticParams is exported for SSG", () => {
    expect(typeof generateStaticParams).toBe("function");
  });
});
