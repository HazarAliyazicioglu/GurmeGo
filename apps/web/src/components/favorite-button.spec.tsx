import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FavoriteButton } from "./favorite-button";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(
    (): { user: { id: string } | null; session: { access_token: string } | null } => ({
      user: { id: "u1" },
      session: { access_token: "tok" },
    }),
  ),
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: mockUseAuth,
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
    mockUseAuth.mockReturnValue({ user: { id: "u1" }, session: { access_token: "tok" } });
    getFavoriteLists.mockReset();
    createFavoriteList.mockReset();
    addFavoriteVenue.mockReset().mockResolvedValue(undefined);
  });

  it("creates a default 'Favorilerim' list when the user has none, then adds the venue", async () => {
    getFavoriteLists.mockResolvedValue([]);
    createFavoriteList.mockResolvedValue({
      id: "list1",
      name: "Favorilerim",
      userId: "u1",
      createdAt: "2026-01-01T00:00:00.000Z",
      favorites: [],
    });
    render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("favorite-button"));
    await waitFor(() => expect(createFavoriteList).toHaveBeenCalledWith("tok", "Favorilerim"));
    expect(addFavoriteVenue).toHaveBeenCalledWith("tok", "list1", "v1");
  });

  it("reuses the user's first existing list instead of creating a new one", async () => {
    getFavoriteLists.mockResolvedValue([{
      id: "existing", name: "Denenecekler", userId: "u1", createdAt: "2026-01-01T00:00:00.000Z", favorites: [],
    }]);
    render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("favorite-button"));
    await waitFor(() => expect(addFavoriteVenue).toHaveBeenCalledWith("tok", "existing", "v1"));
    expect(createFavoriteList).not.toHaveBeenCalled();
  });
});

describe("FavoriteButton — real mount-time state check and disabled-while-pending", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" }, session: { access_token: "tok" } });
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

describe("FavoriteButton — reactivity and race conditions", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" }, session: { access_token: "tok" } });
    getFavoriteLists.mockReset();
    createFavoriteList.mockReset();
    addFavoriteVenue.mockReset().mockResolvedValue(undefined);
  });

  it("re-arms the mount-time check and produces the correct result when `user` transitions from null to a real user after initial mount", async () => {
    mockUseAuth.mockReturnValue({ user: null, session: null });
    getFavoriteLists.mockResolvedValue([{
      id: "l1", userId: "u1", name: "Default", createdAt: "2026-01-01T00:00:00.000Z",
      favorites: [{ id: "f1", venueId: "v1", venue: { id: "v1", name: "X", slug: "x", category: "cafe", priceRange: "BUDGET", isBoutique: false } }],
    }]);
    const { rerender } = render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled());
    expect(screen.getByTestId("favorite-button")).toHaveAttribute("aria-pressed", "false");
    expect(getFavoriteLists).not.toHaveBeenCalled();

    mockUseAuth.mockReturnValue({ user: { id: "u1" }, session: { access_token: "tok" } });
    rerender(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByTestId("favorite-button")).toHaveAttribute("aria-pressed", "true"));
  });

  it("resets `added` to false when `venueId` changes on the same instance, before the new mount-time check resolves", async () => {
    getFavoriteLists.mockResolvedValueOnce([{
      id: "l1", userId: "u1", name: "Default", createdAt: "2026-01-01T00:00:00.000Z",
      favorites: [{ id: "f1", venueId: "v1", venue: { id: "v1", name: "X", slug: "x", category: "cafe", priceRange: "BUDGET", isBoutique: false } }],
    }]);
    const { rerender } = render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByTestId("favorite-button")).toHaveAttribute("aria-pressed", "true"));

    let resolveSecondCheck: (value: unknown) => void;
    getFavoriteLists.mockReturnValue(new Promise((resolve) => { resolveSecondCheck = resolve; }));
    rerender(<FavoriteButton venueId="v2" />);
    // Reset happens synchronously on venueId change, before the new check resolves.
    expect(screen.getByTestId("favorite-button")).toHaveAttribute("aria-pressed", "false");

    resolveSecondCheck!([]);
    await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled());
    expect(screen.getByTestId("favorite-button")).toHaveAttribute("aria-pressed", "false");
  });

  it("settles to a usable (non-permanently-disabled) state when the mount-time getFavoriteLists check rejects", async () => {
    getFavoriteLists.mockRejectedValue(new Error("network error"));
    render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled());
    expect(screen.getByTestId("favorite-button")).toHaveAttribute("aria-pressed", "false");
  });

  it("does not apply a stale handleClick result to the new venue when venueId changes mid-flight", async () => {
    const listFixture = {
      id: "l1", userId: "u1", name: "Default", createdAt: "2026-01-01T00:00:00.000Z", favorites: [],
    };
    // One resolution for the mount-time check, one for handleClick's own `getFavoriteLists` call.
    getFavoriteLists.mockResolvedValueOnce([listFixture]).mockResolvedValueOnce([listFixture]);
    let resolveAdd: () => void;
    addFavoriteVenue.mockReturnValueOnce(new Promise<void>((resolve) => { resolveAdd = resolve; }));
    const { rerender } = render(<FavoriteButton venueId="v1" />);
    await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled());

    // Click "add" for v1 — this kicks off getFavoriteLists -> addFavoriteVenue, which we hold open.
    fireEvent.click(screen.getByTestId("favorite-button"));
    await waitFor(() => expect(addFavoriteVenue).toHaveBeenCalledWith("tok", "l1", "v1"));

    // Before the v1 click resolves, the component gets reused for a different venue.
    getFavoriteLists.mockResolvedValueOnce([{
      id: "l1", userId: "u1", name: "Default", createdAt: "2026-01-01T00:00:00.000Z", favorites: [],
    }]);
    rerender(<FavoriteButton venueId="v2" />);
    await waitFor(() => expect(screen.getByTestId("favorite-button")).toHaveAttribute("aria-pressed", "false"));

    // Now the stale v1 request finally resolves.
    resolveAdd!();
    await waitFor(() => expect(screen.getByTestId("favorite-button")).not.toBeDisabled());

    // v2 must still show as NOT favorited — the stale v1 result must not leak in.
    expect(screen.getByTestId("favorite-button")).toHaveAttribute("aria-pressed", "false");
  });
});
