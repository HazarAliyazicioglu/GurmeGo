import { Profiler, type ProfilerOnRenderCallback } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
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

describe("FavorilerPage — discards a stale getFavoriteLists response after a session change (privacy race)", () => {
  beforeEach(() => {
    push.mockClear();
    vi.mocked(getFavoriteLists).mockReset();
    useAuthMock.mockReset();
  });

  it("does not render User A's lists if their request resolves after User B has logged in", async () => {
    let resolveUserA: (v: unknown) => void;
    vi.mocked(getFavoriteLists).mockImplementationOnce(
      () => new Promise<unknown>((resolve) => { resolveUserA = resolve; }) as ReturnType<typeof getFavoriteLists>,
    );
    useAuthMock.mockReturnValue({
      user: { id: "user-a" },
      loading: false,
      session: { access_token: "token-a" },
    });

    const { rerender } = render(<FavorilerPage />);
    await waitFor(() => expect(getFavoriteLists).toHaveBeenCalledWith("token-a"));

    // User B logs in before User A's request has resolved.
    vi.mocked(getFavoriteLists).mockResolvedValueOnce([
      { id: "list-b", userId: "user-b", name: "User B's list", createdAt: "2026-01-01T00:00:00.000Z", favorites: [] },
    ]);
    useAuthMock.mockReturnValue({
      user: { id: "user-b" },
      loading: false,
      session: { access_token: "token-b" },
    });
    rerender(<FavorilerPage />);
    await waitFor(() => expect(getFavoriteLists).toHaveBeenCalledWith("token-b"));
    await waitFor(() => expect(screen.getByText("User B's list")).toBeInTheDocument());

    // NOW User A's stale request finally resolves -- it must be discarded, not rendered over
    // User B's already-visible lists.
    resolveUserA!([
      { id: "list-a", userId: "user-a", name: "User A's list", createdAt: "2026-01-01T00:00:00.000Z", favorites: [] },
    ]);
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByText("User A's list")).not.toBeInTheDocument();
    expect(screen.getByText("User B's list")).toBeInTheDocument();
  });
});

