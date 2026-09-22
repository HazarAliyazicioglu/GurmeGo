import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ApiHttpError } from "@gurmego/api-client";
import MekanGecmisiPage from "./page";

const signOut = vi.fn().mockResolvedValue({ error: null });
const useAuthMock = vi.fn();
vi.mock("@/lib/auth-context", () => ({ useAuth: () => useAuthMock() }));
const push = vi.fn();
const routerMock = { push };
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
const searchVenues = vi.fn();
const listVenueVersions = vi.fn();
const revertVenue = vi.fn();
vi.mock("@/lib/api", () => ({
  searchVenues: (...args: unknown[]) => searchVenues(...args),
  listVenueVersions: (...args: unknown[]) => listVenueVersions(...args),
  revertVenue: (...args: unknown[]) => revertVenue(...args),
}));

beforeEach(() => {
  searchVenues.mockReset();
  listVenueVersions.mockReset();
  revertVenue.mockReset().mockResolvedValue(undefined);
  signOut.mockReset().mockResolvedValue({ error: null });
  push.mockReset();
  useAuthMock.mockReset().mockReturnValue({
    session: { access_token: "tok" },
    role: "curator",
    loading: false,
    user: { id: "u1" },
    signOut,
  });
});

const VENUE = { id: "550e8400-e29b-41d4-a716-446655440000", name: "Kadıköy Kahvecisi", slug: "kadikoy-kahvecisi", status: "PUBLISHED" as const };
const VERSION = { id: "660e8400-e29b-41d4-a716-446655440000", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "admin-1" };

