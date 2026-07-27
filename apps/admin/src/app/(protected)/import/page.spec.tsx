import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApiHttpError } from "@gurmego/api-client";
import ImportPage from "./page";

const signOut = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ session: { access_token: "tok" }, role: "curator", loading: false, user: { id: "u1" }, signOut }),
}));
const push = vi.fn();
const routerMock = { push };
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
const importCsv = vi.fn();
vi.mock("@/lib/api", () => ({ importCsv: (...args: unknown[]) => importCsv(...args) }));

function selectFile() {
  const file = new File(["name,slug\nTest,test"], "venues.csv", { type: "text/csv" });
  fireEvent.change(screen.getByLabelText(/csv dosyası/i), { target: { files: [file] } });
  return file;
}

beforeEach(() => {
  importCsv.mockReset();
  signOut.mockReset().mockResolvedValue({ error: null });
  push.mockReset();
});

describe("ImportPage", () => {
  it("uploads a file and shows the created/skipped/error summary", async () => {
    importCsv.mockResolvedValue({ created: 2, skipped: 1, errors: [{ row: 4, message: "priceRange geçersiz" }] });
    render(<ImportPage />);
    const file = selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));

    await waitFor(() => expect(importCsv).toHaveBeenCalledWith("tok", file));
    await waitFor(() => expect(screen.getByText(/2.*oluşturuldu/i)).toBeInTheDocument());
    expect(screen.getByText(/priceRange geçersiz/i)).toBeInTheDocument();
  });

  it("shows an error message and re-enables the upload button when the request fails (network error or HTTP failure)", async () => {
    importCsv.mockRejectedValue(new Error("Import failed: 500"));
    render(<ImportPage />);
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/yükleme başarısız/i));
    expect(screen.getByRole("button", { name: /yükle/i })).not.toBeDisabled();
  });

  it("clears a stale success summary when a subsequent upload fails", async () => {
    importCsv.mockResolvedValueOnce({ created: 2, skipped: 0, errors: [] });
    render(<ImportPage />);
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));

    await waitFor(() => expect(screen.getByText(/2.*oluşturuldu/i)).toBeInTheDocument());

    importCsv.mockRejectedValueOnce(new Error("Import failed: 500"));
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/yükleme başarısız/i));
    expect(screen.queryByText(/2.*oluşturuldu/i)).not.toBeInTheDocument();
  });

  it("disables the upload button while a request is in flight", async () => {
    let resolveImport: (value: unknown) => void = () => {};
    importCsv.mockReturnValue(new Promise((resolve) => { resolveImport = resolve; }));
    render(<ImportPage />);
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /yükle/i })).toBeDisabled());
    resolveImport({ created: 0, skipped: 0, errors: [] });
    await waitFor(() => expect(screen.getByRole("button", { name: /yükle/i })).not.toBeDisabled());
  });

  it("signs out and redirects to login (instead of a generic upload-failed message) when importCsv rejects with a 401", async () => {
    importCsv.mockRejectedValue(new ApiHttpError(401, "unauthorized"));
    render(<ImportPage />);
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/giris"));
    expect(signOut).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a distinct permission-denied message (not the generic upload-failed message) when importCsv rejects with a 403", async () => {
    importCsv.mockRejectedValue(new ApiHttpError(403, "forbidden"));
    render(<ImportPage />);
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/yetkiniz yok/i));
    expect(push).not.toHaveBeenCalled();
  });

  // MAJOR 4 fix (final whole-branch review): the 401 sign-out path used to call `signOut()`
  // without awaiting or checking its result. These prove the fixed await + `{ error }`-check
  // pattern (matching (protected)/layout.tsx and erisim-yok/page.tsx): an error-resolved or
  // rejected signOut during a 401 flow shows an error instead of silently redirecting anyway.
  it("shows an error and does NOT redirect when signOut() resolves with an error during the 401 flow", async () => {
    importCsv.mockRejectedValue(new ApiHttpError(401, "unauthorized"));
    signOut.mockResolvedValueOnce({ error: "boom" });
    render(<ImportPage />);
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));

    await waitFor(() => expect(signOut).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/çıkış yapılamadı/i));
    expect(push).not.toHaveBeenCalledWith("/giris");
  });

  it("shows an error and does not produce an unhandled rejection when signOut() itself rejects during the 401 flow", async () => {
    importCsv.mockRejectedValue(new ApiHttpError(401, "unauthorized"));
    signOut.mockRejectedValueOnce(new Error("network down"));
    render(<ImportPage />);
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));

    await waitFor(() => expect(signOut).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/çıkış yapılamadı/i));
    expect(push).not.toHaveBeenCalledWith("/giris");
  });

  it("still shows the generic upload-failed message (not the 403 permission message) on a plain/500 error", async () => {
    importCsv.mockRejectedValue(new Error("Import failed: 500"));
    render(<ImportPage />);
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/yükleme başarısız/i));
    expect(screen.queryByRole("alert")).not.toHaveTextContent(/yetkiniz yok/i);
  });
});
