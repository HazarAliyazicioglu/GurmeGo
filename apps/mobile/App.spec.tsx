import { render, screen } from "@testing-library/react-native";
import App from "./App";

describe("App", () => {
  it("mounts the root navigator and shows the discovery screen", async () => {
    await render(<App />);
    expect(screen.getAllByText("Mekanlar").length).toBeGreaterThan(0);
    // React Navigation's bottom-tabs only mounts the currently-focused screen by default (lazy),
    // so FavoritesScreen's placeholder text being absent proves Discovery -- not Favoriler -- is
    // the focused tab. The "Mekanlar" assertion above only proves the tab bar renders the label,
    // which it does regardless of which tab is focused.
    expect(screen.queryByText("Favorilerim")).toBeNull();
  });
});

// §M1 audit finding: tab screens hide their native header (TabNavigator.tsx), so nothing
// accounted for the status bar/notch area. App.tsx now wraps everything in SafeAreaProvider so
// DiscoveryScreen/FavoritesScreen's useSafeAreaInsets() calls (tested directly in each screen's
// own spec, where the hook is mocked to a non-zero value) read real device insets in production
// instead of always getting zero. Not independently tested here: without a real device/simulator
// there is no meaningful assertion at the App level beyond "still renders", which the test above
// already covers.
