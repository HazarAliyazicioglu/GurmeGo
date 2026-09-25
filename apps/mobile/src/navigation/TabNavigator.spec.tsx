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

  // Denetim raporu (2026-09-25) "tabBarIcon yok": the tab bar had no icon definitions, showing
  // only text labels -- no visual affordance for which tab is which at a glance.
  it("renders an icon for each tab", async () => {
    await render(
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>,
    );
    expect(screen.getAllByTestId("tab-icon-Discovery").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("tab-icon-Favoriler").length).toBeGreaterThan(0);
  });
});
