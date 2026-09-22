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

import { getQueue, approveQueueItem, rejectQueueItem, importCsv, getDataQualityReport, ApiValidationError } from "./api";
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

  // MINOR 3 fix (final whole-branch review): this test used to assert that `getQueue` REJECTS a
  // non-REPORT (`type: "EDIT"`) item in the response, via `ApiValidationError`. That premise is
  // false on two independent counts, confirmed by reading both the real implementation and the
  // real schema (this was a stale/incorrect test, not a real behavior gap — pre-dates this whole
  // hardening pass, per docs/STATE.md's "Ertelenen/izlenen maddeler"):
  //   1. `getQueue`'s request ALWAYS hardcodes `type=REPORT` (see api.ts's own comment and the
  //      "always requests type=REPORT" test above) and is not overridable by any caller — a
  //      structural guarantee, not a runtime check, so the real API server only ever returns
  //      REPORT rows for this call in the first place.
  //   2. Even if a non-REPORT item somehow appeared in the response body, `AdminQueueItemSchema`
  //      (packages/shared/src/schemas/admin-queue.schema.ts) deliberately types `type` as
  //      `z.enum(["REPORT", "EDIT"])`, NOT `z.literal("REPORT")` — its own comment explains this
  //      is intentional, since the same item schema is reused for single-item EDIT lookups
  //      elsewhere. So `safeParse` would happily ACCEPT an EDIT item; asserting it throws was
  //      testing behavior the schema was never written to have.
  // The real, structurally-guaranteed contract this function must uphold is response-shape
  // validation in general — a genuinely malformed item must still be rejected. This replacement
  // test proves that instead of the impossible EDIT-rejection scenario.
  it("throws ApiValidationError when a response item is genuinely malformed (fails schema validation), not merely because it happens to be type EDIT", async () => {
    get.mockResolvedValue([{ ...VALID_ITEM, id: "not-a-valid-uuid" }]);
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

describe("getDataQualityReport", () => {
  it("returns the validated report", async () => {
    const report = { perDistrict: [{ name: "Kadıköy", count: 12 }], staleCount: 3, bySource: [{ source: "MANUAL", count: 12 }] };
    get.mockResolvedValue(report);
    const result = await getDataQualityReport("tok");
    expect(result).toEqual(report);
    expect(get).toHaveBeenCalledWith("/admin/reports/data-quality");
  });

  it("throws ApiValidationError when the response doesn't match DataQualityReportSchema", async () => {
    get.mockResolvedValue({ nonsense: true });
    await expect(getDataQualityReport("tok")).rejects.toThrow(ApiValidationError);
  });
});
