// Dummy values so every test in this package can import anything that transitively reads
// EXPO_PUBLIC_* env vars (supabase.ts, api.ts) without needing a real .env.local. Tests that care
// about a SPECIFIC value (like env.spec.ts above) override process.env directly and call
// jest.resetModules() first.
process.env.EXPO_PUBLIC_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3001/v1";
process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54421";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key";
process.env.EXPO_PUBLIC_SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || "https://gurmego.com";

// The real native SafeAreaProvider renders its host component with NO children until a real
// device/simulator fires a native onInsetsChange event, which never happens under Jest -- it
// silently renders an empty `<RNCSafeAreaProvider />`, breaking the whole tree under it. The
// package's own `jest/mock.js` only sets a `default` export, which breaks every OTHER consumer's
// named-export interop (e.g. @react-navigation's SafeAreaProviderCompat) -- spread the real
// module's named exports instead and only override what actually needs jest-specific behavior.
// @sentry/react-native's real package ships ESM in a nested dependency (@sentry/core) that Jest's
// default transformIgnorePatterns (which excludes all of node_modules) can't parse -- any file
// that imports it transitively (e.g. App.tsx -> ErrorBoundary.tsx) fails with "Unexpected token
// 'export'" unless the module is mocked. Tests that assert on a specific call (sentry.spec.ts,
// ErrorBoundary.spec.tsx) declare their own more specific jest.mock() for this module, which
// overrides this default within that file.
jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return {
    ...actual,
    SafeAreaProvider: ({ children }) => children,
    useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
  };
});