describe("FavorilerPage — no committed frame ever paints the previous session's lists (BLOCKER 1)", () => {
  beforeEach(() => {
    push.mockClear();
    vi.mocked(getFavoriteLists).mockReset();
    useAuthMock.mockReset();
  });

  it("never commits a single DOM frame showing User A's lists once props flip to User B's session -- not even a transient frame flushed by act() before assertions run", async () => {
    useAuthMock.mockReturnValue({
      user: { id: "user-a" },
      loading: false,
      session: { access_token: "token-a" },
    });
    vi.mocked(getFavoriteLists).mockResolvedValue([
      { id: "list-a", userId: "user-a", name: "User A's list", createdAt: "2026-01-01T00:00:00.000Z", favorites: [] },
    ]);

    // `rerender()` from Testing Library wraps the update in `act()`, which flushes `useEffect`
    // synchronously before returning control to the test. That means a plain assertion made right
    // after `rerender()` can't tell "cleared during render" (the actual fix, page.tsx:32-38) apart
    // from "cleared by an effect that ran and flushed before the assertion" (the old, buggy
    // behavior) -- both look identical by the time `rerender()` returns.
    //
    // To actually discriminate them we record what was on screen at EVERY commit (via
    // `Profiler.onRender`, which fires once per commit of the profiled tree, in order), not just
    // the final state after all commits have settled. The two implementations differ in how many
    // commits happen and what the FIRST one shows:
    //  - render-time clear (fix): React's "adjust state while rendering" bails out of the stale
    //    render and re-invokes the component synchronously with `lists` already `null`, all before
    //    anything commits. Only ONE commit happens for the whole rerender, and it never shows User
    //    A's list.
    //  - effect-only clear (bug): the render with new props commits FIRST with the still-stale
    //    `lists` (User A's list still on screen), and only a SECOND commit (triggered by the
    //    effect's `setLists(null)`, flushed synchronously inside the same `act()`) clears it.
    // So checking every recorded commit -- not just the post-`rerender()` end state -- is what
    // actually proves no committed frame ever showed the wrong owner's data.
    const commits: boolean[] = [];
    const onRender: ProfilerOnRenderCallback = () => {
      commits.push(screen.queryByText("User A's list") !== null);
    };

    const { rerender } = render(
      <Profiler id="favoriler-probe" onRender={onRender}>
        <FavorilerPage />
      </Profiler>,
    );
    await waitFor(() => expect(screen.getByText("User A's list")).toBeInTheDocument());
    commits.length = 0; // Only the commits from the session flip below are under test.

    // Session flips to User B. A NEW, never-resolving promise is queued for B's fetch so the only
    // way `lists` can become `null` is via the render-time clear or the effect's clear -- not via a
    // real response resolving and being applied.
    vi.mocked(getFavoriteLists).mockReturnValue(new Promise(() => {}));
    useAuthMock.mockReturnValue({
      user: { id: "user-b" },
      loading: false,
      session: { access_token: "token-b" },
    });
    rerender(
      <Profiler id="favoriler-probe" onRender={onRender}>
        <FavorilerPage />
      </Profiler>,
    );

    // At least one commit must have happened for this rerender, and NONE of them -- including the
    // very first -- may have shown User A's list.
    expect(commits.length).toBeGreaterThan(0);
    expect(commits.every((hadUserAList) => hadUserAList === false)).toBe(true);

    // The property under test is "no committed frame EVER shows the previous session's data", not
    // merely "not in the one commit immediately following the flip". An implementation that clears
    // stale state correctly only on the very next render after a prop change could still have a
    // latent bug that resurfaces on a LATER, unrelated re-render (e.g. a stray effect, or a
    // re-render triggered by something else entirely, re-deriving/restoring the old value). Force
    // at least one more, benign re-render -- same User B session, identical props -- and confirm
    // User A's list still never appears in ANY commit recorded across the WHOLE sequence, not just
    // the commit(s) produced by the flip itself.
    rerender(
      <Profiler id="favoriler-probe" onRender={onRender}>
        <FavorilerPage />
      </Profiler>,
    );
    expect(commits.length).toBeGreaterThan(1);
    expect(commits.every((hadUserAList) => hadUserAList === false)).toBe(true);
  });
});

