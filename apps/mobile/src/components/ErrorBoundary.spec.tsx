import { Text } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import ErrorBoundary from "./ErrorBoundary";

function Bomb(): React.ReactElement {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  // React logs the caught error to the console by default -- expected here, silence it so the
  // test output doesn't look like a real failure.
  let consoleErrorSpy: jest.SpyInstance;
  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders children normally when nothing throws", async () => {
    await render(
      <ErrorBoundary>
        <Text>hayatta</Text>
      </ErrorBoundary>,
    );
    expect(screen.getByText("hayatta")).toBeTruthy();
  });

  it("renders a fallback instead of crashing when a child throws during render", async () => {
    await render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Bir şeyler ters gitti")).toBeTruthy();
    expect(screen.queryByText("hayatta")).toBeNull();
  });

  it("lets the user retry, re-rendering children fresh after a tap", async () => {
    let shouldThrow = true;
    function MaybeBomb() {
      if (shouldThrow) throw new Error("boom");
      return <Text>hayatta</Text>;
    }
    await render(
      <ErrorBoundary>
        <MaybeBomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Bir şeyler ters gitti")).toBeTruthy();

    shouldThrow = false;
    await fireEvent.press(screen.getByText("Tekrar dene"));

    expect(screen.getByText("hayatta")).toBeTruthy();
  });

  it("shows the fallback again (not a crash) if the underlying cause is still there on retry", async () => {
    await render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Bir şeyler ters gitti")).toBeTruthy();

    // Bomb always throws -- retrying doesn't fix the root cause. This must land back on the
    // fallback, not crash the test (which would mean the retry path re-threw uncaught).
    await fireEvent.press(screen.getByText("Tekrar dene"));

    expect(screen.getByText("Bir şeyler ters gitti")).toBeTruthy();
  });
});
