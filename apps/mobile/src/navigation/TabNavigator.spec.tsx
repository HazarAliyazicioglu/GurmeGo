import { render, screen } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import TabNavigator from "./TabNavigator";

describe("TabNavigator", () => {
  it("shows the Discovery tab's content by default", async () => {
    await render(
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>,
    );
    expect(screen.getAllByText("Mekanlar").length).toBeGreaterThan(0);
    // React Navigation's bottom-tabs only mounts the currently-focused screen by default (lazy),
    // so FavoritesScreen's placeholder text being absent proves Discovery -- not Favoriler -- is
    // the focused tab. The "Mekanlar" assertion above only proves the tab bar renders the label,
    // which it does regardless of which tab is focused.
    expect(screen.queryByText("Favorilerim")).toBeNull();
  });
});
