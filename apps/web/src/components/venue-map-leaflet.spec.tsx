import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// `openPopupMock` is unused by this task's own test (Step 4 below only asserts on `center`) but is
// declared here, in the ONE shared vi.hoisted() block this whole file uses, because Task 12 (C14)
// appends to this exact block rather than re-declaring it -- keeping every hoisted mock in one
// place from the start avoids a second, conflicting vi.hoisted() call later.
const { getVenuesInBboxMock, openPopupMock } = vi.hoisted(() => ({
  getVenuesInBboxMock: vi.fn(),
  openPopupMock: vi.fn(),
}));

vi.mock("react-leaflet", () => {
  // A stable object identity is required here: BoundsVenueLoader's effect depends on the value
  // returned by `useMap()`, so a mock that returns a fresh object literal on every call would
  // change identity on every render and re-fire the effect forever (infinite render loop).
  const stableMap = {
    getBounds: () => ({ getWest: () => 0, getSouth: () => 0, getEast: () => 0, getNorth: () => 0 }),
  };
  return {
    MapContainer: ({ center, children }: { center: [number, number]; children: React.ReactNode }) => (
      <div data-testid="map-container" data-center={center.join(",")}>{children}</div>
    ),
    TileLayer: () => null,
    CircleMarker: ({ center, children, eventHandlers }: { center: [number, number]; children: React.ReactNode; eventHandlers?: { add?: (e: unknown) => void } }) => {
      const ref = (el: HTMLDivElement | null) => {
        if (el && eventHandlers?.add) eventHandlers.add({ target: { getElement: () => el, openPopup: openPopupMock } });
      };
      return <div ref={ref} data-testid="circle-marker" data-center={center.join(",")}>{children}</div>;
    },
    Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
    useMap: () => stableMap,
    useMapEvents: () => undefined,
  };
});
vi.mock("@/lib/api", () => ({ getVenuesInBbox: getVenuesInBboxMock }));

import { VenueMapCanvas } from "./venue-map-leaflet";

beforeEach(() => { getVenuesInBboxMock.mockReset().mockResolvedValue([]); openPopupMock.mockReset(); });

describe("VenueMapCanvas — center prop replaces the hardcoded KADIKOY_CENTER", () => {
  it("passes the given center prop through to the map container", () => {
    render(<VenueMapCanvas venues={[]} center={[40.9906, 29.0274]} />);
    expect(screen.getByTestId("map-container")).toHaveAttribute("data-center", "40.9906,29.0274");
  });
});
