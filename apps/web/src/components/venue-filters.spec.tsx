import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { serializeFilters, VenueFilters } from "./venue-filters";

describe("serializeFilters", () => {
  it("omits unset filters and includes set ones as query params", () => {
    const result = serializeFilters({ category: "cafe", priceRange: undefined, isBoutique: true, radiusM: undefined });
    expect(result).toEqual({ category: "cafe", isBoutique: "true" });
  });

  it("only includes radiusM when both radiusM and coordinates are present (distance filtering needs lat/lng too)", () => {
    const result = serializeFilters({ radiusM: 1500 }, { lat: 40.99, lng: 29.02 });
    expect(result).toEqual({ radiusM: "1500" });
  });

  it("omits radiusM when coordinates are unavailable — server ignores radiusM without lat/lng anyway", () => {
    const result = serializeFilters({ radiusM: 1500 }, null);
    expect(result).toEqual({});
  });

  it("never includes lat/lng, even when coords and radiusM are both present", () => {
    const out = serializeFilters({ radiusM: 2000 }, { lat: 40.99, lng: 29.02 });
    expect(out).toEqual({ radiusM: "2000" });
  });

  it("emits openNow=true only when true, omits it when false or undefined", () => {
    expect(serializeFilters({ openNow: true })).toEqual({ openNow: "true" });
    expect(serializeFilters({ openNow: false })).toEqual({});
    expect(serializeFilters({})).toEqual({});
  });

  // Plan 4b's OptionalTrueFlag schema rejects `isBoutique=false` with a 400. The toggle button is
  // the only current caller and it never passes `false`, but `serializeFilters` itself must also
  // guard this — any future caller (e.g. restoring filters from a URL) could pass `false` directly.
  it("never emits isBoutique=false, even when called directly with isBoutique: false (bypassing the toggle button)", () => {
    expect(serializeFilters({ isBoutique: false })).toEqual({});
  });

  // 2026-09-25 audit finding: web had no free-text search param at all.
  it("includes q (trimmed) when set, omits it when empty/undefined", () => {
    expect(serializeFilters({ q: "  kahve  " })).toEqual({ q: "kahve" });
    expect(serializeFilters({ q: "" })).toEqual({});
    expect(serializeFilters({})).toEqual({});
  });
});

// Plan 4b's OptionalTrueFlag schema rejects `isBoutique=false` with a 400 — the toggle must only
// ever move between `undefined` and `true`, never explicitly `false`.
describe("VenueFilters — boutique toggle only ever sets true or undefined", () => {
  it("toggles between undefined and true, never sets false", () => {
    const onChange = vi.fn();
    const { rerender } = render(<VenueFilters value={{}} onChange={onChange} coordsAvailable={false} />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ isBoutique: true }));
    rerender(<VenueFilters value={{ isBoutique: true }} onChange={onChange} coordsAvailable={false} />);
    fireEvent.click(screen.getByTestId("filter-boutique"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ isBoutique: undefined }));
  });
});

describe("VenueFilters — openNow toggle", () => {
  it("toggles between undefined and true", () => {
    const onChange = vi.fn();
    const { rerender } = render(<VenueFilters value={{}} onChange={onChange} coordsAvailable={false} />);
    fireEvent.click(screen.getByTestId("filter-open-now"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ openNow: true }));
    rerender(<VenueFilters value={{ openNow: true }} onChange={onChange} coordsAvailable={false} />);
    fireEvent.click(screen.getByTestId("filter-open-now"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ openNow: undefined }));
  });
});

// 2026-09-25 audit finding: web had no free-text search input at all.
describe("VenueFilters — search input", () => {
  it("debounces onChange while typing, firing once 300ms after the last keystroke", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<VenueFilters value={{}} onChange={onChange} coordsAvailable={false} />);
    const input = screen.getByTestId("filter-search");

    fireEvent.change(input, { target: { value: "k" } });
    vi.advanceTimersByTime(100);
    fireEvent.change(input, { target: { value: "ka" } });
    vi.advanceTimersByTime(100);
    fireEvent.change(input, { target: { value: "kahve" } });
    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ q: "kahve" }));
    vi.useRealTimers();
  });

  it("clears the filter (calls onChange immediately, no debounce) when the input is emptied", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<VenueFilters value={{ q: "kahve" }} onChange={onChange} coordsAvailable={false} />);
    const input = screen.getByTestId("filter-search");

    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ q: undefined }));
    vi.useRealTimers();
  });
});
