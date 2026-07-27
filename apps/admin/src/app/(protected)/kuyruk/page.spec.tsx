import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ApiHttpError } from "@gurmego/api-client";
import KuyrukPage from "./page";

const signOut = vi.fn().mockResolvedValue({ error: null });
// `signOut` is passed through directly (not re-wrapped in a fresh arrow function on every call) so
// its reference is stable across renders -- it's a `refetch`/`handleApprove` useCallback dependency,
// and an unstable reference here would re-create `refetch` every render, re-firing the mount effect
// and re-calling getQueue() indefinitely (exhausting `mockResolvedValueOnce` queues into `undefined`).
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ session: { access_token: "tok" }, role: "curator", loading: false, user: { id: "u1" }, signOut }),
}));
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
