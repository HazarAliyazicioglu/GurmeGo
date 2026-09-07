// Expo inlines any env var prefixed EXPO_PUBLIC_ at build time (no extra config needed, SDK 49+).
// Fails fast at import time with a clear message rather than letting a missing value surface as
// a cryptic "Network request failed" deep inside a fetch call later.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required (set it in apps/mobile/.env.local, see .env.local.example)`);
  }
  return value;
}

export const API_BASE_URL = requireEnv("EXPO_PUBLIC_API_BASE_URL");
export const SUPABASE_URL = requireEnv("EXPO_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = requireEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY");
