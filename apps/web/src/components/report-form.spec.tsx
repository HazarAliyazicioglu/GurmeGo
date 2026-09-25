import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReportForm } from "./report-form";

vi.mock("@/lib/api", () => ({ reportVenue: vi.fn().mockResolvedValue({ urgent: false }) }));

describe("ReportForm", () => {
  it("submits the reason and shows a confirmation", async () => {
    render(<ReportForm venueId="v1" />);
    fireEvent.change(screen.getByLabelText(/neden/i), { target: { value: "Fiyat yanlış" } });
    fireEvent.click(screen.getByRole("button", { name: /gönder/i }));
    await waitFor(() => expect(screen.getByText(/teşekkürler/i)).toBeInTheDocument());
  });

  // 2026-09-25 audit finding: no client-side maxLength -- matches backend's
  // CreateReportSchema.reason.max(500) (packages/shared) so a too-long submit fails locally
  // instead of round-tripping to a 400.
  it("caps the reason textarea at 500 characters, matching the backend's max", () => {
    render(<ReportForm venueId="v1" />);
    expect(screen.getByLabelText(/neden/i)).toHaveAttribute("maxLength", "500");
  });
});
