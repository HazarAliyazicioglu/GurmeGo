import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth-context";

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

  it("returns null role when the JWT has no user_role claim", async () => {
    const { supabase } = await import("./supabase");
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: { access_token: fakeJwt({}), user: { id: "u1" } } },
    } as never);
    render(<AuthProvider><RoleProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("role")).toHaveTextContent("yok"));
  });
});
