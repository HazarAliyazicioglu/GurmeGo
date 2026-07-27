import { describe, it, expect, vi, beforeEach } from "vitest";

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
// Preserve the real `ApiHttpError` export (via importOriginal) while only stubbing
// `createApiClient` — api.ts's own `importCsv` constructs `ApiHttpError` directly, so a mock that
// dropped this export would make that `new ApiHttpError(...)` call throw "not a constructor".
vi.mock("@gurmego/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@gurmego/api-client")>();
  return { ...actual, createApiClient: () => ({ get, post }) };
});

import { getQueue, approveQueueItem, rejectQueueItem, importCsv, ApiValidationError } from "./api";
import { ApiHttpError } from "@gurmego/api-client";

const VALID_ITEM = {
  id: "11111111-1111-1111-1111-111111111111",
  type: "REPORT",
  venueId: "22222222-2222-2222-2222-222222222222",
  payload: { reason: "Fiyat yanlış" },
  submittedBy: null,
  status: "PENDING",
  reviewedBy: null,
  reviewedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  venue: { name: "Test Cafe", slug: "test-cafe" },
  urgent: false,
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe("getQueue", () => {
  it("always requests type=REPORT and returns validated items", async () => {
    get.mockResolvedValue([VALID_ITEM]);
    const result = await getQueue("tok", { status: "PENDING" });
    expect(result).toEqual([VALID_ITEM]);
    expect(get).toHaveBeenCalledWith(expect.stringContaining("type=REPORT"));
    expect(get).toHaveBeenCalledWith(expect.stringContaining("status=PENDING"));
  });

  it("throws ApiValidationError when a non-REPORT item is returned", async () => {
    get.mockResolvedValue([{ ...VALID_ITEM, type: "EDIT" }]);
    await expect(getQueue("tok")).rejects.toThrow(ApiValidationError);
  });
});

describe("approveQueueItem / rejectQueueItem", () => {
  const MUTATION_RESULT = { ...VALID_ITEM, status: "APPROVED" };
  delete (MUTATION_RESULT as Partial<typeof MUTATION_RESULT>).venue;
  delete (MUTATION_RESULT as Partial<typeof MUTATION_RESULT>).urgent;

  it("approveQueueItem resolves on a valid mutation response", async () => {
    post.mockResolvedValue(MUTATION_RESULT);
    await expect(approveQueueItem("tok", VALID_ITEM.id)).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledWith(`/admin/queue/${VALID_ITEM.id}/approve`, {});
  });

  it("rejectQueueItem throws ApiValidationError on a malformed response", async () => {
    post.mockResolvedValue({ garbage: true });
    await expect(rejectQueueItem("tok", VALID_ITEM.id)).rejects.toThrow(ApiValidationError);
  });
});

describe("importCsv", () => {
  const file = new File(["name,slug\ntest,test"], "venues.csv", { type: "text/csv" });

  it("uploads via raw fetch (not the JSON-only .post) and returns the validated result", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ created: 2, skipped: 1, errors: [] }),
    }) as unknown as typeof fetch;
    const result = await importCsv("tok", file);
    expect(result).toEqual({ created: 2, skipped: 1, errors: [] });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers).not.toHaveProperty("Content-Type"); // never force JSON on a multipart body
  });

  it("throws an ApiHttpError carrying the status on a non-2xx HTTP response (not ApiValidationError — the request itself failed)", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    await expect(importCsv("tok", file)).rejects.toThrow("Import failed: 500");
    await expect(importCsv("tok", file)).rejects.toBeInstanceOf(ApiHttpError);
  });

  it("carries the 401/403 status on the thrown ApiHttpError so callers can distinguish session-expired from insufficient-role", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    await expect(importCsv("tok", file)).rejects.toMatchObject({ status: 401 });

    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 }) as unknown as typeof fetch;
    await expect(importCsv("tok", file)).rejects.toMatchObject({ status: 403 });
  });

  it("throws ApiValidationError when the 2xx response body doesn't match CsvImportResultSchema", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nonsense: true }) }) as unknown as typeof fetch;
    await expect(importCsv("tok", file)).rejects.toThrow(ApiValidationError);
  });
});
