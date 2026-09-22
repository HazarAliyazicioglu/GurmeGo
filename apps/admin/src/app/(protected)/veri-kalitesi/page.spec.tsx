import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ApiHttpError } from "@gurmego/api-client";
import VeriKalitesiPage from "./page";

const signOut = vi.fn().mockResolvedValue({ error: null });
const useAuthMock = vi.fn();
vi.mock("@/lib/auth-context", () => ({ useAuth: () => useAuthMock() }));
const push = vi.fn();
const routerMock = { push };
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
const getDataQualityReport = vi.fn();
vi.mock("@/lib/api", () => ({
  getDataQualityReport: (...args: unknown[]) => getDataQualityReport(...args),
}));

beforeEach(() => {
  getDataQualityReport.mockReset();
  signOut.mockReset().mockResolvedValue({ error: null });
  push.mockReset();
  useAuthMock.mockReset().mockReturnValue({
    session: { access_token: "tok" },
    role: "curator",
    loading: false,
    user: { id: "u1" },
    signOut,
  });
});

const REPORT = {
  perDistrict: [{ name: "Kadıköy", count: 12 }, { name: "Beşiktaş", count: 7 }],
  staleCount: 3,
  bySource: [{ source: "MANUAL" as const, count: 15 }, { source: "USER" as const, count: 4 }],
};

describe("VeriKalitesiPage", () => {
  it("renders per-district counts, stale count, and source breakdown", async () => {
    getDataQualityReport.mockResolvedValueOnce(REPORT);
    render(<VeriKalitesiPage />);
    await waitFor(() => expect(screen.getByText("Kadıköy")).toBeInTheDocument());
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Beşiktaş")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // staleCount
    expect(screen.getByText("MANUAL")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument(); // bySource[0].count
    expect(screen.getByText("USER")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument(); // bySource[1].count
  });

  it("shows a permission message on 403", async () => {
    getDataQualityReport.mockRejectedValueOnce(new ApiHttpError(403, "forbidden"));
    render(<VeriKalitesiPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/görüntüleme yetkiniz yok/i));
  });

  it("signs out and redirects to /giris on 401", async () => {
    getDataQualityReport.mockRejectedValueOnce(new ApiHttpError(401, "unauthorized"));
    render(<VeriKalitesiPage />);
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/giris"));
  });

  it("shows a generic error message on other failures", async () => {
    getDataQualityReport.mockRejectedValueOnce(new Error("network down"));
    render(<VeriKalitesiPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/yüklenemedi/i));
  });

  it("shows a visible error instead of an unhandled rejection when signOut() itself rejects on a 401", async () => {
    signOut.mockRejectedValueOnce(new Error("network error"));
    getDataQualityReport.mockRejectedValueOnce(new ApiHttpError(401, "unauthorized"));
    render(<VeriKalitesiPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/çıkış yapılamadı/i));
    expect(push).not.toHaveBeenCalled();
  });
});
