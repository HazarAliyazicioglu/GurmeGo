export interface CacheStore {
  increment(key: string, windowSeconds: number): Promise<number>;
}
export const CACHE_STORE = Symbol("CACHE_STORE");
