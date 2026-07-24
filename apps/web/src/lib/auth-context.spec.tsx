import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { AuthProvider, useAuth } from "./auth-context";
import { supabase } from "./supabase";

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

function SessionIdProbe() {
  const { user, loading } = useAuth();
  return <div>{loading ? "loading" : `user:${user?.id ?? "none"}`}</div>;
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

  it("keeps the onAuthStateChange session when it fires before the stale getSession() resolves", async () => {
    const freshSession = { user: { id: "fresh-user" } } as unknown as Session;
    const staleSession = { user: { id: "stale-user" } } as unknown as Session;

    // getSession() resolves asynchronously (after a macrotask) with a STALE session,
    // simulating it losing the race to onAuthStateChange.
    vi.mocked(supabase.auth.getSession).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ data: { session: staleSession } } as never), 0);
        }) as never,
    );

    // onAuthStateChange invokes its callback SYNCHRONOUSLY, before returning,
    // with a fresher session — simulating it winning the race.
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementationOnce((callback) => {
      callback("SIGNED_IN", freshSession);
      return { data: { subscription: { unsubscribe: vi.fn() } } } as never;
    });

    render(
      <AuthProvider>
        <SessionIdProbe />
      </AuthProvider>,
    );

    // Wait for the stale getSession() promise to resolve too, then assert the
    // fresh onAuthStateChange session was not overwritten by it.
    await waitFor(() => expect(screen.getByText("user:fresh-user")).toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(screen.getByText("user:fresh-user")).toBeInTheDocument();
  });
});
