import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import FavoriteButton from "./FavoriteButton";
import { useAuth } from "../lib/auth-context";
import { getFavoriteLists, createFavoriteList, addFavoriteVenue } from "../lib/api";

jest.mock("../lib/auth-context", () => ({ useAuth: jest.fn() }));
jest.mock("../lib/api", () => ({
  getFavoriteLists: jest.fn(),
  createFavoriteList: jest.fn(),
  addFavoriteVenue: jest.fn(),
}));
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

describe("FavoriteButton", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    (getFavoriteLists as jest.Mock).mockReset();
    (createFavoriteList as jest.Mock).mockReset();
    (addFavoriteVenue as jest.Mock).mockReset();
  });

  it("navigates to Auth instead of favoriting when the user is signed out", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, session: null });

    await render(<FavoriteButton venueId="v1" />);
    await fireEvent.press(screen.getByText("Favorilere ekle"));

    expect(mockNavigate).toHaveBeenCalledWith("Auth");
    expect(getFavoriteLists).not.toHaveBeenCalled();
  });

  it("creates a default list and adds the venue when the signed-in user has no lists yet", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "u1" }, session: { access_token: "tok" } });
    (getFavoriteLists as jest.Mock).mockResolvedValueOnce([]); // initial "already favorited" check
    (getFavoriteLists as jest.Mock).mockResolvedValueOnce([]); // handleClick's own fetch
    (createFavoriteList as jest.Mock).mockResolvedValue({
      id: "list1",
      userId: "u1",
      name: "Favorilerim",
      createdAt: "2026-01-01T00:00:00.000Z",
      favorites: [],
    });
    (addFavoriteVenue as jest.Mock).mockResolvedValue(undefined);

    await render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByText("Favorilere ekle")).toBeTruthy());
    await fireEvent.press(screen.getByText("Favorilere ekle"));

    await waitFor(() => expect(addFavoriteVenue).toHaveBeenCalledWith("tok", "list1", "v1"));
    await waitFor(() => expect(screen.getByText("Favorilerde")).toBeTruthy());
  });
});
