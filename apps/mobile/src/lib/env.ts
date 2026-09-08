// Expo inlines any env var prefixed EXPO_PUBLIC_ at build time (no extra config needed, SDK 49+),
// but Metro's static analysis only recognizes a LITERAL member-access expression like
// `process.env.EXPO_PUBLIC_X` — it cannot see through a dynamic/bracket lookup like
// `process.env[name]`. So the lookup itself must happen at each call site (a literal expression
// per variable), and this helper only receives the already-resolved value to validate. Fails fast
// at import time with a clear message rather than letting a missing value surface as a cryptic
// "Network request failed" deep inside a fetch call later.
function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required (set it in apps/mobile/.env.local, see .env.local.example)`);
  }
  return value;
}

export const API_BASE_URL = requireEnv("EXPO_PUBLIC_API_BASE_URL", process.env.EXPO_PUBLIC_API_BASE_URL);
export const SUPABASE_URL = requireEnv("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = requireEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
