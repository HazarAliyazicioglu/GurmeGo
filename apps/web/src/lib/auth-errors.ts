// Supabase Auth returns English messages; users see Turkish. Matched by substring on the lowercased
// message because Supabase words some of these slightly differently across versions/endpoints.
const KNOWN: Array<[needle: string, message: string]> = [
  ["invalid login credentials", "E-posta veya şifre hatalı."],
  ["email not confirmed", "E-postanı henüz doğrulamadın. Gelen kutundaki linke tıkla."],
  ["user already registered", "Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene."],
  ["password should be at least", "Şifre en az 6 karakter olmalı."],
  ["rate limit", "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene."],
  ["same as the old password", "Yeni şifre eskisiyle aynı olamaz."],
  ["unable to validate email address", "Geçerli bir e-posta adresi gir."],
];

const FALLBACK = "Bir sorun oluştu. Lütfen tekrar dene.";

export function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  return KNOWN.find(([needle]) => lower.includes(needle))?.[1] ?? FALLBACK;
}
