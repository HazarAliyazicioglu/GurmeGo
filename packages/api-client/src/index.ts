export * from "./generated-types";

// Carries the HTTP status code alongside the error so callers can distinguish a genuine 404
// (not-found) from any other failure (5xx, network error, etc). Before this existed, every
// non-ok response surfaced as a plain `Error`, which meant callers that wanted "treat 404 as
// null" (e.g. the venue detail page) had no way to do that without ALSO swallowing real outages
// as if the resource didn't exist -- a wrong error page for the user and a masked incident for us.
export class ApiHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiHttpError";
  }
}

export function createApiClient(baseUrl: string, getToken?: () => string | undefined) {
  return {
    // `next` is Next.js's fetch extension (data cache). It is inert in browsers and Node, so this
    // package stays framework-agnostic; server-rendered callers opt into a TTL per call because
    // Next 15+ no longer caches a bare fetch().
    async get<T>(
      path: string,
      options?: { headers?: Record<string, string>; next?: { revalidate?: number | false } },
    ): Promise<T> {
      const token = getToken?.();
      const res = await fetch(`${baseUrl}${path}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
        ...(options?.next ? { next: options.next } : {}),
      } as RequestInit);
      // Reading the error body can itself fail (rare, but possible with a malformed/truncated
      // response) -- fall back to an empty string body rather than losing the known `res.status`
      // to a generic, uncategorized error.
      if (!res.ok) throw new ApiHttpError(res.status, `API error ${res.status}: ${await res.text().catch(() => "")}`);
      return res.json();
    },
    async post<T>(path: string, body: unknown): Promise<T> {
      const token = getToken?.();
      const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new ApiHttpError(res.status, `API error ${res.status}: ${await res.text().catch(() => "")}`);
      return res.json();
    },
  };
}
