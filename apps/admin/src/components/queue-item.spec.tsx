import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueueItem } from "./queue-item";
import type { AdminQueueItem } from "@gurmego/shared";

const BASE = {
  id: "11111111-1111-1111-1111-111111111111",
  submittedBy: null,
  status: "PENDING" as const,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  urgent: false,
};

describe("QueueItem — REPORT (existing behavior)", () => {
  it("shows the venue name and report reason", () => {
    const item: AdminQueueItem = {
      ...BASE, type: "REPORT", venueId: "v1",
      payload: { reason: "Fiyat yanlış" },
      venue: { name: "Test Cafe", slug: "test-cafe" },
    };
    render(<QueueItem item={item} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText("Test Cafe")).toBeInTheDocument();
    expect(screen.getByText("Fiyat yanlış")).toBeInTheDocument();
  });

  it("shows '(mekan silinmiş)' when a REPORT/EDIT row's venue no longer exists", () => {
    const item: AdminQueueItem = { ...BASE, type: "REPORT", venueId: null, payload: { reason: "x" }, venue: null };
    render(<QueueItem item={item} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText("(mekan silinmiş)")).toBeInTheDocument();
  });
});

describe("QueueItem — REPORT with a structured correction (field/suggestedValue)", () => {
  it("shows the flagged field and suggested value alongside the reason", () => {
    const item: AdminQueueItem = {
      ...BASE, type: "REPORT", venueId: "v1",
      payload: { reason: "Fiyat aralığı güncel değil", field: "Fiyat aralığı", suggestedValue: "MID" },
      venue: { name: "Test Cafe", slug: "test-cafe" },
    };
    render(<QueueItem item={item} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText("Fiyat aralığı güncel değil")).toBeInTheDocument();
    expect(screen.getAllByText(/Fiyat aralığı/).length).toBeGreaterThan(1);
    expect(screen.getByText(/MID/)).toBeInTheDocument();
  });

  it("does not show a suggested-value line when only field was given", () => {
    const item: AdminQueueItem = {
      ...BASE, type: "REPORT", venueId: "v1",
      payload: { reason: "Telefon yanlış", field: "Telefon" },
      venue: { name: "Test Cafe", slug: "test-cafe" },
    };
    render(<QueueItem item={item} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getAllByText(/Telefon/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Önerilen/)).toBeNull();
  });
});

describe("QueueItem — NEW_VENUE (venue-suggestion submissions)", () => {
  const item: AdminQueueItem = {
    ...BASE, type: "NEW_VENUE", venueId: null, venue: null,
    payload: { name: "Moda Kahvecisi", districtName: "Kadıköy", category: "cafe", address: "Moda Cd. No:1", note: "iyi kahve" },
  };

  it("shows the suggested venue's name, not the deleted-venue placeholder", () => {
    render(<QueueItem item={item} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText("Moda Kahvecisi")).toBeInTheDocument();
    expect(screen.queryByText("(mekan silinmiş)")).toBeNull();
  });

  it("shows district, category, address and note from the suggestion payload", () => {
    render(<QueueItem item={item} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText(/Kadıköy/)).toBeInTheDocument();
    expect(screen.getByText(/cafe/)).toBeInTheDocument();
    expect(screen.getByText("Moda Cd. No:1")).toBeInTheDocument();
    expect(screen.getByText("iyi kahve")).toBeInTheDocument();
  });

  it("labels it as a new-venue suggestion and warns that approving does not auto-create the Venue", () => {
    render(<QueueItem item={item} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText("Yeni mekan önerisi")).toBeInTheDocument();
    expect(screen.getByText(/Venue kaydını otomatik oluşturmaz/)).toBeInTheDocument();
  });

  it("still renders working approve/reject buttons", () => {
    const onApprove = vi.fn();
    render(<QueueItem item={item} onApprove={onApprove} onReject={vi.fn()} />);
    screen.getByRole("button", { name: /Onayla/ }).click();
    expect(onApprove).toHaveBeenCalledWith(item.id);
  });
});
