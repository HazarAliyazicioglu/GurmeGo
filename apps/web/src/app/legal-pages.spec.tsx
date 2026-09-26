import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GizlilikPage, { metadata as gizlilikMeta } from "./gizlilik/page";
import KullanimPage, { metadata as kullanimMeta } from "./kullanim-kosullari/page";

describe("legal pages", () => {
  it("privacy page names the data actually collected and the processors, and states location is not stored", () => {
    render(<GizlilikPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Gizlilik Politikası" })).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    for (const needle of ["e-posta", "Supabase", "Vercel", "Railway", "konum", "KVKK"]) {
      expect(text.toLowerCase()).toContain(needle.toLowerCase());
    }
    expect(text).toMatch(/konum.*(saklanmaz|kaydedilmez)/i);
    expect(gizlilikMeta.title).toContain("Gizlilik");
  });

  it("terms page renders with its own title", () => {
    render(<KullanimPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Kullanım Koşulları" })).toBeInTheDocument();
    expect(kullanimMeta.title).toContain("Kullanım");
  });
});
