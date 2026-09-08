import { render, waitFor } from "@testing-library/react-native";
import MapScreen from "./MapScreen";
import { getAllVenues, getVenuesInBbox } from "../lib/api";

jest.mock("../lib/api", () => ({
  getAllVenues: jest.fn(),
  getVenuesInBbox: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

describe("MapScreen", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    (getAllVenues as jest.Mock).mockReset().mockResolvedValue([]);
    (getVenuesInBbox as jest.Mock).mockReset().mockResolvedValue([]);
  });

  it("fetches the full (paginated) venues list (for slug lookup) and the initial viewport's map venues on mount", async () => {
    await render(<MapScreen />);

    await waitFor(() => expect(getAllVenues).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getVenuesInBbox).toHaveBeenCalledTimes(1));
  });

  it("does not throw when getVenuesInBbox rejects", async () => {
    (getVenuesInBbox as jest.Mock).mockRejectedValue(new Error("network error"));

    await render(<MapScreen />);

    await waitFor(() => expect(getVenuesInBbox).toHaveBeenCalledTimes(1));
  });
});
