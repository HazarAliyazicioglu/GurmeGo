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
