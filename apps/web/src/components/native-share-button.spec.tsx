import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NativeShareButton } from "./native-share-button";

describe("NativeShareButton", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });

  it("renders once mounted when navigator.share is a real function, and calls it with the venue name and a URL", async () => {
    const shareMock = vi.fn();
    Object.defineProperty(navigator, "share", { value: shareMock, configurable: true });
    render(<NativeShareButton venue={{ name: "Cafe Test" }} />);
    await waitFor(() => expect(screen.getByTestId("native-share-button")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("native-share-button"));
    expect(shareMock).toHaveBeenCalledWith({ title: "Cafe Test", url: expect.any(String) });
  });

  it("never renders when navigator.share is undefined (checks typeof, not `in`)", async () => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    render(<NativeShareButton venue={{ name: "Cafe Test" }} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId("native-share-button")).not.toBeInTheDocument();
  });
});
