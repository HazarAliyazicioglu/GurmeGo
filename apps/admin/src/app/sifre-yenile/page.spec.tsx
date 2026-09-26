import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SifreYenilePage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const updatePassword = vi.fn();
const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock("@/lib/auth-context", () => ({ useAuth: mockUseAuth }));

describe("SifreYenilePage (admin)", () => {
  beforeEach(() => {
    push.mockClear();
    updatePassword.mockReset();
  });

  it("says the link is invalid/expired when there is no recovery session", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, updatePassword });
    render(<SifreYenilePage />);
    expect(screen.getByRole("alert")).toHaveTextContent("geçersiz veya süresi dolmuş");
    expect(screen.getByRole("link", { name: "Yeni link iste" })).toHaveAttribute("href", "/sifre-unuttum");
  });

  it("updates the password and goes to /kuyruk", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" }, loading: false, updatePassword });
    updatePassword.mockResolvedValue({ error: null });
    render(<SifreYenilePage />);
    fireEvent.change(screen.getByLabelText("Yeni şifre"), { target: { value: "newsecret" } });
    fireEvent.click(screen.getByRole("button", { name: "Şifreyi güncelle" }));
    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith("newsecret"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/kuyruk"));
  });

  it("shows the error and does not navigate when the update fails", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" }, loading: false, updatePassword });
    updatePassword.mockResolvedValue({ error: "Yeni şifre eskisiyle aynı olamaz." });
    render(<SifreYenilePage />);
    fireEvent.change(screen.getByLabelText("Yeni şifre"), { target: { value: "oldsecret" } });
    fireEvent.click(screen.getByRole("button", { name: "Şifreyi güncelle" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("eskisiyle aynı");
    expect(push).not.toHaveBeenCalled();
  });
});
