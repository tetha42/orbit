import type { CacheEntry } from './types';

const SESSION_CACHE_PREFIX = 'orbit_cache:';
const DEFAULT_SESSION_ROUTES = ['/api/roles', '/api/registration-config', '/api/form-fields'];

export function shouldPersist(url: string | null, persistSession?: boolean): boolean {
	if (!url) return false;
	if (persistSession !== undefined) return persistSession;
	return DEFAULT_SESSION_ROUTES.some((route) => url.startsWith(route));
}

export function getSessionCache<T>(url: string): CacheEntry<T> | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.sessionStorage.getItem(SESSION_CACHE_PREFIX + url);
		if (!raw) return null;
		return JSON.parse(raw) as CacheEntry<T>;
	} catch {
		return null;
	}
}

export function setSessionCache<T>(url: string, entry: CacheEntry<T>): void {
	if (typeof window === 'undefined') return;
	try {
		window.sessionStorage.setItem(SESSION_CACHE_PREFIX + url, JSON.stringify(entry));
	} catch {
		// Ignore quota exceeded or storage disabled
	}
}

export function removeSessionCache(url: string): void {
	if (typeof window === 'undefined') return;
	try {
		window.sessionStorage.removeItem(SESSION_CACHE_PREFIX + url);
	} catch {
		// Ignore
	}
}

export function clearSessionCacheByPattern(pattern: string | RegExp): void {
	if (typeof window === 'undefined') return;
	try {
		const keysToRemove: string[] = [];
		for (let i = 0; i < window.sessionStorage.length; i++) {
			const key = window.sessionStorage.key(i);
			if (key && key.startsWith(SESSION_CACHE_PREFIX)) {
				const url = key.slice(SESSION_CACHE_PREFIX.length);
				const matches = typeof pattern === 'string' ? url.startsWith(pattern) : pattern.test(url);
				if (matches) keysToRemove.push(key);
			}
		}
		for (const key of keysToRemove) {
			window.sessionStorage.removeItem(key);
		}
	} catch {
		// Ignore
	}
}
