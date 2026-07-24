import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import KuyrukPage from "./page";

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ session: { access_token: "tok" }, role: "curator", loading: false, user: { id: "u1" } }),
}));
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
});

const BASE_ITEM = {
  id: "q1", type: "REPORT" as const, venueId: "v1", payload: { reason: "Fiyat yanlış" }, submittedBy: null,
  status: "PENDING" as const, reviewedBy: null, reviewedAt: null, createdAt: "2026-01-01T00:00:00.000Z",
  venue: { name: "Test Cafe", slug: "test-cafe" }, urgent: false,
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
});
