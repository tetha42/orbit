/**
 * Global In-Memory TTL Cache for Server-Side Route Handlers
 * 
 * Provides ultra-fast (sub-millisecond) responses for read-heavy, rarely-changing
 * metadata (e.g. roles, club settings) and supports immediate cache invalidation
 * on mutations (POST, PATCH, DELETE).
 */

interface CacheEntry<T> {
	data: T;
	expiresAt: number;
}

const globalStore = globalThis as typeof globalThis & {
	__appInMemoryCache?: Map<string, CacheEntry<unknown>>;
};

if (!globalStore.__appInMemoryCache) {
	globalStore.__appInMemoryCache = new Map();
}

const cache = globalStore.__appInMemoryCache;

/**
 * Get cached item if it exists and has not expired.
 */
export function getCached<T>(key: string): T | null {
	const entry = cache.get(key);
	if (!entry) return null;
	if (Date.now() > entry.expiresAt) {
		cache.delete(key);
		return null;
	}
	return entry.data as T;
}

/**
 * Set item in cache with a TTL (default: 60 seconds).
 */
export function setCached<T>(key: string, data: T, ttlMs = 60_000): void {
	cache.set(key, {
		data,
		expiresAt: Date.now() + ttlMs,
	});
}

/**
 * Immediately invalidate exact key or all keys starting with prefix.
 */
export function invalidateCache(keyPrefix: string): void {
	for (const key of cache.keys()) {
		if (key === keyPrefix || key.startsWith(`${keyPrefix}:`)) {
			cache.delete(key);
		}
	}
}
