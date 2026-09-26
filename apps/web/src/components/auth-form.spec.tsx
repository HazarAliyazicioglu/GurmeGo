import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuthForm } from "./auth-form";

const signIn = vi.fn().mockResolvedValue({ error: null });
const signUp = vi.fn();
const push = vi.fn();
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ signIn, signUp }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("AuthForm", () => {
  it("calls signIn with email/password on submit", async () => {
    render(<AuthForm mode="signin" />);
    fireEvent.change(screen.getByLabelText(/e-posta/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/şifre/i), { target: { value: "sifre123" } });
    fireEvent.click(screen.getByRole("button", { name: /giriş/i }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith("a@b.com", "sifre123"));
  });
});

describe("AuthForm — disabled while submitting", () => {
  it("disables the submit button until the request resolves", async () => {
    let resolveSignIn: (v: { error: string | null }) => void;
    signIn.mockReturnValue(new Promise((resolve) => { resolveSignIn = resolve; }));
    render(<AuthForm mode="signin" />);
    fireEvent.change(screen.getByLabelText("E-posta"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText("Şifre"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Giriş yap" }));
    expect(screen.getByRole("button", { name: "Giriş yap" })).toBeDisabled();
    resolveSignIn!({ error: null });
    await waitFor(() => expect(screen.getByRole("button", { name: "Giriş yap" })).not.toBeDisabled());
  });
});

describe("AuthForm — signup email confirmation and forgot-password link", () => {
  function fill() {
    fireEvent.change(screen.getByLabelText("E-posta"), { target: { value: "new@user.com" } });
    fireEvent.change(screen.getByLabelText("Şifre"), { target: { value: "secret12" } });
  }

  it("shows a 'check your email' panel (and does not navigate) when signup needs confirmation", async () => {
    push.mockClear();
    signUp.mockResolvedValue({ error: null, needsConfirmation: true });
    render(<AuthForm mode="signup" />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Kayıt ol" }));
    expect(await screen.findByRole("status")).toHaveTextContent("new@user.com");
    expect(push).not.toHaveBeenCalled();
  });

  it("navigates to /favoriler when signup returns a live session", async () => {
    push.mockClear();
    signUp.mockResolvedValue({ error: null, needsConfirmation: false });
    render(<AuthForm mode="signup" />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Kayıt ol" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/favoriler"));
  });

  it("links to /sifre-unuttum in signin mode only", () => {
    const { unmount } = render(<AuthForm mode="signin" />);
    expect(screen.getByRole("link", { name: "Şifremi unuttum" })).toHaveAttribute("href", "/sifre-unuttum");
    unmount();
    render(<AuthForm mode="signup" />);
    expect(screen.queryByRole("link", { name: "Şifremi unuttum" })).toBeNull();
  });

  it("links to the privacy policy and terms in signup mode", () => {
    render(<AuthForm mode="signup" />);
    expect(screen.getByRole("link", { name: "Gizlilik Politikası" })).toHaveAttribute("href", "/gizlilik");
    expect(screen.getByRole("link", { name: "Kullanım Koşulları" })).toHaveAttribute("href", "/kullanim-kosullari");
  });
});
