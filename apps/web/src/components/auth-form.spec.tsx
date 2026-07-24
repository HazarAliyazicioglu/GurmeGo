import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuthForm } from "./auth-form";

const signIn = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ signIn, signUp: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("AuthForm", () => {
  it("calls signIn with email/password on submit", async () => {
    render(<AuthForm mode="signin" />);
    fireEvent.change(screen.getByLabelText(/e-posta/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/şifre/i), { target: { value: "sifre123" } });
    fireEvent.click(screen.getByRole("button", { name: /giriş/i }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith("a@b.com", "sifre123"));
  });
});
