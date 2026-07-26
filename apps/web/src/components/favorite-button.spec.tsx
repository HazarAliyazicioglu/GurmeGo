import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FavoriteButton } from "./favorite-button";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "u1" }, session: { access_token: "tok" } }),
}));
const getFavoriteLists = vi.fn();
const createFavoriteList = vi.fn();
const addFavoriteVenue = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/api", () => ({
  getFavoriteLists: (...args: unknown[]) => getFavoriteLists(...args),
  createFavoriteList: (...args: unknown[]) => createFavoriteList(...args),
  addFavoriteVenue: (...args: unknown[]) => addFavoriteVenue(...args),
}));

describe("FavoriteButton", () => {
  beforeEach(() => {
    getFavoriteLists.mockReset();
    createFavoriteList.mockReset();
    addFavoriteVenue.mockReset().mockResolvedValue(undefined);
  });

  it("creates a default 'Favorilerim' list when the user has none, then adds the venue", async () => {
    getFavoriteLists.mockResolvedValue([]);
    createFavoriteList.mockResolvedValue({ id: "list1", name: "Favorilerim" });
    render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("favorite-button"));
    await waitFor(() => expect(createFavoriteList).toHaveBeenCalledWith("tok", "Favorilerim"));
    expect(addFavoriteVenue).toHaveBeenCalledWith("tok", "list1", "v1");
  });

  it("reuses the user's first existing list instead of creating a new one", async () => {
    getFavoriteLists.mockResolvedValue([{ id: "existing", name: "Denenecekler", favorites: [] }]);
    render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("favorite-button"));
    await waitFor(() => expect(addFavoriteVenue).toHaveBeenCalledWith("tok", "existing", "v1"));
    expect(createFavoriteList).not.toHaveBeenCalled();
  });
});

describe("FavoriteButton — real mount-time state check and disabled-while-pending", () => {
  beforeEach(() => {
    getFavoriteLists.mockReset();
    createFavoriteList.mockReset();
    addFavoriteVenue.mockReset().mockResolvedValue(undefined);
  });

  it("reflects the venue's real favorite status from GET /me/lists on mount (no click needed)", async () => {
    getFavoriteLists.mockResolvedValue([{
      id: "l1", userId: "u1", name: "Default", createdAt: "2026-01-01T00:00:00.000Z",
      favorites: [{ id: "f1", venueId: "v1", venue: { id: "v1", name: "X", slug: "x", category: "cafe", priceRange: "BUDGET", isBoutique: false } }],
    }]);
    render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByTestId("favorite-button")).toHaveAttribute("aria-pressed", "true"));
  });

  it("disables itself while the add flow (getFavoriteLists -> createFavoriteList/addFavoriteVenue) is in flight", async () => {
    getFavoriteLists.mockResolvedValue([{ id: "l1", userId: "u1", name: "Default", createdAt: "2026-01-01T00:00:00.000Z", favorites: [] }]);
    let resolveAdd: () => void;
    addFavoriteVenue.mockReturnValue(new Promise<void>((resolve) => { resolveAdd = resolve; }));
    render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled()); // mount-time check resolved
    fireEvent.click(screen.getByTestId("favorite-button"));
    expect(screen.getByTestId("favorite-button")).toBeDisabled();
    resolveAdd!();
    await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled());
  });
});
