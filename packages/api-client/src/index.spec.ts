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

describe("createApiClient().get — Next.js data-cache revalidate option", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  });

  // Next 15+ no longer caches a bare fetch(). Server-rendered callers opt back in per call so a busy
  // page doesn't hit the API on every request (all SSR traffic shares one IP in the API's rate limit).
  it("forwards next.revalidate to fetch so the Next.js data cache can honour it", async () => {
    const client = createApiClient("http://api.test");
    await client.get("/districts", { next: { revalidate: 300 } });
    expect(global.fetch).toHaveBeenCalledWith(
      "http://api.test/districts",
      expect.objectContaining({ next: { revalidate: 300 } }),
    );
  });

  it("does not add a `next` key to fetch when the caller did not ask for one", async () => {
    const client = createApiClient("http://api.test");
    await client.get("/venues");
    const init = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(init).not.toHaveProperty("next");
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

  it("put() throws an ApiHttpError with the response's status", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 409, text: async () => "Conflict" });
    const client = createApiClient("http://api.test");
    const error = await client.put("/admin/users/u1/roles", { role: "curator" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiHttpError);
    expect((error as ApiHttpError).status).toBe(409);
  });
});

describe("createApiClient().put", () => {
  it("sends a JSON body with the Authorization header and returns the parsed response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "u1", role: "CURATOR" }) });
    const client = createApiClient("http://api.test", () => "tok123");
    const result = await client.put("/admin/users/u1/roles", { role: "curator" });
    expect(result).toEqual({ id: "u1", role: "CURATOR" });
    expect(global.fetch).toHaveBeenCalledWith(
      "http://api.test/admin/users/u1/roles",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer tok123" },
        body: JSON.stringify({ role: "curator" }),
      }),
    );
  });
});
