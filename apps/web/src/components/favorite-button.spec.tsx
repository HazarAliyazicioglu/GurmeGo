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
    fireEvent.click(screen.getByTestId("favorite-button"));
    await waitFor(() => expect(createFavoriteList).toHaveBeenCalledWith("tok", "Favorilerim"));
    expect(addFavoriteVenue).toHaveBeenCalledWith("tok", "list1", "v1");
  });

  it("reuses the user's first existing list instead of creating a new one", async () => {
    getFavoriteLists.mockResolvedValue([{ id: "existing", name: "Denenecekler" }]);
    render(<FavoriteButton venueId="v1" />);
    fireEvent.click(screen.getByTestId("favorite-button"));
    await waitFor(() => expect(addFavoriteVenue).toHaveBeenCalledWith("tok", "existing", "v1"));
    expect(createFavoriteList).not.toHaveBeenCalled();
  });
});
