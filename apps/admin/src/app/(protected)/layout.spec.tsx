import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  push.mockClear();
  vi.resetModules();
});

describe("ProtectedLayout", () => {
  it("redirects to /giris when unauthenticated", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({ user: null, role: null, loading: false }),
    }));
    const { default: Layout } = await import("./layout");
    render(<Layout><div>içerik</div></Layout>);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/giris"));
  });

  it("redirects to /erisim-yok when authenticated but not curator/admin", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({ user: { id: "u1" }, role: null, loading: false }),
    }));
    const { default: Layout } = await import("./layout");
    render(<Layout><div>içerik</div></Layout>);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/erisim-yok"));
  });

  it("renders children without redirecting when authenticated as curator", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({ user: { id: "u1" }, role: "curator", loading: false, signOut: vi.fn() }),
    }));
    const { default: Layout } = await import("./layout");
    const { findByText } = render(<Layout><div>içerik</div></Layout>);
    await findByText("içerik");
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a visible error state instead of redirecting when the auth session state is unknown (getSession() rejected)", async () => {
    // Without the fix, `error` wasn't consumed here at all: the effect would see `!user` (session
    // stayed null on failure) and redirect to /giris — masking a network error as "please log in
    // again" and potentially looping, since useAuth's own loading/error handling never resolves a
    // "definitely logged out" state. This must render a message instead and NOT redirect.
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({ user: null, role: null, loading: false, error: "Oturum bilgisi alınamadı." }),
    }));
    const { default: Layout } = await import("./layout");
    render(<Layout><div>içerik</div></Layout>);
    await waitFor(() => expect(screen.getByTestId("auth-error")).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });

  it("renders a sign-out control that calls signOut() when authenticated", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({ user: { id: "u1" }, role: "curator", loading: false, signOut }),
    }));
    const { default: Layout } = await import("./layout");
    render(<Layout><div>içerik</div></Layout>);
    fireEvent.click(await screen.findByRole("button", { name: /çıkış/i }));
    expect(signOut).toHaveBeenCalled();
  });
});
