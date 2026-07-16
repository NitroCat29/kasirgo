// ============================================================
// KasirGo — In-memory search cache (TTL-based)
// ============================================================
// Cache sederhana untuk hasil query search produk per toko.
// Non-persistent — cukup untuk load burst. Invalidate saat mutasi produk.
//
// Key format: `produk:<toko_id>:<normalized_query>`
// Normalisasi: trim + lowercase + collapse whitespace.

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 10_000; // 10 detit

function normalizeKey(tokoId: string, query: string): string {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  return `produk:${tokoId}:${q}`;
}

export function searchCacheGet<T>(tokoId: string, query: string, ttlMs = DEFAULT_TTL_MS): T | undefined {
  const key = normalizeKey(tokoId, query);
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > ttlMs) {
    cache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

export function searchCacheSet<T>(tokoId: string, query: string, data: T): void {
  const key = normalizeKey(tokoId, query);
  cache.set(key, { data, ts: Date.now() });
}

// Invalidate semua entry produk untuk toko tertentu (saat POST/PATCH/DELETE produk)
export function searchCacheInvalidateToko(tokoId: string): void {
  const prefix = `produk:${tokoId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

// Invalidate semua (fallback global)
export function searchCacheClear(): void {
  cache.clear();
}
