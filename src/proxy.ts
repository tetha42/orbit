import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { inspectRequestComponents } from '@/lib/waf';
import { consumeRateLimit } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';

/**
 * Next.js 16 Global Proxy (Edge / Pre-routing Defense Layer).
 *
 * Intercepts incoming requests before route dispatch:
 * 1. Enforces global rate-limiting on authentication routes (/api/auth/).
 * 2. Executes pure WAF inspection on path, query, and user-agent.
 * 3. Catches AI bots, recon fuzzers, and canary triggers (e.g. /.env, /.git, /wp-login.php).
 * 4. Transparently rewrites malicious recon probes to the honeypot canary handler (/api/admin/config),
 *    which logs the strike to PostgreSQL and automatically quarantines the attacker's IP.
 */
export function proxy(request: NextRequest) {
	const { pathname, search } = request.nextUrl;

	// Honeypot itself passes directly to its route handler
	if (pathname === '/api/admin/config') {
		return NextResponse.next();
	}

	if (pathname.startsWith('/api/auth/')) {
		const ip = clientAddress(request);
		const r = consumeRateLimit(`auth:global:${ip}`, 30, 60_000);
		if (!r.allowed) {
			return NextResponse.json(
				{ error: 'Too many requests.' },
				{ status: 429, headers: { 'Retry-After': String(r.retryAfter) } }
			);
		}
	}

	const waf = inspectRequestComponents({
		pathname,
		search,
		userAgent: request.headers.get('user-agent'),
		referer: request.headers.get('referer'),
	});

	// AI Recon / Canary / Scanner auto-trap
	if (waf.matched && (waf.category === 'scanner' || waf.points >= 100)) {
		const honeypotUrl = new URL('/api/admin/config', request.url);
		const requestHeaders = new Headers(request.headers);
		requestHeaders.set('x-canary-original-path', pathname);
		requestHeaders.set('x-canary-signature', waf.signature);

		return NextResponse.rewrite(honeypotUrl, {
			request: {
				headers: requestHeaders,
			},
		});
	}

	return NextResponse.next();
}

export default proxy;

export const config = {
	matcher: [
		/*
		 * Match all request paths except:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 */
		'/((?!_next/static|_next/image|favicon.ico).*)',
	],
};
