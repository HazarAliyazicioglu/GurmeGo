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
