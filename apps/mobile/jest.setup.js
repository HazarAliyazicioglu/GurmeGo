// Dummy values so every test in this package can import anything that transitively reads
// EXPO_PUBLIC_* env vars (supabase.ts, api.ts) without needing a real .env.local. Tests that care
// about a SPECIFIC value (like env.spec.ts above) override process.env directly and call
// jest.resetModules() first.
process.env.EXPO_PUBLIC_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3001/v1";
process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54421";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key";
