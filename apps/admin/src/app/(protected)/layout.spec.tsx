import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

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
      useAuth: () => ({ user: { id: "u1" }, role: "curator", loading: false }),
    }));
    const { default: Layout } = await import("./layout");
    const { findByText } = render(<Layout><div>içerik</div></Layout>);
    await findByText("içerik");
    expect(push).not.toHaveBeenCalled();
  });
});
