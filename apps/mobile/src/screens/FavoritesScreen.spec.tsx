import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
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

const mockSignOut = jest.fn();

describe("FavoritesScreen", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSignOut.mockReset().mockResolvedValue({ error: null });
    (getFavoriteLists as jest.Mock).mockReset();
    (removeFavoriteVenue as jest.Mock).mockReset();
  });

  it("prompts sign-in when the user is signed out, without calling the API", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, session: null, signOut: mockSignOut });

    await renderScreen();

    expect(screen.getByText("Favorilerini görmek için giriş yap")).toBeTruthy();
    expect(getFavoriteLists).not.toHaveBeenCalled();
  });

  it("navigates to Auth when the sign-in button is pressed while signed out", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, session: null, signOut: mockSignOut });

    await renderScreen();
    await fireEvent.press(screen.getByText("Giriş yap"));

    expect(mockNavigate).toHaveBeenCalledWith("Auth");
  });

  it("shows the signed-in user's email and a sign-out button above the favorites list", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "u1", email: "gurme@example.com" },
      session: { access_token: "tok" },
      signOut: mockSignOut,
    });
    (getFavoriteLists as jest.Mock).mockResolvedValue([]);

    await renderScreen();

    await waitFor(() => expect(screen.getByText("gurme@example.com")).toBeTruthy());
    await fireEvent.press(screen.getByText("Çıkış yap"));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("shows an error message when sign-out fails", async () => {
    mockSignOut.mockResolvedValue({ error: "Network error" });
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "u1", email: "gurme@example.com" },
      session: { access_token: "tok" },
      signOut: mockSignOut,
    });
    (getFavoriteLists as jest.Mock).mockResolvedValue([]);

    await renderScreen();

    await waitFor(() => expect(screen.getByText("gurme@example.com")).toBeTruthy());
    await fireEvent.press(screen.getByText("Çıkış yap"));

    await waitFor(() => expect(screen.getByText("Network error")).toBeTruthy());
  });

  it("lists the signed-in user's favorited venues and navigates to detail on press", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "u1" }, session: { access_token: "tok" }, signOut: mockSignOut });
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

  it("does not apply a stale user's favorites after a session/user switch happens before the slow request resolves", async () => {
    let resolveA: (v: unknown) => void;
    const pendingA = new Promise((resolve) => {
      resolveA = resolve;
    });
    const listB = [
      {
        id: "list2", userId: "u2", name: "Favorilerim", createdAt: "2026-01-01T00:00:00.000Z",
        favorites: [
          { id: "f2", venueId: "v2", venue: { id: "v2", name: "User B Cafe", slug: "user-b-cafe", category: "cafe", priceRange: "MODERATE", isBoutique: true } },
        ],
      },
    ];

    (getFavoriteLists as jest.Mock)
      .mockReturnValueOnce(pendingA) // user A's slow initial fetch
      .mockResolvedValueOnce(listB); // user B's fetch after switch

    (useAuth as jest.Mock).mockReturnValue({ user: { id: "u1" }, session: { access_token: "tok-a" } });

    const { rerender } = await render(
      <NavigationContainer>
        <FavoritesScreen />
      </NavigationContainer>,
    );

    // Simulate a fast account switch: session changes to user B's token before A's request resolves.
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "u2" }, session: { access_token: "tok-b" } });
    await rerender(
      <NavigationContainer>
        <FavoritesScreen />
      </NavigationContainer>,
    );

    await waitFor(() => expect(screen.getByText("User B Cafe")).toBeTruthy());
    await waitFor(() => expect(getFavoriteLists).toHaveBeenCalledTimes(2));

    // Now resolve the stale user A request -- it must NOT clobber the screen with A's data.
    // Wrapped in act + awaited so the (buggy) setFavorites call, if it happens, is fully flushed
    // into the rendered tree before we assert -- otherwise a false negative is possible if the
    // assertion runs before the promise's .then() has had a chance to run.
    await act(async () => {
      resolveA(ONE_LIST);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText("Test Cafe")).toBeFalsy();
    expect(screen.getByText("User B Cafe")).toBeTruthy();
  });
});
