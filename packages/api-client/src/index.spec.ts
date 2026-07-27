import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApiClient, ApiHttpError } from "./index";

describe("createApiClient().get — headers option", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  });

  it("merges custom headers with the Authorization header", async () => {
    const client = createApiClient("http://api.test", () => "tok123");
    await client.get("/venues", { headers: { "X-User-Location": "40.99,29.02" } });
    expect(global.fetch).toHaveBeenCalledWith(
      "http://api.test/venues",
      expect.objectContaining({
        headers: { Authorization: "Bearer tok123", "X-User-Location": "40.99,29.02" },
      }),
    );
  });

  it("works with no custom headers (existing behavior unchanged)", async () => {
    const client = createApiClient("http://api.test");
    await client.get("/venues");
    expect(global.fetch).toHaveBeenCalledWith("http://api.test/venues", expect.objectContaining({ headers: {} }));
  });
});

describe("createApiClient — non-ok responses throw ApiHttpError carrying the status code", () => {
  it("get() throws an ApiHttpError with the response's status on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "Not Found" });
    const client = createApiClient("http://api.test");
    const error = await client.get("/venues/missing").catch((e) => e);
    expect(error).toBeInstanceOf(ApiHttpError);
    expect((error as ApiHttpError).status).toBe(404);
  });

  it("get() throws an ApiHttpError with the response's status on a 500", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "Internal Error" });
    const client = createApiClient("http://api.test");
    const error = await client.get("/venues").catch((e) => e);
    expect(error).toBeInstanceOf(ApiHttpError);
    expect((error as ApiHttpError).status).toBe(500);
  });

  it("post() throws an ApiHttpError with the response's status", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => "Bad Request" });
    const client = createApiClient("http://api.test");
    const error = await client.post("/me/lists", { name: "x" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiHttpError);
    expect((error as ApiHttpError).status).toBe(400);
  });

  it("get() still throws an ApiHttpError carrying the correct status even if reading the error body itself rejects", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.reject(new Error("body stream errored")),
    });
    const client = createApiClient("http://api.test");
    const error = await client.get("/venues/missing").catch((e) => e);
    expect(error).toBeInstanceOf(ApiHttpError);
    expect((error as ApiHttpError).status).toBe(404);
  });

  it("post() still throws an ApiHttpError carrying the correct status even if reading the error body itself rejects", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.reject(new Error("body stream errored")),
    });
    const client = createApiClient("http://api.test");
    const error = await client.post("/me/lists", { name: "x" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiHttpError);
    expect((error as ApiHttpError).status).toBe(500);
  });
});
