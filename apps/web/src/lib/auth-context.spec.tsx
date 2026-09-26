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
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
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

describe("AuthProvider — getSession() failure", () => {
  it("does not throw and settles loading to false when getSession() rejects", async () => {
    vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error("network down"));
    function Probe() {
      const { loading } = useAuth();
      return <div data-testid="loading-state">{String(loading)}</div>;
    }
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("loading-state")).toHaveTextContent("false"));
  });
});

function ActionsProbe() {
  const { signUp, signIn, requestPasswordReset, updatePassword } = useAuth();
  const [out, setOut] = useState("idle");
  return (
    <div>
      <span data-testid="out">{out}</span>
      <button onClick={async () => setOut(JSON.stringify(await signUp("a@b.com", "secret1")))}>signup</button>
      <button onClick={async () => setOut(JSON.stringify(await signIn("a@b.com", "bad")))}>signin</button>
      <button onClick={async () => setOut(JSON.stringify(await requestPasswordReset("a@b.com")))}>reset</button>
      <button onClick={async () => setOut(JSON.stringify(await updatePassword("newsecret")))}>update</button>
    </div>
  );
}

describe("AuthProvider — signUp confirmation, Turkish errors, password reset", () => {
  it("reports needsConfirmation when signUp returns a user but no session (email confirmation on)", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: { id: "u1" }, session: null }, error: null } as never);
    render(<AuthProvider><ActionsProbe /></AuthProvider>);
    fireEvent.click(screen.getByText("signup"));
    await waitFor(() => expect(screen.getByTestId("out")).toHaveTextContent('{"error":null,"needsConfirmation":true}'));
  });

  it("reports needsConfirmation false when signUp returns a live session", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: { id: "u1" }, session: { access_token: "t" } }, error: null } as never);
    render(<AuthProvider><ActionsProbe /></AuthProvider>);
    fireEvent.click(screen.getByText("signup"));
    await waitFor(() => expect(screen.getByTestId("out")).toHaveTextContent('{"error":null,"needsConfirmation":false}'));
  });

  it("translates a Supabase sign-in error to Turkish", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ data: {}, error: { message: "Invalid login credentials" } } as never);
    render(<AuthProvider><ActionsProbe /></AuthProvider>);
    fireEvent.click(screen.getByText("signin"));
    await waitFor(() => expect(screen.getByTestId("out")).toHaveTextContent("E-posta veya şifre hatalı."));
  });

  it("requestPasswordReset sends the recovery link back to /sifre-yenile on this origin", async () => {
    render(<AuthProvider><ActionsProbe /></AuthProvider>);
    fireEvent.click(screen.getByText("reset"));
    await waitFor(() =>
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("a@b.com", { redirectTo: `${window.location.origin}/sifre-yenile` }),
    );
  });

  it("updatePassword calls supabase.auth.updateUser with the new password", async () => {
    render(<AuthProvider><ActionsProbe /></AuthProvider>);
    fireEvent.click(screen.getByText("update"));
    await waitFor(() => expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "newsecret" }));
  });
});