describe("MekanGecmisiPage", () => {
  it("searches venues by name/slug and lists matches", async () => {
    searchVenues.mockResolvedValueOnce([VENUE]);
    render(<MekanGecmisiPage />);
    fireEvent.change(screen.getByLabelText(/mekan ara/i), { target: { value: "kadikoy" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));
    await waitFor(() => expect(screen.getByText("Kadıköy Kahvecisi")).toBeInTheDocument());
    expect(searchVenues).toHaveBeenCalledWith("tok", "kadikoy");
  });

  it("selecting a venue loads and shows its version history", async () => {
    searchVenues.mockResolvedValueOnce([VENUE]);
    listVenueVersions.mockResolvedValueOnce([VERSION]);
    render(<MekanGecmisiPage />);
    fireEvent.change(screen.getByLabelText(/mekan ara/i), { target: { value: "kadikoy" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));
    await waitFor(() => expect(screen.getByText("Kadıköy Kahvecisi")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Kadıköy Kahvecisi"));
    await waitFor(() => expect(listVenueVersions).toHaveBeenCalledWith("tok", VENUE.id));
    await waitFor(() => expect(screen.getByRole("button", { name: /bu sürüme geri al/i })).toBeInTheDocument());
  });

  it("shows an empty state when a selected venue has no version history", async () => {
    searchVenues.mockResolvedValueOnce([VENUE]);
    listVenueVersions.mockResolvedValueOnce([]);
    render(<MekanGecmisiPage />);
    fireEvent.change(screen.getByLabelText(/mekan ara/i), { target: { value: "kadikoy" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));
    await waitFor(() => expect(screen.getByText("Kadıköy Kahvecisi")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Kadıköy Kahvecisi"));
    await waitFor(() => expect(screen.getByText(/sürüm geçmişi yok/i)).toBeInTheDocument());
  });

  it("requires confirmation before reverting, then calls revertVenue", async () => {
    searchVenues.mockResolvedValueOnce([VENUE]);
    listVenueVersions.mockResolvedValueOnce([VERSION]).mockResolvedValueOnce([VERSION]);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<MekanGecmisiPage />);
    fireEvent.change(screen.getByLabelText(/mekan ara/i), { target: { value: "kadikoy" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));
    await waitFor(() => expect(screen.getByText("Kadıköy Kahvecisi")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Kadıköy Kahvecisi"));
    await waitFor(() => screen.getByRole("button", { name: /bu sürüme geri al/i }));

    fireEvent.click(screen.getByRole("button", { name: /bu sürüme geri al/i }));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(revertVenue).toHaveBeenCalledWith("tok", VENUE.id, VERSION.id));
    confirmSpy.mockRestore();
  });

  it("does NOT call revertVenue when the confirmation is declined", async () => {
    searchVenues.mockResolvedValueOnce([VENUE]);
    listVenueVersions.mockResolvedValueOnce([VERSION]);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<MekanGecmisiPage />);
    fireEvent.change(screen.getByLabelText(/mekan ara/i), { target: { value: "kadikoy" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));
    await waitFor(() => expect(screen.getByText("Kadıköy Kahvecisi")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Kadıköy Kahvecisi"));
    await waitFor(() => screen.getByRole("button", { name: /bu sürüme geri al/i }));

    fireEvent.click(screen.getByRole("button", { name: /bu sürüme geri al/i }));
    expect(revertVenue).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("shows a permission message on 403 during search", async () => {
    searchVenues.mockRejectedValueOnce(new ApiHttpError(403, "forbidden"));
    render(<MekanGecmisiPage />);
    fireEvent.change(screen.getByLabelText(/mekan ara/i), { target: { value: "kadikoy" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/yetkiniz yok/i));
  });

  it("clears the previously selected venue's version list when a new search runs (Codex MAJOR finding)", async () => {
    searchVenues.mockResolvedValueOnce([VENUE]);
    listVenueVersions.mockResolvedValueOnce([VERSION]);
    render(<MekanGecmisiPage />);
    fireEvent.change(screen.getByLabelText(/mekan ara/i), { target: { value: "kadikoy" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));
    await waitFor(() => expect(screen.getByText("Kadıköy Kahvecisi")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Kadıköy Kahvecisi"));
    await waitFor(() => screen.getByRole("button", { name: /bu sürüme geri al/i }));

    searchVenues.mockResolvedValueOnce([]);
    fireEvent.change(screen.getByLabelText(/mekan ara/i), { target: { value: "baska" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));
    await waitFor(() => expect(screen.getByText(/eşleşen mekan bulunamadı/i)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /bu sürüme geri al/i })).not.toBeInTheDocument();
  });

  it("discards a stale listVenueVersions response for a venue that is no longer selected (Codex MAJOR finding)", async () => {
    const VENUE_B = { ...VENUE, id: "770e8400-e29b-41d4-a716-446655440000", name: "Beşiktaş Lokantası" };
    let resolveA!: (v: unknown) => void;
    searchVenues.mockResolvedValueOnce([VENUE, VENUE_B]);
    listVenueVersions
      .mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }))
      .mockResolvedValueOnce([{ ...VERSION, id: "version-b", createdBy: "curator-2" }]);
    render(<MekanGecmisiPage />);
    fireEvent.change(screen.getByLabelText(/mekan ara/i), { target: { value: "kadikoy" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));
    await waitFor(() => expect(screen.getByText("Kadıköy Kahvecisi")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Kadıköy Kahvecisi")); // A: slow response
    fireEvent.click(screen.getByText("Beşiktaş Lokantası")); // B: fast response, selected last
    await waitFor(() => expect(listVenueVersions).toHaveBeenCalledTimes(2));

    await waitFor(() => expect(screen.getByText("curator-2")).toBeInTheDocument());
    resolveA([VERSION]); // A's stale response arrives after B is already selected
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.queryByText(VERSION.createdBy!)).not.toBeInTheDocument();
    expect(screen.getByText("curator-2")).toBeInTheDocument();
  });

  it("tracks the reverting button independently per version, not with one shared flag (Codex MAJOR finding)", async () => {
    const VERSION_B = { ...VERSION, id: "version-b" };
    searchVenues.mockResolvedValueOnce([VENUE]);
    listVenueVersions.mockResolvedValueOnce([VERSION, VERSION_B]).mockResolvedValueOnce([VERSION, VERSION_B]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let resolveRevert!: () => void;
    revertVenue.mockImplementationOnce(() => new Promise((resolve) => { resolveRevert = () => resolve(undefined); }));
    render(<MekanGecmisiPage />);
    fireEvent.change(screen.getByLabelText(/mekan ara/i), { target: { value: "kadikoy" } });
    fireEvent.click(screen.getByRole("button", { name: /ara/i }));
    await waitFor(() => expect(screen.getByText("Kadıköy Kahvecisi")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Kadıköy Kahvecisi"));
    const revertButtons = await waitFor(() => screen.getAllByRole("button", { name: /bu sürüme geri al/i }));

    fireEvent.click(revertButtons[0]); // starts a slow, unresolved revert for VERSION
    expect(revertButtons[1]).not.toBeDisabled(); // VERSION_B's own button must stay usable
    await act(async () => {
      resolveRevert();
      await Promise.resolve();
    });
  });
});
