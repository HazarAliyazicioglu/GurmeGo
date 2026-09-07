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
    expect(screen.getByText("Mekanlar")).toBeTruthy();
  });
});
