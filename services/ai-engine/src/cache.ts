const cache = new Map<string, { at: number; value: unknown }>();

export function cacheKey(parts: Array<string | number | undefined>): string {
  return parts.map((p) => String(p ?? '')).join('|');
}

export function getCached<T>(key: string): T | undefined {
  const hit = cache.get(key);
  return hit?.value as T | undefined;
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, { at: Date.now(), value });
}

export function clearAiCache(): void {
  cache.clear();
}
