import RootNavigator from "./src/navigation/RootNavigator";
import { AuthProvider } from "./src/lib/auth-context";

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
