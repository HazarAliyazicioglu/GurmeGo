import { render, waitFor } from "@testing-library/react-native";
import MapScreen from "./MapScreen";
import { getVenues, getVenuesInBbox } from "../lib/api";

jest.mock("../lib/api", () => ({
  getVenues: jest.fn(),
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
    (getVenues as jest.Mock).mockReset().mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });
    (getVenuesInBbox as jest.Mock).mockReset().mockResolvedValue([]);
  });

  it("fetches the unfiltered venues list (for slug lookup) and the initial viewport's map venues on mount", async () => {
    await render(<MapScreen />);

    await waitFor(() => expect(getVenues).toHaveBeenCalledWith({}));
    await waitFor(() => expect(getVenuesInBbox).toHaveBeenCalledTimes(1));
  });

  it("does not throw when getVenuesInBbox rejects", async () => {
    (getVenuesInBbox as jest.Mock).mockRejectedValue(new Error("network error"));

    await render(<MapScreen />);

    await waitFor(() => expect(getVenuesInBbox).toHaveBeenCalledTimes(1));
  });
});
