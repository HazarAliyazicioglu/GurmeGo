export * from "./generated-types";

export function createApiClient(baseUrl: string, getToken?: () => string | undefined) {
  return {
    async get<T>(path: string): Promise<T> {
      const token = getToken?.();
      const res = await fetch(`${baseUrl}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
      return res.json();
    },
  };
}
