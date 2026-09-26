import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth-context";

function AuthProbe() {
  const { loading, error } = useAuth();
  if (loading) return <span>yükleniyor</span>;
  if (error) return <span data-testid="auth-error">{error}</span>;
  return <span data-testid="auth-ok">ok</span>;
}

// Minimal helper to build a syntactically-real (unsigned) JWT for tests — base64url header.payload.signature.
// `decodeRole` only ever reads the payload, so the header/signature contents don't matter here.
function fakeJwt(claims: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "none" })}.${b64url(claims)}.sig`;
}

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: fakeJwt({ user_role: "curator" }),
            user: { id: "u1" },
          },
        },
      }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

function RoleProbe() {
  const { role, loading } = useAuth();
  if (loading) return <span>yükleniyor</span>;
  return <span data-testid="role">{role ?? "yok"}</span>;
}

describe("useAuth role extraction", () => {
  it("decodes the role from the session JWT's user_role claim", async () => {
    // Supabase sessions carry custom claims via the access_token JWT's payload, set up through a
    // Supabase custom access token hook — Plan 1's JwtAuthMiddleware reads `user_role` from the
    // decoded JWT the same way (apps/api/src/auth/jwt-auth.middleware.ts). Decoding the
    // access_token payload directly here (not a metadata field) matches that same convention —
    // whether the real Supabase project's hook is actually configured is a separate, already-logged
    // risk (docs/STATE.md), not something this test can verify; this test only proves the decode
    // logic itself is correct given a token shaped the way the backend expects.
    render(<AuthProvider><RoleProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("role")).toHaveTextContent("curator"));
  });

  // Regression test for the casing blocker: the Prisma `UserRole` enum stores roles UPPERCASE
  // (confirmed by admin-users.service.ts's `assignRole` writing `role.toUpperCase()`), but
  // `decodeRole` here only recognized lowercase "curator"/"admin". A real Supabase custom access
  // token hook reading the DB's role verbatim would emit "CURATOR", which used to fall through to
  // `null` — silently locking curators/admins out of every role-gated admin page once that hook is
  // wired up. `decodeRole` must normalize casing before comparing.
  it("recognizes an uppercase user_role claim (matching the DB's UserRole enum casing) as the lowercase role", async () => {
    const { supabase } = await import("./supabase");
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: { access_token: fakeJwt({ user_role: "CURATOR" }), user: { id: "u1" } } },
    } as never);
    render(<AuthProvider><RoleProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("role")).toHaveTextContent("curator"));
  });

  it("returns null role when the JWT has no user_role claim", async () => {
    const { supabase } = await import("./supabase");
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: { access_token: fakeJwt({}), user: { id: "u1" } } },
    } as never);
    render(<AuthProvider><RoleProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("role")).toHaveTextContent("yok"));
  });
});

describe("AuthProvider value stability", () => {
  // Regression test for the MINOR review finding: AuthProvider used to build a brand-new `value`
  // object (and a brand-new `signOut` function) on every render, so any consumer with `signOut` (or
  // the whole context value) in a `useCallback`/`useMemo` dependency array — e.g. kuyruk/page.tsx's
  // `refetch` — got a new identity on every AuthProvider render, even ones where session/loading/error
  // didn't actually change. Wrapping `signOut`/`signIn` in `useCallback` and `value` in `useMemo` means
  // consumers only see a new reference when the underlying state genuinely changes.
  it("keeps the same signOut and context value reference across a re-render with unchanged auth state", async () => {
    const seen: Array<{ value: unknown; signOut: unknown }> = [];
    function Capture() {
      const ctx = useAuth();
      if (!ctx.loading) seen.push({ value: ctx, signOut: ctx.signOut });
      return ctx.loading ? <span>yükleniyor</span> : <span data-testid="auth-ok">ok</span>;
    }

    const { rerender } = render(<AuthProvider><Capture /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("auth-ok")).toBeInTheDocument());

    // Force AuthProvider itself to re-render (React re-invokes the component function) without any
    // underlying session/loading/error state change.
    rerender(<AuthProvider><Capture /></AuthProvider>);
    await waitFor(() => expect(seen.length).toBeGreaterThanOrEqual(2));

    const [first, second] = seen;
    expect(second.signOut).toBe(first.signOut);
    expect(second.value).toBe(first.value);
  });
});

describe("useAuth getSession() rejection", () => {
  it("resolves loading to false and sets a terminal error instead of hanging forever when getSession() rejects", async () => {
    // Without the fix, a rejected getSession() (network error, Supabase down, ...) never calls
    // setLoading(false) — loading stays true forever, so every protected page stays blank.
    const { supabase } = await import("./supabase");
    vi.mocked(supabase.auth.getSession).mockRejectedValueOnce(new Error("network error"));

    render(<AuthProvider><AuthProbe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId("auth-error")).toBeInTheDocument());
    expect(screen.queryByText("yükleniyor")).not.toBeInTheDocument();
  });
});

function ActionsProbe() {
  const { signIn, requestPasswordReset, updatePassword } = useAuth();
  const [out, setOut] = useState("idle");
  return (
    <>
      <span data-testid="out">{out}</span>
      <button onClick={async () => setOut(JSON.stringify(await signIn("a@b.com", "bad")))}>signin</button>
      <button onClick={async () => setOut(JSON.stringify(await requestPasswordReset("a@b.com")))}>reset</button>
      <button onClick={async () => setOut(JSON.stringify(await updatePassword("newsecret")))}>update</button>
    </>
  );
}

describe("useAuth — Turkish errors and password reset", () => {
  it("translates a sign-in error to Turkish", async () => {
    const { supabase } = await import("./supabase");
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ data: {}, error: { message: "Invalid login credentials" } } as never);
    render(<AuthProvider><ActionsProbe /></AuthProvider>);
    screen.getByText("signin").click();
    await waitFor(() => expect(screen.getByTestId("out")).toHaveTextContent("E-posta veya şifre hatalı."));
  });

  it("requestPasswordReset redirects to this app's own /sifre-yenile", async () => {
    const { supabase } = await import("./supabase");
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ error: null } as never);
    render(<AuthProvider><ActionsProbe /></AuthProvider>);
    screen.getByText("reset").click();
    await waitFor(() =>
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("a@b.com", { redirectTo: `${window.location.origin}/sifre-yenile` }),
    );
  });

  it("updatePassword calls supabase.auth.updateUser", async () => {
    const { supabase } = await import("./supabase");
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({ error: null } as never);
    render(<AuthProvider><ActionsProbe /></AuthProvider>);
    screen.getByText("update").click();
    await waitFor(() => expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "newsecret" }));
  });
});
