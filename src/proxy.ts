import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { inspectRequestComponents } from '@/lib/waf';
import { consumeRateLimit } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { isSetupLocked } from '@/lib/setup';
import { evaluateSecurityRules } from '@/lib/securityRules';
import { getCachedSecurityRulesSync, recordRuleHitInMemory } from '@/db/repositories/securityRules.repo';
import { telemetryBuffer } from '@/server/telemetryBuffer';

/**
 * Next.js 16 Global Proxy (Edge / Pre-routing Defense Layer).
 *
 * Intercepts incoming requests before route dispatch:
 * 1. Generates x-orbit-request-id, x-orbit-start-time, x-orbit-client-ip, x-orbit-risk-score tracing headers.
 * 2. Evaluates dynamic security rules in <50µs.
 * 3. Enforces permanent setup lockdown (returns 404/403 for /setup or /api/setup/*).
 * 4. Enforces global rate-limiting on authentication routes (/api/auth/).
 * 5. Executes pure WAF inspection on path, query, and user-agent.
 * 6. Catches AI bots, recon fuzzers, and canary triggers.
 */
export function proxy(request: NextRequest) {
	const { pathname, search } = request.nextUrl;
	const ip = clientAddress(request);
	const requestId = crypto.randomUUID();
	const startTime = Date.now();
	let cachedUserAgent: string | null | undefined;
	const getUserAgent = () =>
		cachedUserAgent === undefined
			? (cachedUserAgent = request.headers.get('user-agent'))
			: cachedUserAgent;

	const requestHeaders = new Headers(request.headers);
	requestHeaders.delete('x-orbit-connecting-ip');
	requestHeaders.delete('x-canary-original-path');
	requestHeaders.delete('x-canary-signature');
	if (requestHeaders.has('x-appsec-probe') && !requestHeaders.has('cookie') && !requestHeaders.has('x-session-token')) {
		requestHeaders.delete('x-appsec-probe');
	}
	requestHeaders.set('x-orbit-request-id', requestId);
	requestHeaders.set('x-orbit-start-time', String(startTime));
	requestHeaders.set('x-orbit-client-ip', ip);
	requestHeaders.set('x-orbit-risk-score', '0');

	// Helper to send proxy response and enqueue telemetry
	const emitProxyBlock = (status: 403 | 429, error: string, retryAfter?: number) => {
		try {
			telemetryBuffer.enqueue({
				timestamp: Date.now(),
				method: request.method,
				path: pathname,
				statusCode: status,
				latencyMs: Math.max(1, Date.now() - startTime),
				ip,
				userAgent: getUserAgent() || undefined,
				riskScore: 100,
				requestId,
				detail: { blockedBy: 'proxy', reason: error },
			});
		} catch {
			// ignore
		}

		const headers: Record<string, string> = {
			'x-orbit-request-id': requestId,
			'x-orbit-logged': '1',
		};
		if (retryAfter) {
			headers['Retry-After'] = String(retryAfter);
		}

		return NextResponse.json({ error }, { status, headers });
	};

	// Honeypot itself passes directly to its route handler
	if (pathname === '/api/admin/config') {
		return NextResponse.next({ request: { headers: requestHeaders } });
	}

	// 1. Dynamic Security Rules Evaluation (<50µs)
	const activeRules = getCachedSecurityRulesSync();
	let bypassWaf = false;

	if (activeRules.length > 0) {
		const ruleResult = evaluateSecurityRules(activeRules, {
			ip,
			pathname,
			method: request.method,
			search,
			headers: request.headers,
		});

		if (ruleResult.matched && ruleResult.rule) {
			recordRuleHitInMemory(ruleResult.rule.id);

			if (ruleResult.action === 'block') {
				return emitProxyBlock(403, `Blocked by security rule: ${ruleResult.rule.name}`);
			} else if (ruleResult.action === 'rate_limit') {
				const limit = Number(ruleResult.actionConfig?.limit ?? 30);
				const windowMs = Number(ruleResult.actionConfig?.windowMs ?? 60_000);
				const rl = consumeRateLimit(`rule:${ruleResult.rule.id}:${ip}`, limit, windowMs);
				if (!rl.allowed) {
					return emitProxyBlock(429, 'Rate limit exceeded by security rule.', rl.retryAfter);
				}
			} else if (ruleResult.action === 'score') {
				const currentScore = Number(requestHeaders.get('x-orbit-risk-score') || '0');
				const newScore = currentScore + (ruleResult.scoreIncrement ?? 20);
				requestHeaders.set('x-orbit-risk-score', String(newScore));
			} else if (ruleResult.action === 'honeypot') {
				const honeypotUrl = new URL('/api/admin/config', request.url);
				requestHeaders.set('x-canary-original-path', pathname);
				requestHeaders.set('x-canary-signature', `RULE:${ruleResult.rule.name}`);
				return NextResponse.rewrite(honeypotUrl, { request: { headers: requestHeaders } });
			} else if (ruleResult.action === 'allow') {
				bypassWaf = true;
			}
		}
	}

	// 2. CSRF Defense-in-Depth (W3C Fetch Metadata): Reject cross-site mutating requests on private API routes
	const method = request.method.toUpperCase();
	const isMutating =
		method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
	if (isMutating && pathname.startsWith('/api/') && !pathname.startsWith('/api/public/')) {
		const secFetchSite = request.headers.get('sec-fetch-site');
		if (secFetchSite === 'cross-site') {
			return emitProxyBlock(403, 'Cross-site mutating requests are forbidden.');
		}
	}

	// 3. Setup permanent lockdown
	if ((pathname.startsWith('/setup') || pathname.startsWith('/api/setup')) && isSetupLocked()) {
		if (pathname === '/setup' || pathname.startsWith('/setup/')) {
			return NextResponse.json({ error: 'Not found' }, { status: 404 });
		}
		if (pathname.startsWith('/api/setup/') || (pathname === '/api/setup' && method !== 'GET')) {
			return emitProxyBlock(403, 'Setup is locked and permanently disabled.');
		}
	}

	// 3. Global auth rate-limiting
	if (!bypassWaf && pathname.startsWith('/api/auth/') && pathname !== '/api/auth/me') {
		const r = consumeRateLimit(`auth:global:${ip}`, 30, 60_000);
		if (!r.allowed) {
			return emitProxyBlock(429, 'Too many requests.', r.retryAfter);
		}
	}

	// 4. Pure WAF inspection
	if (!bypassWaf) {
		const waf = inspectRequestComponents({
			pathname,
			search,
			userAgent: getUserAgent(),
			referer: request.headers.get('referer'),
		});

		if (waf.points > 0) {
			const currentScore = Number(requestHeaders.get('x-orbit-risk-score') || '0');
			requestHeaders.set('x-orbit-risk-score', String(currentScore + waf.points));
		}

		// AI Recon / Canary / Scanner auto-trap
		if (waf.matched && (waf.category === 'scanner' || waf.points >= 100)) {
			const honeypotUrl = new URL('/api/admin/config', request.url);
			requestHeaders.set('x-canary-original-path', pathname);
			requestHeaders.set('x-canary-signature', waf.signature || 'WAF_SUSPICIOUS');

			return NextResponse.rewrite(honeypotUrl, {
				request: {
					headers: requestHeaders,
				},
			});
		}

		// Active edge blocking for high-confidence exploit probes (SQLi, Path Traversal, CMD/SSTI, XSS)
		if (waf.matched) {
			return emitProxyBlock(403, `Blocked by edge WAF: ${waf.signature || waf.category || 'malicious_payload'}`);
		}
	}

	return NextResponse.next({
		request: {
			headers: requestHeaders,
		},
	});
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
