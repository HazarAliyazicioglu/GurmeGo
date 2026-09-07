import { render, screen } from "@testing-library/react-native";
import App from "./App";

describe("App", () => {
  it("mounts the root navigator and shows the discovery screen", async () => {
    await render(<App />);
    expect(screen.getByText("Mekanlar")).toBeTruthy();
  });
});
