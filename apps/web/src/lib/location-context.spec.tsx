import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocationProvider, useLocationContext } from "./location-context";

function Consumer({ testId }: { testId: string }) {
  const coords = useLocationContext();
  return <div data-testid={testId}>{coords ? `${coords.lat},${coords.lng}` : "none"}</div>;
}

describe("LocationProvider — single shared useGeolocation call", () => {
  it("calls the browser geolocation API exactly once total; both consumers read the same resolved value", () => {
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition: vi.fn() },
      configurable: true,
    });
    const getCurrentPositionSpy = vi.spyOn(navigator.geolocation, "getCurrentPosition").mockImplementation((success) => {
      success({ coords: { latitude: 40.99, longitude: 29.02 } } as GeolocationPosition);
    });
    render(
      <LocationProvider>
        <Consumer testId="a" />
        <Consumer testId="b" />
      </LocationProvider>,
    );
    expect(getCurrentPositionSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("a")).toHaveTextContent("40.99,29.02");
    expect(screen.getByTestId("b")).toHaveTextContent("40.99,29.02");
  });
});
