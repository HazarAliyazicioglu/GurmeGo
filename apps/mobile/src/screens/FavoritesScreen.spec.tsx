import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import FavoritesScreen from "./FavoritesScreen";
import { useAuth } from "../lib/auth-context";
import { getFavoriteLists, removeFavoriteVenue } from "../lib/api";

jest.mock("../lib/auth-context", () => ({ useAuth: jest.fn() }));
jest.mock("../lib/api", () => ({
  getFavoriteLists: jest.fn(),
  removeFavoriteVenue: jest.fn(),
}));
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  // Spreading the real module (not re-declaring useFocusEffect) keeps its actual implementation --
  // FavoritesScreen calls the real hook, which needs a real NavigationContainer ancestor at render
  // time (see renderScreen() below), not a mock.
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

function renderScreen() {
  return render(
    <NavigationContainer>
      <FavoritesScreen />
    </NavigationContainer>,
  );
}

const ONE_LIST = [
  {
    id: "list1", userId: "u1", name: "Favorilerim", createdAt: "2026-01-01T00:00:00.000Z",
    favorites: [
      { id: "f1", venueId: "v1", venue: { id: "v1", name: "Test Cafe", slug: "test-cafe", category: "cafe", priceRange: "MODERATE", isBoutique: true } },
    ],
  },
];

describe("FavoritesScreen", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    (getFavoriteLists as jest.Mock).mockReset();
    (removeFavoriteVenue as jest.Mock).mockReset();
  });

  it("prompts sign-in when the user is signed out, without calling the API", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, session: null });

    await renderScreen();

    expect(screen.getByText("Favorilerini görmek için giriş yap")).toBeTruthy();
    expect(getFavoriteLists).not.toHaveBeenCalled();
  });

  it("lists the signed-in user's favorited venues and navigates to detail on press", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "u1" }, session: { access_token: "tok" } });
    (getFavoriteLists as jest.Mock).mockResolvedValue(ONE_LIST);

    await renderScreen();

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy());
    await fireEvent.press(screen.getByText("Test Cafe"));
    expect(mockNavigate).toHaveBeenCalledWith("VenueDetail", { slug: "test-cafe" });
  });

  it("removes a venue from its list when its remove button is pressed", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "u1" }, session: { access_token: "tok" } });
    (getFavoriteLists as jest.Mock)
      .mockResolvedValueOnce(ONE_LIST)
      .mockResolvedValueOnce([{ ...ONE_LIST[0], favorites: [] }]); // refetch after removal
    (removeFavoriteVenue as jest.Mock).mockResolvedValue(undefined);

    await renderScreen();

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy());
    await fireEvent.press(screen.getByText("Kaldır"));

    await waitFor(() => expect(removeFavoriteVenue).toHaveBeenCalledWith("tok", "list1", "v1"));
    await waitFor(() => expect(screen.queryByText("Test Cafe")).toBeFalsy());
  });
});
