import crypto from 'crypto';
import type { NextResponse } from 'next/server';
import { User, updateUserSession } from '@/db';
import { getRolePermission, type Permission } from '@/db/roles';
import { clientAddress } from '@/lib/http';
import type { SessionUser } from '@/types/session';

export const SESSION_COOKIE = 'kulup_session_token';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Turns on the session cookie for a signed-in member.
 *
 * Single-session policy: every call mints a new token and overwrites the one on
 * the user row, so signing in elsewhere invalidates the previous device.
 *
 * The expiry is written to the row as well as the cookie. The cookie attribute
 * only tells the browser when to stop sending it — the server needs its own
 * record to reject a cookie that is replayed after that point.
 */
export async function establishSession(
	user: User,
	request?: Request,
	authMethod: 'password' | 'totp' | 'passkey' = 'password'
): Promise<string> {
	const sessionToken = crypto.randomBytes(32).toString('base64url');
	const telemetry = request
		? {
				ip: clientAddress(request),
				userAgent: request.headers.get('user-agent'),
			}
		: undefined;
	await updateUserSession(
		user.id,
		sessionToken,
		Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
		telemetry,
		authMethod
	);
	// Keep the in-memory row consistent with what was just stored, so a caller
	// that builds the session user from this object does not briefly report
	// `mustSetup2fa` to a passkey-authenticated member.
	user.authMethod = authMethod;
	return sessionToken;
}

/**
 * Attaches the session cookie to a response.
 *
 * `secure` is tied to production: over plain HTTP in local development a secure
 * cookie would be dropped by the browser and nobody could sign in.
 */
export function attachSessionCookie(response: NextResponse, sessionToken: string): NextResponse {
	response.cookies.set(SESSION_COOKIE, sessionToken, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: SESSION_MAX_AGE_SECONDS,
	});
	return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
	response.cookies.delete(SESSION_COOKIE);
	return response;
}

/**
 * The user shape handed to the client.
 *
 * Never carries `passwordHash`, `aktifOturumToken` or `totpSecret`. The role's
 * permissions travel with it: the client shows only the apps they allow (the
 * server checks every request again). `mustSetup2fa` drives the blocking setup
 * prompt when the role requires a second factor.
 */
export function toSessionUser(user: User, permission: Permission): SessionUser {
	const twoFactorEnabled = Number(user.totpEnabled) === 1;
	const twoFactorRequired = permission.ikiAdimZorunlu;
	const passkeySession = (user.authMethod ?? 'password') === 'passkey';

	return {
		id: user.id,
		ad: user.ad,
		soyad: user.soyad,
		email: user.email,
		ogrenciNo: user.ogrenciNo,
		bolum: user.bolum,
		sinif: user.sinif,
		profilFoto: user.profilFoto,
		bio: user.bio,
		xp: user.xp,
		status: user.status,
		sonGirisTarihi: user.sonGirisTarihi,
		twoFactorEnabled,
		twoFactorRequired,
		authMethod: user.authMethod ?? 'password',
		mustSetup2fa: twoFactorRequired && !twoFactorEnabled && !passkeySession,
		rolBilgi: permission.role,
		izinler: permission.izinler,
		admin: permission.admin,
	};
}

/** `toSessionUser` with the member's role looked up. */
export async function sessionUserOf(user: User): Promise<SessionUser> {
	return toSessionUser(user, await getRolePermission(user.roleId));
}
