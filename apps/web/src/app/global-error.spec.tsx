import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const captureExceptionMock = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureException: (...args: unknown[]) => captureExceptionMock(...args) }));

import GlobalError from "./global-error";

describe("GlobalError", () => {
  it("shows a branded error message and reports the error to Sentry", () => {
    const error = new Error("boom");
    render(<GlobalError error={error} />);

    expect(screen.getByText(/bir şeyler ters gitti/i)).toBeTruthy();
    expect(captureExceptionMock).toHaveBeenCalledWith(error);
  });
});
