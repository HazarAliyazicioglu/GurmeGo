import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  push.mockClear();
  vi.resetModules();
});

describe("ErisimYokPage", () => {
  it("renders a sign-out control that calls signOut() and redirects to /giris", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({ signOut }),
    }));
    const { default: ErisimYokPage } = await import("./page");
    render(<ErisimYokPage />);
    fireEvent.click(await screen.findByRole("button", { name: /çıkış/i }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/giris"));
  });

  it("shows a visible error and does NOT redirect when signOut() resolves with an error", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: "Oturum zaten geçersiz." });
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({ signOut }),
    }));
    const { default: ErisimYokPage } = await import("./page");
    render(<ErisimYokPage />);
    fireEvent.click(await screen.findByRole("button", { name: /çıkış/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/çıkış yapılamadı/i));
    expect(push).not.toHaveBeenCalledWith("/giris");
  });

  it("shows a visible error and does NOT redirect when signOut() rejects outright", async () => {
    const signOut = vi.fn().mockRejectedValue(new Error("network error"));
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({ signOut }),
    }));
    const { default: ErisimYokPage } = await import("./page");
    render(<ErisimYokPage />);
    fireEvent.click(await screen.findByRole("button", { name: /çıkış/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/çıkış yapılamadı/i));
    expect(push).not.toHaveBeenCalledWith("/giris");
  });

  // 2026-09-25 audit finding: sign-out button had no focus-visible style, every page.
  it("the sign-out button has a visible focus style", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({ signOut: vi.fn() }),
    }));
    const { default: ErisimYokPage } = await import("./page");
    render(<ErisimYokPage />);
    const button = await screen.findByRole("button", { name: /çıkış/i });
    expect(button.className).toMatch(/focus-visible:outline/);
  });
});
