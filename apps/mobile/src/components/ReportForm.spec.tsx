import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import ReportForm from "./ReportForm";
import { reportVenue } from "../lib/api";

jest.mock("../lib/api", () => ({ reportVenue: jest.fn() }));

describe("ReportForm", () => {
  beforeEach(() => {
    (reportVenue as jest.Mock).mockReset();
  });


  it("submits the typed reason and shows a thank-you message on success", async () => {
    (reportVenue as jest.Mock).mockResolvedValue({ urgent: false });

    await render(<ReportForm venueId="v1" />);

    await waitFor(() => expect(screen.getByTestId("report-reason")).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(screen.getByTestId("report-reason"), "Fiyat yanlış");
    });

    await act(async () => {
      fireEvent.press(screen.getByText("Gönder"));
    });

    await waitFor(() => expect(reportVenue).toHaveBeenCalledWith("v1", "Fiyat yanlış", undefined));
    await waitFor(() => expect(screen.getByText(/kürasyon ekibine iletildi/)).toBeTruthy());
  });

  it("shows an error message when the submission fails", async () => {
    (reportVenue as jest.Mock).mockRejectedValue(new Error("network error"));

    await render(<ReportForm venueId="v1" />);

    await waitFor(() => expect(screen.getByTestId("report-reason")).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(screen.getByTestId("report-reason"), "Fiyat yanlış");
    });

    await act(async () => {
      fireEvent.press(screen.getByText("Gönder"));
    });

    await waitFor(() => expect(screen.getByText(/Bildirim gönderilemedi/)).toBeTruthy());
  });

  // Denetim raporu (2026-09-25) "ReportForm'da client validasyon yok": nothing stopped an
  // empty/too-short reason from reaching the network -- the backend's own `CreateReportSchema`
  // requires `reason.min(5)`, so a too-short submit was previously a guaranteed 400 round-trip.
  it("shows a validation message and does not submit when the reason is shorter than 5 characters", async () => {
    (reportVenue as jest.Mock).mockResolvedValue({ urgent: false });

    await render(<ReportForm venueId="v1" />);

    await waitFor(() => expect(screen.getByTestId("report-reason")).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(screen.getByTestId("report-reason"), "kısa");
    });

    await act(async () => {
      fireEvent.press(screen.getByText("Gönder"));
    });

    await waitFor(() => expect(screen.getByText(/en az 5 karakter/i)).toBeTruthy());
    expect(reportVenue).not.toHaveBeenCalled();
  });
});

// Web parity audit (2026-09-28): apps/web's ReportForm already had a "Düzeltme öner" structured
// correction toggle (field/suggestedValue) since PR #38; mobile's ReportForm was left reason-only.
describe("ReportForm — structured correction (field + suggested value)", () => {
  beforeEach(() => {
    (reportVenue as jest.Mock).mockReset();
  });

  it("shows field/suggested-value inputs only after 'Düzeltme öner' is pressed", async () => {
    await render(<ReportForm venueId="v1" />);

    expect(screen.queryByTestId("report-field")).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByText("Düzeltme öner"));
    });
    expect(screen.getByTestId("report-field")).toBeTruthy();
    expect(screen.getByTestId("report-suggested-value")).toBeTruthy();
  });

  it("submits field/suggestedValue alongside the reason when filled in", async () => {
    (reportVenue as jest.Mock).mockResolvedValue({ urgent: false });

    await render(<ReportForm venueId="v1" />);

    await act(async () => {
      fireEvent.changeText(screen.getByTestId("report-reason"), "Fiyat aralığı güncel değil");
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Düzeltme öner"));
    });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId("report-field"), "Fiyat aralığı");
      fireEvent.changeText(screen.getByTestId("report-suggested-value"), "MID");
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Gönder"));
    });

    await waitFor(() =>
      expect(reportVenue).toHaveBeenCalledWith("v1", "Fiyat aralığı güncel değil", {
        field: "Fiyat aralığı",
        suggestedValue: "MID",
      }),
    );
  });

  it("sends field without suggestedValue when only field is filled in", async () => {
    (reportVenue as jest.Mock).mockResolvedValue({ urgent: false });

    await render(<ReportForm venueId="v1" />);

    await act(async () => {
      fireEvent.changeText(screen.getByTestId("report-reason"), "Telefon yanlış");
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Düzeltme öner"));
    });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId("report-field"), "Telefon");
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Gönder"));
    });

    await waitFor(() =>
      expect(reportVenue).toHaveBeenCalledWith("v1", "Telefon yanlış", { field: "Telefon" }),
    );
  });

  it("trims whitespace and treats a whitespace-only field as not provided", async () => {
    (reportVenue as jest.Mock).mockResolvedValue({ urgent: false });

    await render(<ReportForm venueId="v1" />);

    await act(async () => {
      fireEvent.changeText(screen.getByTestId("report-reason"), "Adres yanlış");
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Düzeltme öner"));
    });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId("report-field"), "   ");
      fireEvent.changeText(screen.getByTestId("report-suggested-value"), "  Yeni adres  ");
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Gönder"));
    });

    // Whitespace-only field means "not provided" -- suggestedValue alone (no field) would violate
    // CreateReportSchema's own refine(), so the whole correction is dropped, not just trimmed.
    await waitFor(() => expect(reportVenue).toHaveBeenCalledWith("v1", "Adres yanlış", undefined));
  });

  it("omits the correction entirely when 'Düzeltme öner' was never opened", async () => {
    (reportVenue as jest.Mock).mockResolvedValue({ urgent: false });

    await render(<ReportForm venueId="v1" />);

    await act(async () => {
      fireEvent.changeText(screen.getByTestId("report-reason"), "Fiyat yanlış");
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Gönder"));
    });

    await waitFor(() => expect(reportVenue).toHaveBeenCalledWith("v1", "Fiyat yanlış", undefined));
  });
});
