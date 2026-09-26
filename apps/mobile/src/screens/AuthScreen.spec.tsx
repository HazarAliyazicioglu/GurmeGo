import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
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

  // Denetim raporu (2026-09-25) "double-submit guard yok": without an in-flight guard, a second
  // tap before the first request resolves fires signIn twice (e.g. duplicate sessions/rate-limit
  // hits on a slow connection where the user taps again thinking the first tap didn't register).
  // Kept last in the file: it deliberately leaves a press in flight while a second one fires.
  it("ignores a second submit press while the first sign-in request is still in flight", async () => {
    let resolveSignIn!: (value: { error: string | null }) => void;
    const signIn = jest.fn().mockReturnValue(new Promise((resolve) => (resolveSignIn = resolve)));
    (useAuth as jest.Mock).mockReturnValue({ signIn, signUp: jest.fn() });

    await render(<AuthScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("E-posta"), "test@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Şifre"), "sifre123");
    // Both presses dispatch inside ONE act() scope instead of two separate act()-wrapped
    // `fireEvent.press` calls -- calling fireEvent.press twice without awaiting between them
    // opens two overlapping act() scopes (React warns "overlapping act() calls"), since each
    // call's internal act() is still pending when the next one starts. Nesting inside a single
    // outer act() avoids that while still landing the second press before the first's
    // `signIn` promise resolves.
    await act(async () => {
      fireEvent.press(screen.getByText("Giriş yap"));
      fireEvent.press(screen.getByText("Giriş yap"));
    });

    resolveSignIn({ error: null });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(signIn).toHaveBeenCalledTimes(1);
  });
});

describe("AuthScreen — şifremi unuttum", () => {
  it("shows a 'Şifremi unuttum' link only in sign-in mode", async () => {
    (useAuth as jest.Mock).mockReturnValue({ signIn: jest.fn(), signUp: jest.fn(), requestPasswordReset: jest.fn() });
    await render(<AuthScreen />);
    expect(screen.getByText("Şifremi unuttum")).toBeTruthy();
    await fireEvent.press(screen.getByText("Hesabın yok mu? Kayıt ol"));
    expect(screen.queryByText("Şifremi unuttum")).toBeNull();
  });

  it("sends the reset e-mail and shows a confirmation naming the address", async () => {
    const requestPasswordReset = jest.fn().mockResolvedValue({ error: null });
    (useAuth as jest.Mock).mockReturnValue({ signIn: jest.fn(), signUp: jest.fn(), requestPasswordReset });
    await render(<AuthScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("E-posta"), "me@x.com");
    await fireEvent.press(screen.getByText("Şifremi unuttum"));
    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledWith("me@x.com"));
    expect(await screen.findByText(/me@x.com/)).toBeTruthy();
  });
});
