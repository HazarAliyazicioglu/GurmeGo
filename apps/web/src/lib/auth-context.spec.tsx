import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth-context";

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

function Probe() {
  const { user, loading } = useAuth();
  return <div>{loading ? "loading" : user ? "signed-in" : "anonymous"}</div>;
}

describe("AuthProvider", () => {
  it("resolves to anonymous when there is no session", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
  });
});
