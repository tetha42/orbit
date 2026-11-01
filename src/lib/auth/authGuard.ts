import { NextResponse } from 'next/server';
import { getUserBySessionToken } from '@/db';
import { User } from '@/db/schema';
import { clientAddress } from '@/lib/http';
import { consumeRateLimit } from '@/lib/rateLimit';
import { inspectRequestPayload } from '@/lib/waf';
import { ADMIN_ROLE_ID } from '@/core/permissions';
import { logSystemEvent } from '@/server/db/domains/logs.repo';
import { getLockdownState, isIpBanned, recordSecurityStrike, recordSessionActivity } from '@/server/db/domains/security.repo';
import { SESSION_COOKIE } from './session';

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

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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

/** The session token from the `x-session-token` header or the session cookie. */
export function readSessionToken(request: Request): string | null {
	const fromHeader = request.headers.get('x-session-token');
	const cookieHeader = request.headers.get('cookie') || '';
	const match = fromHeader
		? null
		: cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`)) ||
		  cookieHeader.match(/oturum_token=([^;]+)/);
	const raw = (fromHeader || (match ? match[1] : '')).trim();
	if (!raw || raw.length < 16 || raw.length > 128 || !/^[A-Za-z0-9_-]+$/.test(raw)) {
		return null;
	}
	return raw;
}

/**
 * Session only: who is calling, and is the account usable. What they may do
 * is decided by `requireApp` / `can` in ./access — routes call those, not this.
 */
export async function verifyAuth(request: Request): Promise<AuthResult> {
	try {
		const ip = clientAddress(request);
		const pathname = new URL(request.url).pathname;

		// 1. Check SoC IP Quarantine / Ban list
		const banStatus = await isIpBanned(ip);
		if (banStatus.banned) {
			return {
				authorized: false,
				user: null,
				response: NextResponse.json(
					{ error: 'IP adresiniz siber güvenlik politikası nedeniyle geçici olarak karantinaya alınmıştır.' },
					{ status: 403 }
				),
			};
		}

		// 2. WAF Payload & Offensive Scanner inspection
		const waf = inspectRequestPayload(request);
		if (waf.matched) {
			const isProbe = !!request.headers.get('x-appsec-probe');
			// Yalnızca gerçek dış saldırılar veritabanına loglanır; iç test probları DB'yi kirletmez
			if (!isProbe) {
				void logSystemEvent({
					servis: 'security',
					seviye: 'ERROR',
					mesaj: `[WAF] Attack signature blocked (${waf.signature}): ${request.method} ${pathname}`,
					detay: { category: waf.category, signature: waf.signature, url: request.url.slice(0, 240) },
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
					{ error: 'Güvenlik duvarı (WAF) tarafından şüpheli istek engellendi.' },
					{ status: 403 }
				),
			};
		}

		// 3. Cross-Site Request Forgery (CSRF) guard
		const csrf = isCsrfBlocked(request);
		if (csrf.blocked) {
			void logSystemEvent({
				servis: 'security',
				seviye: 'WARN',
				mesaj: `CSRF / Cross-Origin request blocked: ${request.method} ${pathname}`,
				detay: { reason: csrf.reason, origin: request.headers.get('origin') },
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
				response: NextResponse.json({ error: 'Güvenlik doğrulaması başarısız (Cross-Origin istek reddedildi).' }, { status: 403 }),
			};
		}

		const sessionToken = readSessionToken(request);
		if (!sessionToken) {
			return {
				authorized: false,
				user: null,
				response: NextResponse.json({ error: 'Bu işlem için oturum açmanız gerekmektedir.' }, { status: 401 }),
			};
		}

		const user = await getUserBySessionToken(sessionToken);
		if (!user) {
			const method = (request.method || 'GET').toUpperCase();
			if (MUTATING_METHODS.has(method) || request.headers.has('x-session-token')) {
				if (consumeRateLimit(`log:bad_session:${ip}`, 10, 60_000).allowed) {
					void logSystemEvent({
						servis: 'auth',
						seviye: 'WARN',
						mesaj: `Operation attempt with invalid or expired session token: ${method} ${pathname}`,
						ip,
					});
				}
				void recordSecurityStrike({
					ip,
					points: 15,
					reason: 'Geçersiz oturum jetonu denemesi',
					path: pathname,
				});
			}
			const res = NextResponse.json({ error: 'Oturum süresi dolmuş veya başka bir cihazda oturum açılmış.' }, { status: 401 });
			res.cookies.delete(SESSION_COOKIE);
			return { authorized: false, user: null, response: res };
		}

		// Alumni keep a read-only session; routes refuse their writes.
		if (user.status !== 'aktif' && user.status !== 'mezun') {
			const res = NextResponse.json({ error: 'Hesabınız aktif durumda değildir.' }, { status: 403 });
			res.cookies.delete(SESSION_COOKIE);
			return { authorized: false, user: null, response: res };
		}

		// 4. Defcon Lockdown check (Hard Lockdown: non-admins blocked with 503)
		const lockdown = await getLockdownState();
		if (lockdown.active && user.roleId !== ADMIN_ROLE_ID) {
			return {
				authorized: false,
				user: null,
				response: NextResponse.json(
					{
						error: 'Sistem şu anda siber saldırı savunması kapsamında Kalkan Modundadır (Lockdown). Yalnızca yöneticiler erişebilir.',
						code: 'LOCKDOWN_ACTIVE',
						defcon: 1,
					},
					{ status: 503 }
				),
			};
		}

		// 5. Track active session IP & detect sudden mid-session IP changes (Pass-the-Cookie Defense)
		const sessionCheck = recordSessionActivity(user, ip);
		if (sessionCheck.suspiciousJump) {
			const reqUa = request.headers.get('user-agent') || '';
			const matchesUa = Boolean(user.sonGirisUserAgent && reqUa && user.sonGirisUserAgent === reqUa);
			if (!matchesUa) {
				void recordSecurityStrike({
					ip,
					points: 30,
					reason: 'Oturum IP sıçraması (Pass-the-Cookie şüphesi)',
					path: pathname,
					userId: user.id,
				});
			}
			const res = NextResponse.json(
				{
					error: 'Oturum açtığınız IP/ağ ile mevcut IP adresiniz uyuşmuyor. Güvenlik nedeniyle oturumunuz donduruldu (Pass-the-Cookie Koruması). Lütfen tekrar giriş yapın.',
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
			response: NextResponse.json({ error: 'Yetkilendirme kontrolü sırasında bir hata oluştu.' }, { status: 500 }),
		};
	}
}
