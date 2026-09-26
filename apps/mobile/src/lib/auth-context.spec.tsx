import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { AuthProvider, useAuth } from "./auth-context";
import { supabase } from "./supabase";

jest.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
    },
  },
}));

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <Text>loading</Text>;
  return <Text>{user ? `signed-in:${user.id}` : "signed-out"}</Text>;
}

describe("AuthProvider", () => {
  it("exposes the current session's user once getSession resolves", async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { access_token: "tok", user: { id: "u1" } } },
    });

    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("signed-in:u1")).toBeTruthy());
  });
});

function ActionsProbe() {
  const { signIn, requestPasswordReset } = useAuth();
  const [out, setOut] = useState("idle");
  return (
    <>
      <Text testID="out">{out}</Text>
      <Text testID="signin" onPress={async () => setOut(JSON.stringify(await signIn("a@b.com", "bad")))}>
        signin
      </Text>
      <Text testID="reset" onPress={async () => setOut(JSON.stringify(await requestPasswordReset("a@b.com")))}>
        reset
      </Text>
    </>
  );
}

describe("AuthProvider — Turkish errors and password reset", () => {
  it("translates a sign-in error to Turkish", async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const { getByTestId } = await render(<AuthProvider><ActionsProbe /></AuthProvider>);
    getByTestId("signin").props.onPress();
    await waitFor(() => expect(getByTestId("out").props.children).toBe(JSON.stringify({ error: "E-posta veya şifre hatalı." })));
  });

  it("requestPasswordReset calls supabase.auth.resetPasswordForEmail", async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });
    (supabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({ error: null });
    const { getByTestId } = await render(<AuthProvider><ActionsProbe /></AuthProvider>);
    getByTestId("reset").props.onPress();
    await waitFor(() => expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("a@b.com"));
  });
});
