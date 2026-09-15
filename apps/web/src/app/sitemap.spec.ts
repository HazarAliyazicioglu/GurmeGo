import { describe, it, expect, vi } from "vitest";
import { getDistricts } from "@/lib/api";
import { getAllPublishedVenueSlugs } from "@/lib/all-published-venues";
import sitemap from "./sitemap";

vi.mock("@/lib/api", () => ({ getDistricts: vi.fn() }));
vi.mock("@/lib/all-published-venues", () => ({ getAllPublishedVenueSlugs: vi.fn() }));

describe("sitemap", () => {
  it("lists the home page, every district, and every published venue", async () => {
    vi.mocked(getDistricts).mockResolvedValue([
      { id: "d1", slug: "kadikoy", name: "Kadıköy" },
      { id: "d2", slug: "besiktas", name: "Beşiktaş" },
    ] as never);
    vi.mocked(getAllPublishedVenueSlugs).mockResolvedValue(["kadikoy-kahvecisi", "besiktas-firini"]);

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain("https://gurmego.com");
    expect(urls).toContain("https://gurmego.com/kadikoy");
    expect(urls).toContain("https://gurmego.com/besiktas");
    expect(urls).toContain("https://gurmego.com/mekan/kadikoy-kahvecisi");
    expect(urls).toContain("https://gurmego.com/mekan/besiktas-firini");
    expect(urls).toHaveLength(5);
  });
});
