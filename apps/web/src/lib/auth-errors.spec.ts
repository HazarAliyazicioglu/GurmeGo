import { describe, it, expect } from "vitest";
import { translateAuthError } from "./auth-errors";

describe("translateAuthError", () => {
  it("translates the known Supabase messages", () => {
    expect(translateAuthError("Invalid login credentials")).toBe("E-posta veya şifre hatalı.");
    expect(translateAuthError("Email not confirmed")).toBe("E-postanı henüz doğrulamadın. Gelen kutundaki linke tıkla.");
    expect(translateAuthError("User already registered")).toBe("Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.");
    expect(translateAuthError("Password should be at least 6 characters.")).toBe("Şifre en az 6 karakter olmalı.");
  });

  it("matches case-insensitively and by rate-limit wording", () => {
    expect(translateAuthError("INVALID LOGIN CREDENTIALS")).toBe("E-posta veya şifre hatalı.");
    expect(translateAuthError("email rate limit exceeded")).toBe("Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.");
  });

  it("falls back to a generic Turkish message instead of leaking raw English text", () => {
    expect(translateAuthError("Something totally unexpected")).toBe("Bir sorun oluştu. Lütfen tekrar dene.");
  });
});
