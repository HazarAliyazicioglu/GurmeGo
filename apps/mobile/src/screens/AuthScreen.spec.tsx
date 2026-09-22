import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import AuthScreen from "./AuthScreen";
import { useAuth } from "../lib/auth-context";

jest.mock("../lib/auth-context", () => ({ useAuth: jest.fn() }));

const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ goBack: mockGoBack }),
}));

// NOTE: this installed @testing-library/react-native version (14.0.1) made `render` and
// `fireEvent.*` async (they return Promises resolved via internal `act()` calls), unlike the
// synchronous API the brief's test snippet was written against. Every render/fireEvent call
// below is awaited so state updates flush before the next interaction/assertion runs — same
// underlying cause as the "not configured to support act(...)" warning called out as a known
// environment quirk, just triggered here by unawaited calls instead of unwrapped ones.

beforeEach(() => {
  mockGoBack.mockReset();
});

describe("AuthScreen", () => {
  // Denetim raporu §4.2 "Giriş yaptıktan sonra hiçbir şey olmuyor": a successful sign-in left the
  // user staring at the same form -- the screen is only ever reached by navigating TO it (e.g.
  // from a "favorilemek için giriş yap" prompt), so returning to whatever screen led here is the
  // correct behavior on success.
  it("navigates back after a successful sign-in", async () => {
    const signIn = jest.fn().mockResolvedValue({ error: null });
    (useAuth as jest.Mock).mockReturnValue({ signIn, signUp: jest.fn() });

    await render(<AuthScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("E-posta"), "test@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Şifre"), "sifre123");
    await fireEvent.press(screen.getByText("Giriş yap"));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it("does NOT navigate back when sign-in fails", async () => {
    const signIn = jest.fn().mockResolvedValue({ error: "Invalid credentials" });
    (useAuth as jest.Mock).mockReturnValue({ signIn, signUp: jest.fn() });

    await render(<AuthScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("E-posta"), "test@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Şifre"), "wrong");
    await fireEvent.press(screen.getByText("Giriş yap"));

    await waitFor(() => expect(screen.getByText("Invalid credentials")).toBeTruthy());
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  // Denetim raporu §4.2 "Kayıt sonrası e-posta onayı gerektiği söylenmiyor".
  it("shows an email-confirmation message after a successful sign-up, and does not navigate back (user isn't signed in yet)", async () => {
    const signUp = jest.fn().mockResolvedValue({ error: null });
    (useAuth as jest.Mock).mockReturnValue({ signIn: jest.fn(), signUp });

    await render(<AuthScreen />);
    await fireEvent.press(screen.getByText("Hesabın yok mu? Kayıt ol"));
    await fireEvent.changeText(screen.getByPlaceholderText("E-posta"), "new@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Şifre"), "yenisifre123");
    await fireEvent.press(screen.getByText("Kayıt ol"));

    await waitFor(() => expect(screen.getByText(/e-postanı onayla/i)).toBeTruthy());
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it("calls signIn with the typed email and password", async () => {
    const signIn = jest.fn().mockResolvedValue({ error: null });
    (useAuth as jest.Mock).mockReturnValue({ signIn, signUp: jest.fn() });

    await render(<AuthScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText("E-posta"), "test@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Şifre"), "sifre123");
    await fireEvent.press(screen.getByText("Giriş yap"));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith("test@example.com", "sifre123"));
  });

  it("shows the error message returned by signIn on failure", async () => {
    const signIn = jest.fn().mockResolvedValue({ error: "Invalid credentials" });
    (useAuth as jest.Mock).mockReturnValue({ signIn, signUp: jest.fn() });

    await render(<AuthScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText("E-posta"), "test@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Şifre"), "wrong");
    await fireEvent.press(screen.getByText("Giriş yap"));

    await waitFor(() => expect(screen.getByText("Invalid credentials")).toBeTruthy());
  });

  it("switches to register mode and calls signUp with the typed email and password", async () => {
    const signUp = jest.fn().mockResolvedValue({ error: null });
    (useAuth as jest.Mock).mockReturnValue({ signIn: jest.fn(), signUp });

    await render(<AuthScreen />);

    await fireEvent.press(screen.getByText("Hesabın yok mu? Kayıt ol"));
    await fireEvent.changeText(screen.getByPlaceholderText("E-posta"), "new@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Şifre"), "yenisifre123");
    await fireEvent.press(screen.getByText("Kayıt ol"));

    await waitFor(() => expect(signUp).toHaveBeenCalledWith("new@example.com", "yenisifre123"));
  });
});
