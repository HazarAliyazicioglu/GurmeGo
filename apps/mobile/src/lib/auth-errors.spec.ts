import { translateAuthError } from "./auth-errors";

describe("translateAuthError", () => {
  it("translates known Supabase messages to Turkish", () => {
    expect(translateAuthError("Invalid login credentials")).toBe("E-posta veya şifre hatalı.");
    expect(translateAuthError("Email not confirmed")).toBe("E-postanı henüz doğrulamadın. Gelen kutundaki linke tıkla.");
    expect(translateAuthError("User already registered")).toBe("Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.");
  });

  it("falls back to a generic Turkish message for unknown errors", () => {
    expect(translateAuthError("Something totally unexpected")).toBe("Bir sorun oluştu. Lütfen tekrar dene.");
  });
});
