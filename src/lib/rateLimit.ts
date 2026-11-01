/**
 * Minimal in-process rate limiter for actions that reach outside the server
 * (currently the SMTP test send, which opens a real connection).
 *
 * Scope and limits: the bucket lives in module state, so it is per-process and
 * resets on restart. That is adequate for a single-container deployment holding
 * back a fat-fingered admin; a multi-instance deployment would need shared state.
 */

interface Bucket {
	count: number;
	resetAt: number;
}

const g = globalThis as typeof globalThis & { __orbitRateLimitBuckets?: Map<string, Bucket> };
const buckets = (g.__orbitRateLimitBuckets ??= new Map<string, Bucket>());
const MAX_BUCKETS = 10_000;

function enforceMaxBuckets(): void {
	if (buckets.size < MAX_BUCKETS) return;
	pruneRateLimits();
	if (buckets.size < MAX_BUCKETS) return;

	// Drop oldest 1000 buckets to prevent heap exhaustion
	let dropCount = 1000;
	for (const key of buckets.keys()) {
		buckets.delete(key);
		if (--dropCount <= 0) break;
	}
}

export interface RateLimitResult {
	allowed: boolean;
	/** Seconds until the window resets — only meaningful when `allowed` is false. */
	retryAfter: number;
}

/**
 * Consumes one unit for `key`.
 *
 * @param limit     maximum calls allowed inside the window
 * @param windowMs  window length in milliseconds
 */
export function consumeRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
	const now = Date.now();
	const bucket = buckets.get(key);

	if (!bucket || bucket.resetAt <= now) {
		enforceMaxBuckets();
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		return { allowed: true, retryAfter: 0 };
	}

	if (bucket.count >= limit) {
		return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
	}

	bucket.count += 1;
	return { allowed: true, retryAfter: 0 };
}

/** Drops expired buckets so the map cannot grow unbounded. */
export function pruneRateLimits(): void {
	const now = Date.now();
	for (const [key, bucket] of buckets) {
		if (bucket.resetAt <= now) buckets.delete(key);
	}
}

// Public endpoints key buckets by caller address, so the map grows with every distinct
// visitor. Nothing else prunes it, so the module does — once a minute, and without
// keeping the process alive.
const PRUNE_INTERVAL_MS = 60_000;
const pruneTimer = setInterval(pruneRateLimits, PRUNE_INTERVAL_MS);
pruneTimer.unref?.();

/* ==================== failure counting ==================== */

/**
 * Checks whether `key` is currently over its limit, without consuming anything.
 *
 * Use this to gate an action whose *failures* should count — a login attempt that
 * succeeds must not burn quota, so the counter is incremented by `recordFailure`
 * only after the attempt is known to have failed.
 */
export function isRateLimited(key: string, limit: number): RateLimitResult {
	const bucket = buckets.get(key);
	const now = Date.now();

	if (!bucket || bucket.resetAt <= now) return { allowed: true, retryAfter: 0 };
	if (bucket.count >= limit) {
		return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
	}
	return { allowed: true, retryAfter: 0 };
}

/**
 * Counts one failure against `key`.
 *
 * The window is only started by the first failure in a burst, so a slow trickle
 * of attempts spread over hours does not accumulate into a lockout.
 */
export function recordFailure(key: string, windowMs: number): number {
	const now = Date.now();
	const bucket = buckets.get(key);

	if (!bucket || bucket.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		return 1;
	}
	bucket.count += 1;
	return bucket.count;
}

/** Forgets a key — called after a successful attempt so the counter resets. */
export function clearRateLimit(key: string): void {
	buckets.delete(key);
}

export interface ActiveRateLimit {
	key: string;
	count: number;
	limit?: number;
	resetAt: number;
	retryAfter: number;
}

/**
 * Returns all active rate limits currently in memory for SoC telemetry.
 * Automatically purges any expired buckets encountered during scan.
 */
export function getActiveRateLimits(): ActiveRateLimit[] {
	const now = Date.now();
	const result: ActiveRateLimit[] = [];
	for (const [key, bucket] of buckets) {
		if (bucket.resetAt > now) {
			result.push({
				key,
				count: bucket.count,
				resetAt: bucket.resetAt,
				retryAfter: Math.max(0, Math.ceil((bucket.resetAt - now) / 1000)),
			});
		} else {
			buckets.delete(key);
		}
	}
	return result.sort((a, b) => b.count - a.count);
}

/**
 * Resets / unthrottles a rate limit key.
 * @returns true if the key was active and was removed, false otherwise.
 */
export function resetRateLimit(key: string): boolean {
	return buckets.delete(key);
}

