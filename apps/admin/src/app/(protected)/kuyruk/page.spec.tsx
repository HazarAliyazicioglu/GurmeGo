import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ApiHttpError } from "@gurmego/api-client";
import KuyrukPage from "./page";

const signOut = vi.fn().mockResolvedValue({ error: null });
// `signOut` is passed through directly (not re-wrapped in a fresh arrow function on every call) so
// its reference is stable across renders -- it's a `refetch`/`handleApprove` useCallback dependency,
// and an unstable reference here would re-create `refetch` every render, re-firing the mount effect
// and re-calling getQueue() indefinitely (exhausting `mockResolvedValueOnce` queues into `undefined`).
// TASK 27 fix (Codex cross-model review of Task 26): was a fixed factory returning a static
// object. Made reconfigurable (same pattern as apps/web/src/app/favoriler/page.spec.tsx's
// `useAuthMock`) so a test can simulate the session/token changing mid-request via `rerender()`.
const useAuthMock = vi.fn();
vi.mock("@/lib/auth-context", () => ({ useAuth: () => useAuthMock() }));
const push = vi.fn();
// Same stability concern as `signOut` above, and the same pattern apps/web/src/app/favoriler/page.spec.tsx
// uses (`useRouter: () => router` with a module-level `router` object): the router OBJECT itself, not
// just `.push`, is a useCallback dependency, so `useRouter()` must return the identical object every call.
const routerMock = { push };
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
const getQueue = vi.fn();
const approveQueueItem = vi.fn().mockResolvedValue(undefined);
const rejectQueueItem = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/api", () => ({
  getQueue: (...args: unknown[]) => getQueue(...args),
  approveQueueItem: (...args: unknown[]) => approveQueueItem(...args),
  rejectQueueItem: (...args: unknown[]) => rejectQueueItem(...args),
}));

