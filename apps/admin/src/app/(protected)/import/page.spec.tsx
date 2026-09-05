import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ApiHttpError } from "@gurmego/api-client";
import ImportPage from "./page";

const signOut = vi.fn().mockResolvedValue({ error: null });
// TASK 27 fix (Codex cross-model review of Task 26): was a fixed factory returning a static
// object. Made reconfigurable (same pattern as apps/web/src/app/favoriler/page.spec.tsx's
// `useAuthMock`) so a test can simulate the session/token changing mid-request via `rerender()`.
const useAuthMock = vi.fn();
vi.mock("@/lib/auth-context", () => ({ useAuth: () => useAuthMock() }));
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
  useAuthMock.mockReset().mockReturnValue({
    session: { access_token: "tok" },
    role: "curator",
    loading: false,
    user: { id: "u1" },
    signOut,
  });
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

  // TASK 27 fix (Codex cross-model review of Task 26, MAJOR): a stale upload's delayed 401
  // response used to trigger `signOut()` unconditionally, even if the curator's session/token had
  // already changed (a different curator signed in) before that response arrived -- incorrectly
  // signing out the NEW curator's session because of an error that belonged to the OLD one.
  it("does not sign out the new curator when a stale upload's delayed 401 arrives after the session token has already changed", async () => {
    let rejectUpload: (err: unknown) => void;
    importCsv.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectUpload = reject; }));
    const { rerender } = render(<ImportPage />);
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));
    await waitFor(() => expect(importCsv).toHaveBeenCalledWith("tok", expect.any(File)));

    // A different curator signs in before the stale upload's response arrives.
    useAuthMock.mockReturnValue({
      session: { access_token: "tok-2" },
      role: "curator",
      loading: false,
      user: { id: "u2" },
      signOut,
    });
    rerender(<ImportPage />);

    await act(async () => {
      rejectUpload!(new ApiHttpError(401, "unauthorized"));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(signOut).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalledWith("/giris");
  });

  // Second Codex cross-model review pass (Task 27): the first pass's fix only guarded the
  // error/401 path, not a stale request that resolves SUCCESSFULLY after the session changed --
  // that would have written the old session's upload summary onto the new curator's screen.
  it("does not show a stale upload's successful result once the session token has already changed", async () => {
    let resolveUpload: (value: unknown) => void;
    importCsv.mockReturnValueOnce(new Promise((resolve) => { resolveUpload = resolve; }));
    const { rerender } = render(<ImportPage />);
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));
    await waitFor(() => expect(importCsv).toHaveBeenCalledWith("tok", expect.any(File)));

    // A different curator signs in before the stale upload's response arrives.
    useAuthMock.mockReturnValue({
      session: { access_token: "tok-2" },
      role: "curator",
      loading: false,
      user: { id: "u2" },
      signOut,
    });
    rerender(<ImportPage />);

    await act(async () => {
      resolveUpload!({ created: 7, skipped: 0, errors: [] });
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.queryByTestId("import-result")).not.toBeInTheDocument();
  });

  // Second Codex cross-model review pass (Task 27): the first pass guarded the stale request's
  // `finally { setUploading(false) }` with the same requestToken check as the error path, but this
  // page has no other mechanism that resets `uploading` for the new session -- guarding it left
  // the upload button permanently disabled for the new curator until they somehow triggered their
  // own upload. There is at most one upload in flight at a time (the button is disabled while
  // `uploading`), so unlike the error/result paths above, unconditionally clearing `uploading` in
  // `finally` cannot clobber a second, genuinely-concurrent request -- it should not be guarded.
  it("re-enables the upload button for the new curator after a stale upload settles post session-change", async () => {
    let resolveUpload: (value: unknown) => void;
    importCsv.mockReturnValueOnce(new Promise((resolve) => { resolveUpload = resolve; }));
    const { rerender } = render(<ImportPage />);
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /yükle/i })).toBeDisabled());

    useAuthMock.mockReturnValue({
      session: { access_token: "tok-2" },
      role: "curator",
      loading: false,
      user: { id: "u2" },
      signOut,
    });
    rerender(<ImportPage />);

    await act(async () => {
      resolveUpload!({ created: 0, skipped: 0, errors: [] });
      await new Promise((r) => setTimeout(r, 0));
    });

    selectFile();
    expect(screen.getByRole("button", { name: /yükle/i })).not.toBeDisabled();
  });

  // Fourth Codex cross-model review pass (Task 27, MAJOR): identity change only updated
  // `currentTokenRef` -- `result`, `error`, and the selected `file` were never cleared, so a new
  // curator signing in (same component instance, no remount) could still see the PREVIOUS
  // curator's upload summary/error, and could accidentally submit the previous curator's selected
  // file under their own token.
  it("clears a previous curator's result, error, and selected file when the session identity changes", async () => {
    importCsv.mockResolvedValueOnce({ created: 3, skipped: 1, errors: [] });
    const { rerender } = render(<ImportPage />);
    const file = selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));
    await waitFor(() => expect(screen.getByText(/3.*oluşturuldu/i)).toBeInTheDocument());

    useAuthMock.mockReturnValue({
      session: { access_token: "tok-2" },
      role: "curator",
      loading: false,
      user: { id: "u2" },
      signOut,
    });
    rerender(<ImportPage />);

    expect(screen.queryByTestId("import-result")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yükle/i })).toBeDisabled(); // no file selected for the new curator
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));
    expect(importCsv).not.toHaveBeenCalledWith("tok-2", file);
  });

  // Eighth Codex cross-model review pass (Task 27, MAJOR): the previous guard compared
  // `requestToken` for the result-applying path, which meant a SAME curator's plain token refresh
  // mid-upload silently discarded a genuinely successful result -- the curator never saw their own
  // completed import. `identity` is the correct signal for "should this benign outcome still
  // apply"; a token refresh alone must not drop it.
  it("still shows a successful upload's result when only the SAME curator's token refreshed mid-upload (no identity change)", async () => {
    let resolveUpload: (value: unknown) => void;
    importCsv.mockReturnValueOnce(new Promise((resolve) => { resolveUpload = resolve; }));
    const { rerender } = render(<ImportPage />);
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));
    await waitFor(() => expect(importCsv).toHaveBeenCalledWith("tok", expect.any(File)));

    // SAME curator (u1), token silently refreshes.
    useAuthMock.mockReturnValue({
      session: { access_token: "tok-refreshed" },
      role: "curator",
      loading: false,
      user: { id: "u1" },
      signOut,
    });
    rerender(<ImportPage />);

    await act(async () => {
      resolveUpload!({ created: 5, skipped: 0, errors: [] });
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByText(/5.*oluşturuldu/i)).toBeInTheDocument();
  });

  // Same concern as above, applied to identity change unblocking `uploading` immediately: the new
  // curator must not have to wait for the OLD curator's (possibly slow or hung) request to settle.
  it("re-enables the upload button for a new curator IMMEDIATELY on identity change, without waiting for the previous curator's request to settle", async () => {
    importCsv.mockReturnValueOnce(new Promise(() => {})); // never settles in this test
    const { rerender } = render(<ImportPage />);
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /yükle/i })).toBeDisabled());

    useAuthMock.mockReturnValue({
      session: { access_token: "tok-2" },
      role: "curator",
      loading: false,
      user: { id: "u2" },
      signOut,
    });
    rerender(<ImportPage />);

    selectFile();
    expect(screen.getByRole("button", { name: /yükle/i })).not.toBeDisabled();
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
