import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApiHttpError } from "@gurmego/api-client";
import RollerPage from "./page";

const signOut = vi.fn().mockResolvedValue({ error: null });
const useAuthMock = vi.fn();
vi.mock("@/lib/auth-context", () => ({ useAuth: () => useAuthMock() }));
const push = vi.fn();
const routerMock = { push };
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
const searchUsers = vi.fn();
const assignRole = vi.fn();
vi.mock("@/lib/api", () => ({
  searchUsers: (...args: unknown[]) => searchUsers(...args),
  assignRole: (...args: unknown[]) => assignRole(...args),
}));

beforeEach(() => {
  searchUsers.mockReset();
  assignRole.mockReset().mockResolvedValue(undefined);
  signOut.mockReset().mockResolvedValue({ error: null });
  push.mockReset();
  useAuthMock.mockReset().mockReturnValue({
    session: { access_token: "tok" },
    role: "admin",
    loading: false,
    user: { id: "u1" },
    signOut,
  });
});

const USER = { id: "550e8400-e29b-41d4-a716-446655440000", email: "hazar@example.com", role: "USER" as const };

describe("RollerPage", () => {
  it("searches by email and lists matching users with their current role", async () => {
    searchUsers.mockResolvedValueOnce([USER]);
    render(<RollerPage />);

    fireEvent.change(screen.getByLabelText(/e-posta ara/i), { target: { value: "hazar" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));

    await waitFor(() => expect(screen.getByText("hazar@example.com")).toBeInTheDocument());
    expect(screen.getByText("USER")).toBeInTheDocument();
    expect(searchUsers).toHaveBeenCalledWith("tok", "hazar");
  });

  it("does not assign on the first click -- shows a confirm step first, since there is no revoke UI", async () => {
    searchUsers.mockResolvedValueOnce([USER]);
    render(<RollerPage />);
    fireEvent.change(screen.getByLabelText(/e-posta ara/i), { target: { value: "hazar" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));
    await waitFor(() => expect(screen.getByText("hazar@example.com")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /küratör yap/i }));
    expect(assignRole).not.toHaveBeenCalled();
    expect(screen.getByText(/emin misin/i)).toBeInTheDocument();
  });

  it("assigns curator role only after confirming, and refetches the search", async () => {
    searchUsers.mockResolvedValueOnce([USER]).mockResolvedValueOnce([{ ...USER, role: "CURATOR" }]);
    render(<RollerPage />);
    fireEvent.change(screen.getByLabelText(/e-posta ara/i), { target: { value: "hazar" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));
    await waitFor(() => expect(screen.getByText("hazar@example.com")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /küratör yap/i }));
    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));
    await waitFor(() => expect(assignRole).toHaveBeenCalledWith("tok", USER.id, "curator"));
    await waitFor(() => expect(screen.getByText("CURATOR")).toBeInTheDocument());
  });

  it("cancels the confirm step without assigning", async () => {
    searchUsers.mockResolvedValueOnce([USER]);
    render(<RollerPage />);
    fireEvent.change(screen.getByLabelText(/e-posta ara/i), { target: { value: "hazar" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));
    await waitFor(() => expect(screen.getByText("hazar@example.com")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /küratör yap/i }));
    fireEvent.click(screen.getByRole("button", { name: /vazgeç/i }));
    expect(assignRole).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /küratör yap/i })).toBeInTheDocument();
  });

  it("shows an empty state when the search returns no matches", async () => {
    searchUsers.mockResolvedValueOnce([]);
    render(<RollerPage />);
    fireEvent.change(screen.getByLabelText(/e-posta ara/i), { target: { value: "yok" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));
    await waitFor(() => expect(screen.getByText(/eşleşen kullanıcı bulunamadı/i)).toBeInTheDocument());
  });

  it("shows a permission message on 403", async () => {
    searchUsers.mockRejectedValueOnce(new ApiHttpError(403, "forbidden"));
    render(<RollerPage />);
    fireEvent.change(screen.getByLabelText(/e-posta ara/i), { target: { value: "hazar" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/yetkiniz yok/i));
  });

  it("shows an error when assignRole fails, without losing the visible list", async () => {
    searchUsers.mockResolvedValueOnce([USER]);
    assignRole.mockRejectedValueOnce(new ApiHttpError(409, "conflict"));
    render(<RollerPage />);
    fireEvent.change(screen.getByLabelText(/e-posta ara/i), { target: { value: "hazar" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));
    await waitFor(() => expect(screen.getByText("hazar@example.com")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /küratör yap/i }));
    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));
    // Turkish İ/i case-folding pitfall (docs/STATE.md): JS regex `/i` doesn't lowercase "İ" to
    // plain "i", so a pattern starting with "işlem" never matches "İşlem gerçekleştirilemedi" --
    // match a substring that avoids the capital İ instead.
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/gerçekleştirilemedi/i));
    expect(screen.getByText("hazar@example.com")).toBeInTheDocument();
  });

  it("does NOT report a failed assign when the role change itself succeeded but the follow-up refetch fails (Codex MAJOR finding)", async () => {
    searchUsers.mockResolvedValueOnce([USER]).mockRejectedValueOnce(new Error("network down"));
    assignRole.mockResolvedValueOnce(undefined);
    render(<RollerPage />);
    fireEvent.change(screen.getByLabelText(/e-posta ara/i), { target: { value: "hazar" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));
    await waitFor(() => expect(screen.getByText("hazar@example.com")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /küratör yap/i }));
    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    // Must NOT claim the assign itself failed -- it succeeded; only the list refresh did.
    expect(screen.queryByRole("alert")).not.toHaveTextContent(/gerçekleştirilemedi/i);
  });

  it("disables the Ara button when the search term is under 2 characters", () => {
    render(<RollerPage />);
    fireEvent.change(screen.getByLabelText(/e-posta ara/i), { target: { value: "h" } });
    expect(screen.getByRole("button", { name: /ara/i })).toBeDisabled();
  });

  it("discards a stale search response that resolves after a newer one (race guard)", async () => {
    let resolveFirst!: (v: unknown) => void;
    searchUsers
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce([{ ...USER, email: "second@example.com" }]);
    render(<RollerPage />);

    fireEvent.change(screen.getByLabelText(/e-posta ara/i), { target: { value: "first" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));
    fireEvent.change(screen.getByLabelText(/e-posta ara/i), { target: { value: "second" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));

    await waitFor(() => expect(screen.getByText("second@example.com")).toBeInTheDocument());
    resolveFirst([USER]); // the stale "first" response arrives late
    await Promise.resolve();
    expect(screen.getByText("second@example.com")).toBeInTheDocument();
    expect(screen.queryByText("hazar@example.com")).not.toBeInTheDocument();
  });
});