beforeEach(() => {
  getQueue.mockReset();
  approveQueueItem.mockReset().mockResolvedValue(undefined);
  rejectQueueItem.mockReset().mockResolvedValue(undefined);
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

const BASE_ITEM = {
  id: "q1", type: "REPORT" as const, venueId: "v1", payload: { reason: "Fiyat yanlış" }, submittedBy: null,
  status: "PENDING" as const, reviewedBy: null, reviewedAt: null, createdAt: "2026-01-01T00:00:00.000Z",
  venue: { name: "Test Cafe", slug: "test-cafe" }, urgent: false,
};

const OTHER_ITEM = {
  ...BASE_ITEM,
  id: "q2",
  venue: { name: "Other Cafe", slug: "other-cafe" },
};

describe("KuyrukPage", () => {
  it("lists pending items and approves one on click", async () => {
    getQueue.mockResolvedValueOnce([BASE_ITEM]).mockResolvedValueOnce([]); // refetch after approve returns empty

    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));
    await waitFor(() => expect(approveQueueItem).toHaveBeenCalledWith("tok", "q1"));
    await waitFor(() => expect(getQueue).toHaveBeenCalledTimes(2)); // initial + refetch after mutation
  });

  it("rejects an item on click and refetches", async () => {
    getQueue.mockResolvedValueOnce([BASE_ITEM]).mockResolvedValueOnce([]);
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /reddet/i }));
    await waitFor(() => expect(rejectQueueItem).toHaveBeenCalledWith("tok", "q1"));
    await waitFor(() => expect(getQueue).toHaveBeenCalledTimes(2));
  });

  it("marks an urgent item's list entry so it can be visually distinguished", async () => {
    getQueue.mockResolvedValueOnce([{ ...BASE_ITEM, urgent: true }]);
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByTestId("queue-item")).toHaveAttribute("data-urgent", "true"));
  });

  it("shows a fallback label when the reported venue has been deleted (nullable venue)", async () => {
    getQueue.mockResolvedValueOnce([{ ...BASE_ITEM, venue: null }]);
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByText(/mekan silinmiş/i)).toBeInTheDocument());
  });

  it("shows the empty state when there are no pending reports", async () => {
    getQueue.mockResolvedValueOnce([]);
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
  });

  it("shows a visible error and stops loading (instead of hanging forever) when the initial getQueue() call rejects", async () => {
    getQueue.mockRejectedValueOnce(new Error("network error"));
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/yüklenemedi/i));
  });

  it("shows a visible error and does not refetch when approveQueueItem rejects", async () => {
    getQueue.mockResolvedValueOnce([BASE_ITEM]);
    approveQueueItem.mockRejectedValueOnce(new Error("network error"));
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(getQueue).toHaveBeenCalledTimes(1); // no refetch after a failed mutation
  });

  it("shows a visible error and does not refetch when rejectQueueItem rejects", async () => {
    getQueue.mockResolvedValueOnce([BASE_ITEM]);
    rejectQueueItem.mockRejectedValueOnce(new Error("network error"));
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /reddet/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(getQueue).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons for a row while its mutation is in flight, preventing a concurrent double-click", async () => {
    getQueue.mockResolvedValueOnce([BASE_ITEM]).mockResolvedValueOnce([BASE_ITEM]);
    let resolveApprove: () => void = () => {};
    approveQueueItem.mockReset().mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveApprove = resolve;
      }),
    );
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeInTheDocument());
    const approveBtn = screen.getByRole("button", { name: /onayla/i });
    const rejectBtn = screen.getByRole("button", { name: /reddet/i });

    fireEvent.click(approveBtn);

    await waitFor(() => expect(approveBtn).toBeDisabled());
    expect(rejectBtn).toBeDisabled();

    resolveApprove();
    await waitFor(() => expect(approveBtn).not.toBeDisabled());
  });

  it("tracks in-flight mutations per row: finishing row B's mutation must not re-enable row A's buttons while A is still in flight", async () => {
    // Regression test for the round-1 bug: a single shared `mutatingId` value meant starting row B's
    // mutation (mutatingId="q2") while row A's (mutatingId="q1") was still in flight overwrote the
    // shared id, incorrectly re-enabling row A's buttons mid-flight and allowing a curator to
    // double-fire row A. This must fail against the pre-fix single-id implementation.
    getQueue.mockResolvedValueOnce([BASE_ITEM, OTHER_ITEM]);
    let resolveApproveA: () => void = () => {};
    let resolveApproveB: () => void = () => {};
    approveQueueItem.mockReset().mockImplementation((_token: string, id: string) => {
      if (id === "q1") return new Promise<void>((resolve) => { resolveApproveA = resolve; });
      return new Promise<void>((resolve) => { resolveApproveB = resolve; });
    });

    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Other Cafe")).toBeInTheDocument());

    const approveButtons = screen.getAllByRole("button", { name: /onayla/i });
    const rejectButtons = screen.getAllByRole("button", { name: /reddet/i });
    const [approveA, approveB] = approveButtons;
    const [rejectA, rejectB] = rejectButtons;

    // Start row A's mutation.
    fireEvent.click(approveA);
    await waitFor(() => expect(approveA).toBeDisabled());
    expect(rejectA).toBeDisabled();
    // Row B is untouched so far.
    expect(approveB).not.toBeDisabled();

    // Start row B's mutation while A is still in flight.
    getQueue.mockResolvedValueOnce([BASE_ITEM, OTHER_ITEM]);
    fireEvent.click(approveB);
    await waitFor(() => expect(approveB).toBeDisabled());
    expect(rejectB).toBeDisabled();

    // Row A must STILL be disabled — its own mutation hasn't resolved yet.
    expect(approveA).toBeDisabled();
    expect(rejectA).toBeDisabled();

    // Resolve B first; A must remain disabled since only B's mutation completed.
    resolveApproveB();
    await waitFor(() => expect(approveB).not.toBeDisabled());
    expect(approveA).toBeDisabled();
    expect(rejectA).toBeDisabled();

    // Now resolve A; A's buttons finally re-enable.
    getQueue.mockResolvedValueOnce([OTHER_ITEM]);
    resolveApproveA();
    await waitFor(() => expect(screen.queryByText("Test Cafe")).not.toBeInTheDocument());
  });

  it("keeps the queue list and action buttons visible/interactive after a mutation failure (round-3 regression: round-2's fix hid the whole page on ANY error, including mutation errors, not just load errors)", async () => {
    getQueue.mockResolvedValueOnce([BASE_ITEM]);
    approveQueueItem.mockRejectedValueOnce(new Error("network error"));
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    // The already-loaded queue item and its action buttons must still be visible AND interactive —
    // a mutation failure must not hide the list the way a load failure legitimately does, and the
    // `finally`-block lock release must not leave the buttons permanently disabled after an error.
    expect(screen.getByText("Test Cafe")).toBeInTheDocument();
    const approveBtn = screen.getByRole("button", { name: /onayla/i });
    const rejectBtn = screen.getByRole("button", { name: /reddet/i });
    expect(approveBtn).toBeInTheDocument();
    expect(rejectBtn).toBeInTheDocument();
    expect(approveBtn).not.toBeDisabled();
    expect(rejectBtn).not.toBeDisabled();
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });

  it("does not show the empty-state message alongside the error banner when the initial load fails", async () => {
    // Regression test: before the fix, `items.length === 0` alone controlled the empty state, so a
    // rejected initial getQueue() (items stays []) showed BOTH "Kuyruk yüklenemedi" and "Bekleyen
    // bildirim yok" at once — a contradictory "failed to load" + "all caught up" message.
    getQueue.mockRejectedValueOnce(new Error("network error"));
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/yüklenemedi/i));
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });

  it("does not show the pending-count header claiming '0 bildirim' when the initial load fails", async () => {
    // Regression test: the header count is derived from `items.length`, which stays 0 on a failed
    // initial load (there's no data at all, not zero pending items). Showing "Bekleyen 0 bildirim"
    // next to "Kuyruk yüklenemedi" falsely implies the queue is known to be empty.
    getQueue.mockRejectedValueOnce(new Error("network error"));
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/yüklenemedi/i));
    expect(screen.queryByText(/0 bildirim/i)).not.toBeInTheDocument();
  });

  it("still shows the pending-count header on a successful load, including when the queue is empty", async () => {
    getQueue.mockResolvedValueOnce([]);
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
    expect(screen.getByText(/0 bildirim/i)).toBeInTheDocument();
  });

  it("discards a stale refetch response that resolves after a newer, more current refetch (concurrent-mutation race)", async () => {
    // Regression test for the request-generation-guard fix: two rows approved in quick succession
    // each trigger their own refetch(). Without a request-id guard, whichever refetch's getQueue()
    // response resolves LAST wins the render, regardless of which mutation was actually more
    // recent -- here the OLDER refetch (triggered by q1's approve) is deliberately made to resolve
    // AFTER the NEWER refetch (triggered by q2's approve), and only the newer one's data must stick.
    const resolvers: Array<(items: unknown) => void> = [];
    getQueue.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)));

    render(<KuyrukPage />);
    resolvers[0]([BASE_ITEM, OTHER_ITEM]); // initial load
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Other Cafe")).toBeInTheDocument());

    const [approveA, approveB] = screen.getAllByRole("button", { name: /onayla/i });

    fireEvent.click(approveA); // approves q1 -> its own refetch is getQueue call #2 (resolvers[1])
    await waitFor(() => expect(getQueue).toHaveBeenCalledTimes(2));

    fireEvent.click(approveB); // approves q2 -> its own refetch is getQueue call #3 (resolvers[2])
    await waitFor(() => expect(getQueue).toHaveBeenCalledTimes(3));

    // Resolve the NEWER refetch (#3) first, reflecting the true current state: both items approved,
    // queue empty.
    resolvers[2]([]);
    await waitFor(() => expect(screen.queryByTestId("empty-state")).toBeInTheDocument());

    // Now resolve the OLDER refetch (#2) LAST, with stale data implying q2 is still pending. This
    // must be discarded -- it must NOT overwrite the already-current empty list. If the guard were
    // missing, this stale response would eventually re-render with "Other Cafe" back on screen, so
    // asserting the empty state holds steady across a few ticks is a meaningful check here (there is
    // no other observable signal to `waitFor` on for a discarded response).
    resolvers[1]([OTHER_ITEM]);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.queryByTestId("empty-state")).toBeInTheDocument();
    expect(screen.queryByText("Other Cafe")).not.toBeInTheDocument();
  });

  it("signs out and redirects to login (instead of showing a generic error) when the initial getQueue() call rejects with a 401", async () => {
    getQueue.mockRejectedValueOnce(new ApiHttpError(401, "unauthorized"));
    render(<KuyrukPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/giris"));
    expect(signOut).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a distinct permission-denied message (not the generic load error) when the initial getQueue() call rejects with a 403", async () => {
    getQueue.mockRejectedValueOnce(new ApiHttpError(403, "forbidden"));
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/yetkiniz yok/i));
    expect(push).not.toHaveBeenCalled();
  });

  it("signs out and redirects to login when approveQueueItem rejects with a 401, instead of showing the generic mutation-failed message", async () => {
    getQueue.mockResolvedValueOnce([BASE_ITEM]);
    approveQueueItem.mockRejectedValueOnce(new ApiHttpError(401, "unauthorized"));
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/giris"));
    expect(signOut).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a distinct permission-denied message when approveQueueItem rejects with a 403, distinct from a generic 500 failure", async () => {
    getQueue.mockResolvedValueOnce([BASE_ITEM]);
    approveQueueItem.mockRejectedValueOnce(new ApiHttpError(403, "forbidden"));
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/yetkiniz yok/i));
    expect(push).not.toHaveBeenCalled();
  });

  // MAJOR 4 fix (final whole-branch review): the 401 sign-out paths used to call `signOut()`
  // without awaiting or checking its result, so a rejected/error-resolved signOut during a 401
  // flow either produced an unhandled rejection or silently proceeded to redirect as if sign-out
  // succeeded. These two tests prove the fixed behavior matches the established
  // layout.tsx/erisim-yok.tsx pattern: an error-resolved signOut shows an error banner and does
  // NOT redirect.
  it("shows an error and does NOT redirect when signOut() resolves with an error during the initial-load 401 flow", async () => {
    getQueue.mockRejectedValueOnce(new ApiHttpError(401, "unauthorized"));
    signOut.mockResolvedValueOnce({ error: "boom" });
    render(<KuyrukPage />);
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/çıkış yapılamadı/i));
    expect(push).not.toHaveBeenCalledWith("/giris");
  });

  it("shows an error and does NOT redirect when signOut() resolves with an error during the mutation 401 flow", async () => {
    getQueue.mockResolvedValueOnce([BASE_ITEM]);
    approveQueueItem.mockRejectedValueOnce(new ApiHttpError(401, "unauthorized"));
    signOut.mockResolvedValueOnce({ error: "boom" });
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));

    await waitFor(() => expect(signOut).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/çıkış yapılamadı/i));
    expect(push).not.toHaveBeenCalledWith("/giris");
  });

  it("shows an error and does not produce an unhandled rejection when signOut() itself rejects during a 401 flow", async () => {
    getQueue.mockRejectedValueOnce(new ApiHttpError(401, "unauthorized"));
    signOut.mockRejectedValueOnce(new Error("network down"));
    render(<KuyrukPage />);
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/çıkış yapılamadı/i));
    expect(push).not.toHaveBeenCalledWith("/giris");
  });

  // TASK 27 fix (Codex cross-model review of Task 26, MAJOR): unlike refetch()'s 401 path (already
  // guarded by `latestQueueRequest`), the mutation 401 path (handleApprove/handleReject ->
  // handleMutationError) had NO staleness check at all -- a stale approve/reject call's delayed
  // 401 would sign out whichever curator's session happened to be current by the time it arrived,
  // even if that was a DIFFERENT curator than the one who started the request.
  it("does not sign out the new curator when a stale approve's delayed 401 arrives after the session token has already changed", async () => {
    getQueue.mockResolvedValueOnce([BASE_ITEM]);
    let rejectApprove: (err: unknown) => void;
    approveQueueItem.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectApprove = reject; }));
    const { rerender } = render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));
    await waitFor(() => expect(approveQueueItem).toHaveBeenCalledWith("tok", "q1"));

    // A different curator signs in before the stale approve's response arrives.
    getQueue.mockResolvedValueOnce([BASE_ITEM]);
    useAuthMock.mockReturnValue({
      session: { access_token: "tok-2" },
      role: "curator",
      loading: false,
      user: { id: "u2" },
      signOut,
    });
    rerender(<KuyrukPage />);
    await waitFor(() => expect(getQueue).toHaveBeenCalledWith("tok-2", { status: "PENDING" }));

    await act(async () => {
      rejectApprove!(new ApiHttpError(401, "unauthorized"));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(signOut).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalledWith("/giris");
  });

  // Second Codex cross-model review pass (Task 27, MAJOR): the first pass's guard only covered
  // the mutation call itself failing with 401. It missed this path: a stale (old-token) approve
  // SUCCEEDS after the session changed, and handleApprove's own `await refetch()` afterward is
  // still bound to the OLD token (the closure captured at click time) -- but that refetch() call
  // bumps the SHARED `latestQueueRequest` counter, making itself look like the newest request by
  // count alone, even though it used a token that is no longer current. If THAT refetch's own
  // response is a 401, the old requestId-only guard would not catch it, and it would sign out the
  // NEW curator's session.
  it("does not sign out the new curator when a stale approve SUCCEEDS after the session changed, and its own follow-up refetch then gets a 401 using the old token", async () => {
    getQueue.mockResolvedValueOnce([BASE_ITEM]); // initial load, tok
    let resolveApprove: (value: unknown) => void;
    approveQueueItem.mockReturnValueOnce(new Promise((resolve) => { resolveApprove = resolve; }));
    const { rerender } = render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));
    await waitFor(() => expect(approveQueueItem).toHaveBeenCalledWith("tok", "q1"));

    // A different curator signs in before the stale approve resolves. This fires its own
    // token-"tok-2" refetch via the effect.
    getQueue.mockResolvedValueOnce([BASE_ITEM]); // effect-driven refetch, tok-2
    useAuthMock.mockReturnValue({
      session: { access_token: "tok-2" },
      role: "curator",
      loading: false,
      user: { id: "u2" },
      signOut,
    });
    rerender(<KuyrukPage />);
    await waitFor(() => expect(getQueue).toHaveBeenCalledWith("tok-2", { status: "PENDING" }));

    // The stale approve (still holding the OLD "tok" closure) now succeeds, triggering its own
    // `refetch()` call -- which uses "tok", not "tok-2" -- and that call gets a 401.
    getQueue.mockRejectedValueOnce(new ApiHttpError(401, "unauthorized"));
    await act(async () => {
      resolveApprove!(undefined);
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(signOut).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalledWith("/giris");
  });

  // Third Codex cross-model review pass (Task 27): the second pass's fix checked the token
  // AFTER `getQueue` resolved/rejected, but `refetch()` bumped the SHARED `latestQueueRequest`
  // counter at its very start regardless of token -- so a stale (old-token) refetch call could
  // still "poison" that counter, making a genuinely current-token refetch that started earlier
  // (and is still pending) look stale by count alone once IT resolves, discarding its legitimate
  // response. The fix must check the token BEFORE incrementing the counter or calling `getQueue`
  // at all, so a stale-token call never touches the counter in the first place.
  it("does not let a stale-token refetch call poison a genuinely current, still-pending refetch's own response", async () => {
    getQueue.mockResolvedValueOnce([BASE_ITEM]); // initial load, tok
    let resolveApprove: (value: unknown) => void;
    approveQueueItem.mockReturnValueOnce(new Promise((resolve) => { resolveApprove = resolve; }));
    const { rerender } = render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));
    await waitFor(() => expect(approveQueueItem).toHaveBeenCalledWith("tok", "q1"));

    // A different curator signs in. This fires the effect's own tok-2 refetch -- held pending,
    // not yet resolved.
    let resolveNewSessionQueue: (value: unknown) => void;
    getQueue.mockReturnValueOnce(new Promise((resolve) => { resolveNewSessionQueue = resolve; }));
    useAuthMock.mockReturnValue({
      session: { access_token: "tok-2" },
      role: "curator",
      loading: false,
      user: { id: "u2" },
      signOut,
    });
    rerender(<KuyrukPage />);
    await waitFor(() => expect(getQueue).toHaveBeenCalledWith("tok-2", { status: "PENDING" }));
    const getQueueCallsBeforeStaleResolve = getQueue.mock.calls.length;

    // The stale approve (still holding the OLD "tok" closure) now succeeds, triggering its own
    // `refetch()` call.
    await act(async () => {
      resolveApprove!(undefined);
      await new Promise((r) => setTimeout(r, 0));
    });

    // The stale-token refetch must never even call getQueue again -- it should bail before
    // touching the shared request counter or making any network call.
    expect(getQueue.mock.calls.length).toBe(getQueueCallsBeforeStaleResolve);

    // NOW the genuinely current (tok-2) refetch, which was already in flight before the stale
    // call ran, resolves. Its response must still be applied.
    await act(async () => {
      resolveNewSessionQueue!([OTHER_ITEM]);
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByText("Other Cafe")).toBeInTheDocument();
  });

  it("shows the generic mutation-failed message (distinct from the 403 permission message) on a plain/500 error", async () => {
    getQueue.mockResolvedValueOnce([BASE_ITEM]);
    approveQueueItem.mockRejectedValueOnce(new Error("network error"));
    render(<KuyrukPage />);
    await waitFor(() => expect(screen.getByText("Test Cafe")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/gerçekleştirilemedi/i));
    expect(screen.queryByRole("alert")).not.toHaveTextContent(/yetkiniz yok/i);
  });
});

describe("KuyrukPage — visible loading state while the queue itself is loading", () => {
  it("renders a visible, accessible loading indicator while getQueue() is unresolved", () => {
    getQueue.mockReturnValue(new Promise(() => {})); // never resolves within this test
    render(<KuyrukPage />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/yükleniyor/i);
  });
});
