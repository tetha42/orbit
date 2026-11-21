import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { clientAddress } from '@/lib/http';
import { consumeRateLimit } from '@/lib/rateLimit';
import { inspectRequestPayload } from '@/lib/waf';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { isIpBanned, recordSecurityStrike } from '@/db/repositories/security.repo';

/**
 * Plumbing shared by the public, read-only API (`/api/public/v1/*`) that the static
 * landing site reads. No cookies, no sessions: what it serves is what the whole
 * world may see, so the concerns here are cross-origin access, caching and abuse.
 *
 * Contract: `docs/PUBLIC_API.md`.
 */

/** Browsers and the CDN may reuse an answer for a minute, the CDN for five, and serve a stale one while refreshing. */
const CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

const REQUESTS_PER_WINDOW = 120;
const WINDOW_MS = 60_000;

/** The exact origins (scheme://host[:port], no trailing slash) allowed to read this API from a browser. */
function allowedOrigins(): string[] {
	// Read per request, not at import: the value is deployment configuration.
	return (process.env.PUBLIC_API_ALLOWED_ORIGINS ?? '')
		.split(',')
		.map((origin) => origin.trim().replace(/\/+$/, ''))
		.filter(Boolean);
}

function isAllowedOrigin(origin: string): boolean {
	if (allowedOrigins().includes(origin)) return true;
	try {
		const { hostname } = new URL(origin);
		if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') return true;
		if (hostname.endsWith('.orbit.local') || hostname === 'orbit.local') return true;
	} catch {
		return false;
	}
	return false;
}

/**
 * CORS headers for this request. The origin is echoed only when it is on the
 * allow-list (never `*`), and `Vary: Origin` is always sent so a cache cannot hand
 * one origin's answer to another.
 */
function corsHeaders(request: Request): Record<string, string> {
	const headers: Record<string, string> = { Vary: 'Origin' };
	const origin = request.headers.get('origin');
	if (origin && isAllowedOrigin(origin)) {
		headers['Access-Control-Allow-Origin'] = origin;
		headers['Access-Control-Expose-Headers'] = 'ETag, Retry-After';
	}
	return headers;
}

/** Answer to a CORS preflight (`OPTIONS`). */
export function publicPreflight(request: Request): NextResponse {
	return new NextResponse(null, {
		status: 204,
		headers: {
			...corsHeaders(request),
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Accept, If-None-Match',
			'Access-Control-Max-Age': '86400',
		},
	});
}

/** An error in the API's envelope: `{ error: { code, message } }`. Never cached. */
export function publicError(request: Request, status: number, code: string, message: string, extra: Record<string, string> = {}): NextResponse {
	return NextResponse.json(
		{ error: { code, message } },
		{ status, headers: { ...corsHeaders(request), 'Cache-Control': 'no-store', ...extra } }
	);
}

/** A rate-limit and security refusal if this caller is banned, triggered WAF, or exceeded limit. */
export async function limitPublic(request: Request): Promise<NextResponse | null> {
	const ip = clientAddress(request);
	const pathname = new URL(request.url).pathname;

	// 1. IP Ban check
	const ban = await isIpBanned(ip);
	if (ban.banned) {
		return publicError(request, 403, 'ip_banned', 'Your IP address has been quarantined by the security policy.');
	}

	// 2. WAF check
	const waf = inspectRequestPayload(request);
	if (waf.matched) {
		const { isAuthorizedAppSecProbe } = await import('@/lib/auth/guard/probeAuth');
		const isProbe = await isAuthorizedAppSecProbe(request);
		// Only genuine external attacks are logged to the database; verified test probes do not pollute the DB.
		if (!isProbe) {
			void logSystemEvent({
				service: 'security',
				level: 'ERROR',
				message: `[WAF] Public API attack signature blocked (${waf.signature}): ${request.method} ${pathname}`,
				detail: { category: waf.category, signature: waf.signature, url: request.url.slice(0, 240) },
				ip,
			});
			void recordSecurityStrike({
				ip,
				points: waf.points,
				reason: `WAF: ${waf.signature}`,
				path: pathname,
			});
		}
		return publicError(request, 403, 'waf_blocked', 'The request was blocked as suspicious by the web application firewall (WAF).');
	}

	// 3. Rate limit check
	const result = consumeRateLimit(`public-api:${ip}`, REQUESTS_PER_WINDOW, WINDOW_MS);
	if (result.allowed) return null;
	return publicError(request, 429, 'rate_limited', 'Too many requests. Please try again later.', {
		'Retry-After': String(result.retryAfter),
	});
}

/**
 * A successful answer. It carries a weak ETag of its body, and an unchanged
 * resource is answered with `304` and no body — the landing revalidates cheaply.
 * The body must therefore be a pure function of the data: no timestamps of "now".
 */
export function publicJson(request: Request, body: unknown): NextResponse {
	const payload = JSON.stringify(body);
	const etag = `W/"${createHash('sha1').update(payload).digest('base64url').slice(0, 27)}"`;
	const headers = {
		...corsHeaders(request),
		'Cache-Control': CACHE_CONTROL,
		ETag: etag,
		'Content-Language': 'tr',
	};

	const candidates = (request.headers.get('if-none-match') ?? '').split(',').map((tag) => tag.trim());
	if (candidates.includes(etag) || candidates.includes('*')) {
		return new NextResponse(null, { status: 304, headers });
	}
	return new NextResponse(payload, { status: 200, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}

/**
 * An image address a visitor of another site can load. The portal's own icon
 * presets (`/app-icons/…`) are interface art rather than article images, so they
 * are reported as "no image"; other relative paths are made absolute against the portal.
 */
export function publicImageUrl(imageUrl: string | null | undefined): string | null {
	if (!imageUrl || imageUrl.startsWith('/app-icons/')) return null;
	if (imageUrl.startsWith('/')) {
		const base = (process.env.PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
		return base ? `${base}${imageUrl}` : null;
	}
	return imageUrl;
}

export const isoDate = (ms: number | null | undefined): string | null => (ms == null ? null : new Date(Number(ms)).toISOString());
