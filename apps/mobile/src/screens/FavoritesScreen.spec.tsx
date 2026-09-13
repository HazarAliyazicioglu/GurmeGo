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
// Spreading react-native's module object (`{ ...actual, FlatList: ... }`) eagerly evaluates every
// one of its lazy-getter exports and crashes with an invariant violation deep in
// @react-native/virtualized-lists -- redefine only the one property instead.
jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  const { mockFlatList } = require("../../test-utils/mock-flat-list");
  Object.defineProperty(actual, "FlatList", { value: mockFlatList, configurable: true });
  return actual;
});

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

// FlatList is mocked (above) to render its items synchronously, avoiding react-native's real
// VirtualizedList setTimeout-based initial-cell-render deferral (root-caused in
// DiscoveryScreen.spec.tsx). The waitFor calls below still bump their timeout to 5000ms as a
// safety margin for the getFavoriteLists() promise resolution itself.
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

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy(), { timeout: 5000 });
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

    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeTruthy(), { timeout: 5000 });
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

    await waitFor(() => expect(screen.getByText("User B Cafe")).toBeTruthy(), { timeout: 5000 });
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
