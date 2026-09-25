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

    await waitFor(() => expect(reportVenue).toHaveBeenCalledWith("v1", "Fiyat yanlış"));
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
