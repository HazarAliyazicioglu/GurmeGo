import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const captureExceptionMock = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureException: (...args: unknown[]) => captureExceptionMock(...args) }));

import ErrorPage from "./error";

describe("ErrorPage", () => {
  it("shows a branded error message and calls reset() when the retry button is pressed", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("boom")} reset={reset} />);

    expect(screen.getByText(/bir şeyler ters gitti/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /tekrar dene/i }));
    expect(reset).toHaveBeenCalled();
  });

  it("reports the error to Sentry", () => {
    const error = new Error("boom");
    render(<ErrorPage error={error} reset={vi.fn()} />);

    expect(captureExceptionMock).toHaveBeenCalledWith(error);
  });
});