describe("FavorilerPage — create-list response guarded against a session change (BLOCKER 2)", () => {
  beforeEach(() => {
    push.mockClear();
    vi.mocked(getFavoriteLists).mockReset();
    vi.mocked(createFavoriteList).mockReset();
    useAuthMock.mockReset();
  });

  it("does not append a create-list response that resolves after the session has already changed", async () => {
    useAuthMock.mockReturnValue({
      user: { id: "user-a" },
      loading: false,
      session: { access_token: "token-a" },
    });
    vi.mocked(getFavoriteLists).mockResolvedValue([]);
    let resolveCreate: (v: unknown) => void;
    vi.mocked(createFavoriteList).mockImplementationOnce(
      () => new Promise<unknown>((resolve) => { resolveCreate = resolve; }) as ReturnType<typeof createFavoriteList>,
    );

    const { rerender } = render(<FavorilerPage />);
    await waitFor(() => expect(screen.getByLabelText(/liste adı/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/liste adı/i), { target: { value: "User A's new list" } });
    fireEvent.click(screen.getByRole("button", { name: /oluştur/i }));
    await waitFor(() => expect(createFavoriteList).toHaveBeenCalledWith("token-a", "User A's new list"));

    // Session changes to User B (same component instance, via rerender) before the create-list
    // request resolves.
    vi.mocked(getFavoriteLists).mockResolvedValueOnce([
      { id: "list-b", userId: "user-b", name: "User B's list", createdAt: "2026-01-01T00:00:00.000Z", favorites: [] },
    ]);
    useAuthMock.mockReturnValue({
      user: { id: "user-b" },
      loading: false,
      session: { access_token: "token-b" },
    });
    rerender(<FavorilerPage />);
    await waitFor(() => expect(screen.getByText("User B's list")).toBeInTheDocument());

    // NOW User A's stale create-list response resolves -- it must not be appended anywhere.
    await act(async () => {
      resolveCreate!({
        id: "list-a-new",
        userId: "user-a",
        name: "User A's new list",
        createdAt: "2026-01-01T00:00:00.000Z",
        favorites: [],
      });
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.queryByText("User A's new list")).not.toBeInTheDocument();
  });
});

// TASK 27 fix (Codex cross-model review of Task 26, MAJOR): the render-time identity-gated reset
// (page.tsx:34-48) clears `creating` back to `false` the moment the session changes. But User A's
// stale `createFavoriteList` call still has its OWN unconditional `finally { setCreating(false) }`
// that fires whenever that promise eventually settles -- with no check that IT is still the latest
// request. If User B (the new session) starts their OWN create-list submission before User A's
// stale call resolves, User A's stale `finally` clobbers User B's genuinely-in-flight `creating`
// state back to `false`, letting User B's submit button re-enable (and be double-clicked) while
// their own request is still pending.
describe("FavorilerPage — a stale create-list request's `finally` does not clobber a newer request's own `creating` state", () => {
  beforeEach(() => {
    push.mockClear();
    vi.mocked(getFavoriteLists).mockReset();
    vi.mocked(createFavoriteList).mockReset();
    useAuthMock.mockReset();
  });

  it("keeps `creating` (submit button disabled) true for User B's own in-flight request when User A's stale request resolves afterward", async () => {
    useAuthMock.mockReturnValue({
      user: { id: "user-a" },
      loading: false,
      session: { access_token: "token-a" },
    });
    vi.mocked(getFavoriteLists).mockResolvedValue([]);
    let resolveA: (v: unknown) => void;
    vi.mocked(createFavoriteList).mockImplementationOnce(
      () => new Promise<unknown>((resolve) => { resolveA = resolve; }) as ReturnType<typeof createFavoriteList>,
    );

    const { rerender } = render(<FavorilerPage />);
    await waitFor(() => expect(screen.getByLabelText(/liste adı/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/liste adı/i), { target: { value: "User A's list" } });
    fireEvent.click(screen.getByRole("button", { name: /oluştur/i }));
    await waitFor(() => expect(createFavoriteList).toHaveBeenCalledWith("token-a", "User A's list"));

    // Session changes to User B before User A's create-list request resolves.
    vi.mocked(getFavoriteLists).mockResolvedValueOnce([]);
    useAuthMock.mockReturnValue({
      user: { id: "user-b" },
      loading: false,
      session: { access_token: "token-b" },
    });
    rerender(<FavorilerPage />);
    await waitFor(() => expect(screen.getByLabelText(/liste adı/i)).toBeInTheDocument());

    // User B starts their own create-list submission -- still in flight, never resolved in this test.
    let resolveB: (v: unknown) => void;
    vi.mocked(createFavoriteList).mockImplementationOnce(
      () => new Promise<unknown>((resolve) => { resolveB = resolve; }) as ReturnType<typeof createFavoriteList>,
    );
    fireEvent.change(screen.getByLabelText(/liste adı/i), { target: { value: "User B's list" } });
    fireEvent.click(screen.getByRole("button", { name: /oluştur/i }));
    await waitFor(() => expect(createFavoriteList).toHaveBeenCalledWith("token-b", "User B's list"));
    expect(screen.getByRole("button", { name: /oluştur/i })).toBeDisabled();

    // NOW User A's stale request resolves. It must not re-enable the submit button while User B's
    // own request is still genuinely pending.
    await act(async () => {
      resolveA!({ id: "list-a", userId: "user-a", name: "User A's list", createdAt: "2026-01-01T00:00:00.000Z", favorites: [] });
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByRole("button", { name: /oluştur/i })).toBeDisabled();
    void resolveB!; // never resolved -- this test only asserts the stale-A-resolution effect
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
