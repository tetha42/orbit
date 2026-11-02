import { NextResponse } from 'next/server';
import type { User } from '@/db/schema';
import { getRolePermission, type Permission } from '@/db/roles';
import { canManage, canUse, seviyeOf, type Seviye, PERMISSION_DESCRIPTIONS, isPermissionApp } from '@/core/permissions';
import { clientAddress } from '@/lib/http';
import { consumeRateLimit } from '@/lib/rateLimit';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { recordSecurityStrike } from '@/db/repositories/security.repo';
import { verifyAuth } from './authGuard';

/**
 * The server's single access check.
 *
 *   const auth = await requireApp(request, 'events', 'yonet');
 *   if (!auth.authorized) return auth.response;
 *   auth.user.permission.izinler …
 *
 * A request passes when the session is valid, the member's role grants the app
 * at the required level, and — when the role demands it — the second factor is
 * enrolled. Routes that decide per record (a captain on their own team) call
 * `authenticate` and combine `can()` with their own rule.
 */
export type AuthorizedUser = User & { permission: Permission };

export type AccessResult =
	| { authorized: true; user: AuthorizedUser; response?: never }
	| { authorized: false; user?: never; response: NextResponse };

/** Whether this member still has to enrol a second factor before using any app. */
export function ikiAdimBekliyor(user: AuthorizedUser): boolean {
	// A passkey assertion is itself multi-factor, so a passkey session satisfies
	// the role's two-factor rule even when no TOTP authenticator is enrolled.
	if (user.authMethod === 'passkey') return false;
	return user.permission.ikiAdimZorunlu && Number(user.totpEnabled) !== 1;
}

export function twoFactorSetupResponse(): NextResponse {
	return NextResponse.json(
		{ error: 'Bu işlem için iki adımlı doğrulama zorunludur. Ayarlar → Güvenlik bölümünden etkinleştirin.', code: '2FA_SETUP_REQUIRED' },
		{ status: 403 }
	);
}

/** Session + role. Enrolment pages and personal settings use this directly. */
export async function authenticate(request: Request): Promise<AccessResult> {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return { authorized: false, response: auth.response };
	const permission = await getRolePermission(auth.user.roleId);
	return { authorized: true, user: { ...auth.user, permission } };
}

/**
 * Session + role + the role's second-factor rule, without naming an app — for
 * routes whose access is decided per record (a captain on their own kasa).
 */
export async function authenticateEnrolled(request: Request): Promise<AccessResult> {
	const auth = await authenticate(request);
	if (auth.authorized && ikiAdimBekliyor(auth.user)) return { authorized: false, response: twoFactorSetupResponse() };
	return auth;
}

/** `can(user, 'events', 'yonet')` — the role's level, and the second factor where required. */
export function can(user: AuthorizedUser, appId: string, seviye: Seviye = 'kullan'): boolean {
	if (ikiAdimBekliyor(user)) return false;
	return seviye === 'yonet' ? canManage(user.permission.izinler, appId) : canUse(user.permission.izinler, appId);
}

export async function requireApp(request: Request, appId: string, seviye: Seviye = 'kullan'): Promise<AccessResult> {
	const auth = await authenticateEnrolled(request);
	if (!auth.authorized) return auth;
	const user = auth.user;
	const ok = seviye === 'yonet' ? canManage(user.permission.izinler, appId) : canUse(user.permission.izinler, appId);
	if (!ok) {
		const ad = isPermissionApp(appId) ? PERMISSION_DESCRIPTIONS[appId].ad : appId;
		const has = seviyeOf(user.permission.izinler, appId);
		const ip = clientAddress(request);
		const pathname = new URL(request.url).pathname;
		if (consumeRateLimit(`log:403:${user.id}:${appId}`, 15, 60_000).allowed) {
			void logSystemEvent({
				servis: 'security',
				seviye: 'WARN',
				mesaj: `Unauthorized app access attempt (${request.method} ${pathname}): ${user.email}`,
				detay: {
					appId,
					gerekenSeviye: seviye,
					mevcutSeviye: has,
					role: user.permission.role?.ad ?? null,
				},
				userId: user.id,
				ip,
			});
		}
		if ((request.method || 'GET').toUpperCase() !== 'GET') {
			void recordSecurityStrike({
				ip,
				points: 20,
				reason: `Unauthorized write attempt (${appId})`,
				path: pathname,
				userId: user.id,
			});
		}
		return {
			authorized: false,
			response: NextResponse.json(
				{ error: has === 'yok' ? `Bu işlem için ${ad} uygulamasına erişim yetkiniz yok.` : `Bu işlem ${ad} uygulamasında yönetim yetkisi gerektirir.` },
				{ status: 403 }
			),
		};
	}
	return auth;
}

export async function requireAdmin(request: Request): Promise<AccessResult> {
	const auth = await authenticateEnrolled(request);
	if (!auth.authorized) return auth;
	if (!auth.user.permission.admin) {
		const ip = clientAddress(request);
		const user = auth.user;
		const pathname = new URL(request.url).pathname;
		if (consumeRateLimit(`log:403:admin:${user.id}`, 15, 60_000).allowed) {
			void logSystemEvent({
				servis: 'security',
				seviye: 'WARN',
				mesaj: `Unauthorized admin endpoint access attempt (${request.method} ${pathname}): ${user.email}`,
				detay: {
					path: pathname,
					method: request.method,
					role: user.permission.role?.ad ?? null,
				},
				userId: user.id,
				ip,
			});
		}
		void recordSecurityStrike({
			ip,
			points: 25,
			reason: `Unauthorized admin endpoint attempt (${pathname})`,
			path: pathname,
			userId: user.id,
		});
		return {
			authorized: false,
			response: NextResponse.json(
				{ error: 'Bu işlem yalnızca sistem yöneticileri tarafından gerçekleştirilebilir.' },
				{ status: 403 }
			),
		};
	}
	return auth;
}
