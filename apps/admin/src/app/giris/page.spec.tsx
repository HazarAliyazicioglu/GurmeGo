import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GirisPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const signIn = vi.fn();
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ signIn }) }));

beforeEach(() => {
  push.mockClear();
  signIn.mockReset();
});

describe("GirisPage", () => {
  it("calls signIn with email/password and redirects to /kuyruk on success", async () => {
    signIn.mockResolvedValue({ error: null });
    render(<GirisPage />);
    fireEvent.change(screen.getByLabelText(/e-posta/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/şifre/i), { target: { value: "sifre123" } });
    fireEvent.click(screen.getByRole("button", { name: /giriş/i }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith("a@b.com", "sifre123"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/kuyruk"));
  });

  it("shows the error and does NOT redirect when signIn fails", async () => {
    signIn.mockResolvedValue({ error: "Geçersiz kimlik bilgileri" });
    render(<GirisPage />);
    fireEvent.change(screen.getByLabelText(/e-posta/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/şifre/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /giriş/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Geçersiz kimlik bilgileri"));
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a visible error and re-enables the submit button (instead of hanging forever) when signIn() rejects", async () => {
    signIn.mockRejectedValue(new Error("network error"));
    render(<GirisPage />);
    fireEvent.change(screen.getByLabelText(/e-posta/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/şifre/i), { target: { value: "sifre123" } });
    const submitButton = screen.getByRole("button", { name: /giriş/i });

    fireEvent.click(submitButton);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(submitButton).not.toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });
});
