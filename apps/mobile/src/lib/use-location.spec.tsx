import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import * as Location from "expo-location";
import { useLocation } from "./use-location";

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

function Probe() {
  const coords = useLocation();
  if (!coords) return <Text>no-coords</Text>;
  return <Text>{`${coords.lat},${coords.lng}`}</Text>;
}

describe("useLocation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns coords once permission is granted and a position is read", async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 40.99, longitude: 29.02 },
    });

    render(<Probe />);

    await waitFor(() => expect(screen.getByText("40.99,29.02")).toBeTruthy());
  });

  it("returns null (never throws) when permission is denied", async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied" });

    render(<Probe />);

    await waitFor(() => expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled());
    expect(screen.getByText("no-coords")).toBeTruthy();
  });
});
