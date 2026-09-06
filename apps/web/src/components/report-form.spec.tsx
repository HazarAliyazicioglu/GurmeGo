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
});
