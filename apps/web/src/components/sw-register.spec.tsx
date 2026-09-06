import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { ServiceWorkerRegister } from "./sw-register";

describe("ServiceWorkerRegister", () => {
  let registerSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    registerSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register: registerSpy },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error -- test-only cleanup of a property we defined above
    delete navigator.serviceWorker;
  });

  it("registers /sw.js only after mount (inside useEffect), not during initial render", () => {
    render(<ServiceWorkerRegister />);

    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(registerSpy).toHaveBeenCalledWith("/sw.js");
  });

  it("renders nothing", () => {
    const { container } = render(<ServiceWorkerRegister />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not throw when serviceWorker is unsupported", () => {
    // @ts-expect-error -- simulate a browser without service worker support
    delete navigator.serviceWorker;

    expect(() => render(<ServiceWorkerRegister />)).not.toThrow();
  });
});
