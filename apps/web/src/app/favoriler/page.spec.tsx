import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import FavorilerPage from "./page";
import { getFavoriteLists, createFavoriteList } from "@/lib/api";

const push = vi.fn();
const router = { push };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const useAuthMock = vi.fn();
vi.mock("@/lib/auth-context", () => ({ useAuth: () => useAuthMock() }));

vi.mock("@/lib/api", () => ({ getFavoriteLists: vi.fn(), createFavoriteList: vi.fn() }));

describe("FavorilerPage", () => {
  beforeEach(() => {
    push.mockClear();
    vi.mocked(getFavoriteLists).mockReset();
    useAuthMock.mockReset();
  });

  it("redirects to /giris when there is no authenticated user", () => {
    useAuthMock.mockReturnValue({ user: null, loading: false, session: null });

    render(<FavorilerPage />);
    expect(push).toHaveBeenCalledWith("/giris");
  });

  it("redirects to /giris when fetching favorite lists fails (e.g. expired/rejected token)", async () => {
    useAuthMock.mockReturnValue({
      user: { id: "u1" },
      loading: false,
      session: { access_token: "expired-token" },
    });
    vi.mocked(getFavoriteLists).mockRejectedValue(new Error("401"));

    render(<FavorilerPage />);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/giris"));
  });
});

describe("FavorilerPage — visible loading state instead of a silent blank screen", () => {
  beforeEach(() => {
    push.mockClear();
    vi.mocked(getFavoriteLists).mockReset();
    useAuthMock.mockReset();
  });

  it("renders a visible, accessible loading indicator while auth is loading, not null", () => {
    useAuthMock.mockReturnValue({ user: null, session: null, loading: true });
    render(<FavorilerPage />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/yükleniyor/i);
  });
});

describe("Favoriler page — create a new list", () => {
  beforeEach(() => {
    push.mockClear();
    vi.mocked(getFavoriteLists).mockReset();
    vi.mocked(createFavoriteList).mockReset();
    useAuthMock.mockReset();
  });

  it("submits a new list name via createFavoriteList(token, name) and shows it as a new card once appended", async () => {
    useAuthMock.mockReturnValue({
      user: { id: "u1" },
      loading: false,
      session: { access_token: "token-123" },
    });
    vi.mocked(getFavoriteLists).mockResolvedValue([]);
    vi.mocked(createFavoriteList).mockResolvedValue({
      id: "l2",
      userId: "u1",
      name: "Kadıköy Kahveleri",
      createdAt: "2026-01-01T00:00:00.000Z",
      favorites: [],
    });

    render(<FavorilerPage />);

    await waitFor(() => expect(screen.getByLabelText(/liste adı/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/liste adı/i), { target: { value: "Kadıköy Kahveleri" } });
    fireEvent.click(screen.getByRole("button", { name: /oluştur/i }));

    await waitFor(() => expect(createFavoriteList).toHaveBeenCalledWith("token-123", "Kadıköy Kahveleri"));
    expect(await screen.findByText("Kadıköy Kahveleri")).toBeInTheDocument();
  });
});
