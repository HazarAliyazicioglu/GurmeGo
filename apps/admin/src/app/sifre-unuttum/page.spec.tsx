import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SifreUnuttumPage from "./page";

const requestPasswordReset = vi.fn();
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ requestPasswordReset }) }));

describe("SifreUnuttumPage (admin)", () => {
  it("sends the reset link and shows a confirmation naming the address", async () => {
    requestPasswordReset.mockResolvedValue({ error: null });
    render(<SifreUnuttumPage />);
    fireEvent.change(screen.getByLabelText("E-posta"), { target: { value: "curator@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Sıfırlama linki gönder" }));
    expect(await screen.findByRole("status")).toHaveTextContent("curator@x.com");
    expect(requestPasswordReset).toHaveBeenCalledWith("curator@x.com");
  });

  it("shows the error and keeps the form when the request fails", async () => {
    requestPasswordReset.mockResolvedValue({ error: "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene." });
    render(<SifreUnuttumPage />);
    fireEvent.change(screen.getByLabelText("E-posta"), { target: { value: "curator@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Sıfırlama linki gönder" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Çok fazla deneme");
    await waitFor(() => expect(screen.getByRole("button", { name: "Sıfırlama linki gönder" })).not.toBeDisabled());
  });

  it("links back to /giris", () => {
    render(<SifreUnuttumPage />);
    expect(screen.getByRole("link", { name: "Girişe dön" })).toHaveAttribute("href", "/giris");
  });
});
