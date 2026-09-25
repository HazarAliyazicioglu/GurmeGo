import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorPage from "./error";

describe("ErrorPage", () => {
  it("shows an error message and calls reset() when the retry button is pressed", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("boom")} reset={reset} />);

    expect(screen.getByText(/bir şeyler ters gitti/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /tekrar dene/i }));
    expect(reset).toHaveBeenCalled();
  });
});
