import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "./not-found";

describe("NotFound", () => {
  it("shows a branded 404 message with a link back to the discovery page", () => {
    render(<NotFound />);

    expect(screen.getByText(/bu sayfa bulunamadı/i)).toBeTruthy();
    const link = screen.getByRole("link", { name: /mekanları keşfet/i });
    expect(link.getAttribute("href")).toBe("/");
  });
});
