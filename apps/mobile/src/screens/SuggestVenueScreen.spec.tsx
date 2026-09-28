import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import SuggestVenueScreen from "./SuggestVenueScreen";
import { getDistricts, suggestVenue } from "../lib/api";

jest.mock("../lib/api", () => ({
  getDistricts: jest.fn(),
  suggestVenue: jest.fn(),
}));

const DISTRICTS = [
  { id: "d1", cityId: "c1", name: "Kadıköy", slug: "kadikoy" },
  { id: "d2", cityId: "c1", name: "Beşiktaş", slug: "besiktas" },
];

// Web parity audit (2026-09-28): apps/web's /mekan-oner (PR #36) has no mobile equivalent at all
// -- this mirrors that flow (POST /venue-suggestions via suggestVenue, packages/shared's
// SuggestVenueSchema) with React Native chip-selection instead of web's <select>.
describe("SuggestVenueScreen", () => {
  beforeEach(() => {
    (getDistricts as jest.Mock).mockReset();
    (suggestVenue as jest.Mock).mockReset();
    (getDistricts as jest.Mock).mockResolvedValue(DISTRICTS);
  });

  it("submits the suggestion and shows a thank-you message on success", async () => {
    (suggestVenue as jest.Mock).mockResolvedValue({ ok: true });

    await render(<SuggestVenueScreen />);

    await waitFor(() => expect(screen.getByText("Kadıköy")).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(screen.getByTestId("suggest-name"), "Moda Kahvecisi");
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Kadıköy"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Gönder"));
    });

    await waitFor(() =>
      expect(suggestVenue).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Moda Kahvecisi", districtSlug: "kadikoy" }),
      ),
    );
    await waitFor(() => expect(screen.getByText(/kürasyon ekibine iletildi/)).toBeTruthy());
  });

  it("includes trimmed address/note only when filled in", async () => {
    (suggestVenue as jest.Mock).mockResolvedValue({ ok: true });

    await render(<SuggestVenueScreen />);
    await waitFor(() => expect(screen.getByText("Kadıköy")).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(screen.getByTestId("suggest-name"), "Moda Kahvecisi");
      fireEvent.press(screen.getByText("Kadıköy"));
      fireEvent.changeText(screen.getByTestId("suggest-address"), "  Moda Cd. No:1  ");
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Gönder"));
    });

    await waitFor(() =>
      expect(suggestVenue).toHaveBeenCalledWith(
        expect.objectContaining({ address: "Moda Cd. No:1" }),
      ),
    );
    const call = (suggestVenue as jest.Mock).mock.calls[0][0];
    expect(call).not.toHaveProperty("note");
  });

  it("shows a validation message and does not submit when the name is too short", async () => {
    await render(<SuggestVenueScreen />);
    await waitFor(() => expect(screen.getByText("Kadıköy")).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(screen.getByTestId("suggest-name"), "A");
      fireEvent.press(screen.getByText("Kadıköy"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Gönder"));
    });

    await waitFor(() => expect(screen.getByText(/en az 2 karakter/i)).toBeTruthy());
    expect(suggestVenue).not.toHaveBeenCalled();
  });

  it("shows an error message when the submission fails", async () => {
    (suggestVenue as jest.Mock).mockRejectedValue(new Error("network"));

    await render(<SuggestVenueScreen />);
    await waitFor(() => expect(screen.getByText("Kadıköy")).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(screen.getByTestId("suggest-name"), "Moda Kahvecisi");
      fireEvent.press(screen.getByText("Kadıköy"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Gönder"));
    });

    await waitFor(() => expect(screen.getByText(/öneri gönderilemedi/i)).toBeTruthy());
  });
});
