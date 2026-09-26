import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthNav } from "./auth-nav";

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock("@/lib/auth-context", () => ({ useAuth: mockUseAuth }));

describe("AuthNav", () => {
  it("shows a 'Giriş yap' link to /giris for anonymous visitors", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<AuthNav />);
    expect(screen.getByRole("link", { name: "Giriş yap" })).toHaveAttribute("href", "/giris");
  });

  it("shows a 'Favorilerim' link to /favoriler when signed in", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" }, loading: false });
    render(<AuthNav />);
    expect(screen.getByRole("link", { name: "Favorilerim" })).toHaveAttribute("href", "/favoriler");
    expect(screen.queryByRole("link", { name: "Giriş yap" })).toBeNull();
  });

  it("renders nothing while the session is still loading (no login-link flash)", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(<AuthNav />);
    expect(container).toBeEmptyDOMElement();
  });
});
