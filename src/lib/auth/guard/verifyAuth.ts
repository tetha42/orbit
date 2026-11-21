import { NextResponse } from 'next/server';
import { getUserBySessionToken } from '@/db';
import { clientAddress } from '@/lib/http';
import { consumeRateLimit } from '@/lib/rateLimit';
import { inspectRequestPayload } from '@/lib/waf';
import { ADMIN_ROLE_ID } from '@/core/permissions';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { getLockdownState, isIpBanned, recordSecurityStrike, recordSessionActivity } from '@/db/repositories/security.repo';
import { SESSION_COOKIE } from '../session';
import { type AuthResult, isCsrfBlocked, MUTATING_METHODS, readSessionToken } from './helpers';
import { isAuthorizedAppSecProbe } from './probeAuth';

const requestAuthCache = new WeakMap<Request, Promise<AuthResult>>();

/**
 * Session only: who is calling, and is the account usable.
 * Permissions are checked by `requireApp` / `can` in ./access.
 */
export function verifyAuth(request: Request): Promise<AuthResult> {
	const cached = requestAuthCache.get(request);
	if (cached) return cached;
	const promise = verifyAuthUncached(request);
	requestAuthCache.set(request, promise);
	return promise;
}

async function verifyAuthUncached(request: Request): Promise<AuthResult> {
	try {
		const ip = clientAddress(request);
		const pathname = new URL(request.url).pathname;

		const banStatus = await isIpBanned(ip);
		if (banStatus.banned) {
			return {
				authorized: false,
				user: null,
				response: NextResponse.json(
					{ error: 'Your IP address has been temporarily quarantined due to security policy.' },
					{ status: 403 }
				),
			};
		}

		const waf = inspectRequestPayload(request);
		if (waf.matched) {
			const isProbe = await isAuthorizedAppSecProbe(request);
			// Only log external attacks to the database; verified internal security probes skip DB writes.
			if (!isProbe) {
				void logSystemEvent({
					service: 'security',
					level: 'ERROR',
					message: `[WAF] Attack signature blocked (${waf.signature}): ${request.method} ${pathname}`,
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
			return {
				authorized: false,
				user: null,
				response: NextResponse.json(
					{ error: 'Suspicious request blocked by Web Application Firewall (WAF).' },
					{ status: 403 }
				),
			};
		}

		const csrf = isCsrfBlocked(request);
		if (csrf.blocked) {
			void logSystemEvent({
				service: 'security',
				level: 'WARN',
				message: `CSRF / Cross-Origin request blocked: ${request.method} ${pathname}`,
				detail: { reason: csrf.reason, origin: request.headers.get('origin') },
				ip,
			});
			void recordSecurityStrike({
				ip,
				points: 35,
				reason: `CSRF (${csrf.reason})`,
				path: pathname,
			});
			return {
				authorized: false,
				user: null,
				response: NextResponse.json({ error: 'Security verification failed (Cross-Origin request rejected).' }, { status: 403 }),
			};
		}

		const sessionToken = readSessionToken(request);
		if (!sessionToken) {
			return {
				authorized: false,
				user: null,
				response: NextResponse.json({ error: 'Authentication is required for this operation.' }, { status: 401 }),
			};
		}

		const user = await getUserBySessionToken(sessionToken);
		if (!user) {
			const method = (request.method || 'GET').toUpperCase();
			if (MUTATING_METHODS.has(method) || request.headers.has('x-session-token')) {
				if (consumeRateLimit(`log:bad_session:${ip}`, 10, 60_000).allowed) {
					void logSystemEvent({
						service: 'auth',
						level: 'WARN',
						message: `Operation attempt with invalid or expired session token: ${method} ${pathname}`,
						ip,
					});
				}
				void recordSecurityStrike({
					ip,
					points: 15,
					reason: 'Invalid session token attempt',
					path: pathname,
				});
			}
			const res = NextResponse.json({ error: 'Session expired or signed in from another device.' }, { status: 401 });
			res.cookies.delete(SESSION_COOKIE);
			return { authorized: false, user: null, response: res };
		}

		// Alumni keep a read-only session; routes refuse their writes.
		if (user.status !== 'active' && user.status !== 'alumni') {
			const res = NextResponse.json({ error: 'Your account is not active.' }, { status: 403 });
			res.cookies.delete(SESSION_COOKIE);
			return { authorized: false, user: null, response: res };
		}

		if (user.roleId !== ADMIN_ROLE_ID) {
			const lockdown = await getLockdownState();
			if (lockdown.active) {
				return {
					authorized: false,
					user: null,
					response: NextResponse.json(
						{
							error: 'System is currently in Shield Mode (Lockdown) under cyber defense. Only administrators can access.',
							code: 'LOCKDOWN_ACTIVE',
							defcon: 1,
						},
						{ status: 503 }
					),
				};
			}
		}

		const sessionCheck = recordSessionActivity(user, ip);
		if (sessionCheck.suspiciousJump) {
			const reqUa = request.headers.get('user-agent') || '';
			const matchesUa = Boolean(user.lastLoginUserAgent && reqUa && user.lastLoginUserAgent === reqUa);
			if (!matchesUa) {
				void recordSecurityStrike({
					ip,
					points: 30,
					reason: 'Session IP jump (suspected Pass-the-Cookie)',
					path: pathname,
					userId: user.id,
				});
			}
			const res = NextResponse.json(
				{
					error: 'Your current IP address does not match your login network. Session frozen by Pass-the-Cookie protection; please sign in again.',
					code: 'SESSION_IP_MISMATCH',
				},
				{ status: 401 }
			);
			res.cookies.delete(SESSION_COOKIE);
			return { authorized: false, user: null, response: res };
		}

		return { authorized: true, user };
	} catch {
		return {
			authorized: false,
			user: null,
			response: NextResponse.json({ error: 'An error occurred during authorization check.' }, { status: 500 }),
		};
	}
}
