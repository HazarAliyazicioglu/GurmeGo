import { SafeAreaProvider } from "react-native-safe-area-context";
import RootNavigator from "./src/navigation/RootNavigator";
import { AuthProvider } from "./src/lib/auth-context";
import ErrorBoundary from "./src/components/ErrorBoundary";

// KNOWN LIMITATION (cross-model review, 2026-09-23): a single root-level boundary means a render
// error in any one tab unmounts the whole navigator + AuthProvider, not just that tab -- retry
// re-renders everything from scratch instead of just the broken screen. Acceptable for the "no
// blank screen" bar this closes; per-tab boundaries (isolating a crash to one tab) are a
// follow-up if a specific screen turns out to be crash-prone in practice.
export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
