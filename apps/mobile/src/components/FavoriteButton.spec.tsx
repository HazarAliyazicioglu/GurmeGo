import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import FavoriteButton from "./FavoriteButton";
import { useAuth } from "../lib/auth-context";
import { getFavoriteLists, createFavoriteList, addFavoriteVenue, removeFavoriteVenue } from "../lib/api";

jest.mock("../lib/auth-context", () => ({ useAuth: jest.fn() }));
jest.mock("../lib/api", () => ({
  getFavoriteLists: jest.fn(),
  createFavoriteList: jest.fn(),
  addFavoriteVenue: jest.fn(),
  removeFavoriteVenue: jest.fn(),
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
    (removeFavoriteVenue as jest.Mock).mockReset();
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

  it("removes the venue from every list containing it when pressed while already favorited", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "u1" }, session: { access_token: "tok" } });
    const favorited = [
      { id: "l1", userId: "u1", name: "L1", createdAt: "2026-01-01T00:00:00.000Z", favorites: [{ id: "f1", venueId: "v1", venue: {} as never }] },
      { id: "l2", userId: "u1", name: "L2", createdAt: "2026-01-01T00:00:00.000Z", favorites: [{ id: "f2", venueId: "v1", venue: {} as never }] },
    ];
    (getFavoriteLists as jest.Mock).mockResolvedValue(favorited);
    (removeFavoriteVenue as jest.Mock).mockResolvedValue(undefined);

    await render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByText("Favorilerde")).toBeTruthy());
    await fireEvent.press(screen.getByText("Favorilerde"));

    await waitFor(() => expect(screen.getByText("Favorilere ekle")).toBeTruthy());
    expect(removeFavoriteVenue).toHaveBeenCalledWith("tok", "l1", "v1");
    expect(removeFavoriteVenue).toHaveBeenCalledWith("tok", "l2", "v1");
  });

  it("shows an error message and keeps the previous state when adding fails", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "u1" }, session: { access_token: "tok" } });
    (getFavoriteLists as jest.Mock).mockResolvedValue([]);
    (createFavoriteList as jest.Mock).mockRejectedValue(new Error("boom"));

    await render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByText("Favorilere ekle")).toBeTruthy());
    await fireEvent.press(screen.getByText("Favorilere ekle"));

    await waitFor(() => expect(screen.getByText("Favorilere eklenemedi. Tekrar dene.")).toBeTruthy());
    expect(screen.getByText("Favorilere ekle")).toBeTruthy();
  });
});
