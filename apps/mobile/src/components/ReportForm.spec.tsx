import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import ReportForm from "./ReportForm";
import { reportVenue } from "../lib/api";

jest.mock("../lib/api", () => ({ reportVenue: jest.fn() }));

describe("ReportForm", () => {
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
});
