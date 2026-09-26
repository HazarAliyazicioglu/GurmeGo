import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SuggestVenueForm } from "./suggest-venue-form";

const suggestVenue = vi.fn();
vi.mock("@/lib/api", () => ({ suggestVenue: (...args: unknown[]) => suggestVenue(...args) }));

const DISTRICTS = [
  { id: "d1", cityId: "c1", name: "Kadıköy", slug: "kadikoy" },
  { id: "d2", cityId: "c1", name: "Beşiktaş", slug: "besiktas" },
];

function fillRequired() {
  fireEvent.change(screen.getByLabelText("Mekan adı"), { target: { value: "Moda Kahvecisi" } });
  fireEvent.change(screen.getByLabelText("İlçe"), { target: { value: "kadikoy" } });
  fireEvent.change(screen.getByLabelText("Kategori"), { target: { value: "cafe" } });
}

describe("SuggestVenueForm", () => {
  it("submits the required fields and shows a thank-you message", async () => {
    suggestVenue.mockResolvedValue({ ok: true });
    render(<SuggestVenueForm districts={DISTRICTS} />);
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "Gönder" }));
    await waitFor(() =>
      expect(suggestVenue).toHaveBeenCalledWith({ name: "Moda Kahvecisi", districtSlug: "kadikoy", category: "cafe" }),
    );
    expect(await screen.findByText(/kürasyon ekibine iletildi/)).toBeInTheDocument();
  });

  it("includes address/note only when filled in", async () => {
    suggestVenue.mockResolvedValue({ ok: true });
    render(<SuggestVenueForm districts={DISTRICTS} />);
    fillRequired();
    fireEvent.change(screen.getByLabelText("Adres (opsiyonel)"), { target: { value: "Moda Cd. No:1" } });
    fireEvent.click(screen.getByRole("button", { name: "Gönder" }));
    await waitFor(() =>
      expect(suggestVenue).toHaveBeenCalledWith({
        name: "Moda Kahvecisi", districtSlug: "kadikoy", category: "cafe", address: "Moda Cd. No:1",
      }),
    );
  });

  it("disables the submit button while the request is in flight", async () => {
    let resolve: (v: { ok: true }) => void;
    suggestVenue.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<SuggestVenueForm districts={DISTRICTS} />);
    fillRequired();
    const button = screen.getByRole("button", { name: "Gönder" });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    resolve!({ ok: true });
    await screen.findByText(/kürasyon ekibine iletildi/);
  });

  it("shows an error and keeps the form when the submission fails", async () => {
    suggestVenue.mockRejectedValue(new Error("boom"));
    render(<SuggestVenueForm districts={DISTRICTS} />);
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "Gönder" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("gönderilemedi");
    expect(screen.getByRole("button", { name: "Gönder" })).not.toBeDisabled();
  });
});
