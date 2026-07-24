import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth-context";

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

function Probe() {
  const { user, loading } = useAuth();
  return <div>{loading ? "loading" : user ? "signed-in" : "anonymous"}</div>;
}

function SignOutProbe() {
  const { signOut } = useAuth();
  const [result, setResult] = useState<string>("idle");
  return (
    <div>
      <span>{result}</span>
      <button
        onClick={async () => {
          const { error } = await signOut();
          setResult(error === null ? "no-error" : error);
        }}
      >
        sign out
      </button>
    </div>
  );
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

  it("signOut() returns { error: null } on success", async () => {
    render(
      <AuthProvider>
        <SignOutProbe />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByText("sign out"));
    await waitFor(() => expect(screen.getByText("no-error")).toBeInTheDocument());
  });
});
