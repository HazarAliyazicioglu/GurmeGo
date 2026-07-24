import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ImportPage from "./page";

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ session: { access_token: "tok" }, role: "curator", loading: false, user: { id: "u1" } }),
}));
const importCsv = vi.fn();
vi.mock("@/lib/api", () => ({ importCsv: (...args: unknown[]) => importCsv(...args) }));

function selectFile() {
  const file = new File(["name,slug\nTest,test"], "venues.csv", { type: "text/csv" });
  fireEvent.change(screen.getByLabelText(/csv dosyası/i), { target: { files: [file] } });
  return file;
}

beforeEach(() => {
  importCsv.mockReset();
});

describe("ImportPage", () => {
  it("uploads a file and shows the created/skipped/error summary", async () => {
    importCsv.mockResolvedValue({ created: 2, skipped: 1, errors: [{ row: 4, message: "priceRange geçersiz" }] });
    render(<ImportPage />);
    const file = selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));

    await waitFor(() => expect(importCsv).toHaveBeenCalledWith("tok", file));
    await waitFor(() => expect(screen.getByText(/2.*oluşturuldu/i)).toBeInTheDocument());
    expect(screen.getByText(/priceRange geçersiz/i)).toBeInTheDocument();
  });

  it("shows an error message and re-enables the upload button when the request fails (network error or HTTP failure)", async () => {
    importCsv.mockRejectedValue(new Error("Import failed: 500"));
    render(<ImportPage />);
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/yükleme başarısız/i));
    expect(screen.getByRole("button", { name: /yükle/i })).not.toBeDisabled();
  });

  it("disables the upload button while a request is in flight", async () => {
    let resolveImport: (value: unknown) => void = () => {};
    importCsv.mockReturnValue(new Promise((resolve) => { resolveImport = resolve; }));
    render(<ImportPage />);
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: /yükle/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /yükle/i })).toBeDisabled());
    resolveImport({ created: 0, skipped: 0, errors: [] });
  });
});
