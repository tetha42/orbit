import { NextResponse } from 'next/server';
import type { User } from '@/db/schema';
import { SESSION_COOKIE } from '../session';

export interface AuthResultSuccess {
	authorized: true;
	user: User;
	response?: never;
}

export interface AuthResultFailure {
	authorized: false;
	user: null;
	response: NextResponse;
}

export type AuthResult = AuthResultSuccess | AuthResultFailure;

export const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isTestEnvironment(): boolean {
	return (
		process.env.NODE_ENV === 'test' ||
		process.env.ORBIT_TEST === '1' ||
		process.env.TEST_MODE === '1'
	);
}

/**
 * Verifies that state-changing browser requests originate from the same site.
 * Blocks Cross-Site Request Forgery (CSRF) via `Sec-Fetch-Site` and `Origin` headers.
 */
export function isCsrfBlocked(request: Request): { blocked: boolean; reason?: string } {
	const method = (request.method || 'GET').toUpperCase();
	if (!MUTATING_METHODS.has(method)) {
		return { blocked: false };
	}

	const secFetchSite = request.headers.get('sec-fetch-site')?.toLowerCase();
	if (secFetchSite === 'cross-site') {
		return { blocked: true, reason: 'sec-fetch-site: cross-site' };
	}

	const origin = request.headers.get('origin');
	if (origin && origin !== 'null') {
		try {
			const originHost = new URL(origin).host.toLowerCase();
			const reqHost = (request.headers.get('host') || new URL(request.url).host || '').toLowerCase();
			const configuredSite = process.env.NEXT_PUBLIC_SITE_URL
				? new URL(process.env.NEXT_PUBLIC_SITE_URL).host.toLowerCase()
				: '';
			if (reqHost && originHost !== reqHost && (!configuredSite || originHost !== configuredSite)) {
				return { blocked: true, reason: `origin mismatch (${originHost} !== ${reqHost})` };
			}
		} catch {
			return { blocked: true, reason: 'malformed origin header' };
		}
	}

	return { blocked: false };
}

const SESSION_COOKIE_RE = new RegExp(`${SESSION_COOKIE}=([^;]+)`);
const SESSION_TOKEN_RE = /^[A-Za-z0-9_-]+$/;

/** The session token from the `x-session-token` header or the session cookie. */
export function readSessionToken(request: Request): string | null {
	const fromHeader = request.headers.get('x-session-token');
	const cookieHeader = fromHeader ? '' : request.headers.get('cookie') || '';
	const match = fromHeader || !cookieHeader ? null : cookieHeader.match(SESSION_COOKIE_RE);
	const raw = (fromHeader || (match ? match[1] : '')).trim();
	if (!raw || raw.length < 16 || raw.length > 128 || !SESSION_TOKEN_RE.test(raw)) {
		return null;
	}
	return raw;
}
