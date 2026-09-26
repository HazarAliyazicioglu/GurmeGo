import { describe, it, expect } from "vitest";
import { translateAuthError } from "./auth-errors";

describe("translateAuthError", () => {
  it("translates known Supabase messages to Turkish", () => {
    expect(translateAuthError("Invalid login credentials")).toBe("E-posta veya şifre hatalı.");
    expect(translateAuthError("Email not confirmed")).toBe("E-postanı henüz doğrulamadın. Gelen kutundaki linke tıkla.");
  });

  it("matches case-insensitively and by rate-limit wording", () => {
    expect(translateAuthError("INVALID LOGIN CREDENTIALS")).toBe("E-posta veya şifre hatalı.");
    expect(translateAuthError("email rate limit exceeded")).toBe("Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.");
  });

  it("falls back to a generic Turkish message for unknown errors", () => {
    expect(translateAuthError("Something totally unexpected")).toBe("Bir sorun oluştu. Lütfen tekrar dene.");
  });
});
