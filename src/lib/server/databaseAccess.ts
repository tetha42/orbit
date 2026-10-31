import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { authenticate, type AuthorizedUser } from '@/lib/auth/access';
import { deriveKey } from '@/lib/auth/serverSecret';

const DATABASE_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function sign(payload: string, key: Buffer): string {
	return crypto.createHmac('sha256', key).update(payload).digest('base64url');
}

/**
 * Creates a signed stateless 2FA authentication token for Database Studio.
 * Valid for 30 minutes from issue time.
 */
export async function createDatabaseSessionToken(userId: string): Promise<string> {
	const expiresAt = Date.now() + DATABASE_SESSION_TTL_MS;
	const encodedUser = Buffer.from(userId, 'utf8').toString('base64url');
	const payload = `db.${encodedUser}.${expiresAt}`;
	const key = await deriveKey('database-studio-v1');
	return `${payload}.${sign(payload, key)}`;
}

/**
 * Verifies that the provided token belongs to the given user and has not expired.
 */
export async function verifyDatabaseSessionToken(userId: string, token: string | null): Promise<boolean> {
	if (!token || typeof token !== 'string' || token.length > 512) return false;
	const parts = token.split('.');
	if (parts.length !== 4) return false;

	const [prefix, encodedUser, expiresAtRaw, signature] = parts;
	const expectedEncodedUser = Buffer.from(userId, 'utf8').toString('base64url');
	if (prefix !== 'db' || encodedUser !== expectedEncodedUser) return false;

	const expiresAt = Number(expiresAtRaw);
	if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

	const key = await deriveKey('database-studio-v1');
	const expected = sign(`${prefix}.${encodedUser}.${expiresAtRaw}`, key);

	const a = Buffer.from(signature);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

	return true;
}

// Global in-memory registry for frozen database users (persists across Next.js Turbopack chunks)
const globalStore = globalThis as typeof globalThis & {
	__frozenDatabaseUsers?: Set<string>;
};

if (!globalStore.__frozenDatabaseUsers) {
	globalStore.__frozenDatabaseUsers = new Set<string>();
}

export function freezeUserDatabaseAccess(userId: string): void {
	globalStore.__frozenDatabaseUsers?.add(userId);
}

export function unfreezeUserDatabaseAccess(userId: string): void {
	globalStore.__frozenDatabaseUsers?.delete(userId);
}

export function isUserDatabaseFrozen(userId: string): boolean {
	return Boolean(globalStore.__frozenDatabaseUsers?.has(userId));
}

/**
 * Server guard verifying:
 * 1. Valid user session
 * 2. User has administrative privileges (auth.user.permission.admin)
 * 3. User possesses a valid, non-expired 2FA Database Studio token in the 'x-db-token' header
 * 4. User database access is not frozen by SoC incident containment
 */
export async function requireDatabaseAdmin(
	request: Request
): Promise<
	| { authorized: true; user: AuthorizedUser; response?: never }
	| { authorized: false; user?: never; response: NextResponse }
> {
	const auth = await authenticate(request);
	if (!auth.authorized) return { authorized: false, response: auth.response };

	if (!auth.user.permission.admin) {
		return {
			authorized: false,
			response: NextResponse.json(
				{ error: 'Bu işlem için yönetici (admin) yetkisi gereklidir.', code: 'ADMIN_REQUIRED' },
				{ status: 403 }
			),
		};
	}

	if (isUserDatabaseFrozen(auth.user.id)) {
		return {
			authorized: false,
			response: NextResponse.json(
				{
					error: 'Veritabanı erişimi SoC güvenlik tecrit protokolü kapsamında dondurulmuştur.',
					code: 'DATABASE_ACCESS_FROZEN',
				},
				{ status: 403 }
			),
		};
	}

	const dbToken = request.headers.get('x-db-token');
	const isVerified = await verifyDatabaseSessionToken(auth.user.id, dbToken);

	if (!isVerified) {
		return {
			authorized: false,
			response: NextResponse.json(
				{
					error: 'Veritabanı yöneticisi 2FA oturumu bulunamadı veya süresi doldu. Lütfen 2FA ile yeniden doğrulayın.',
					code: '2FA_SESSION_REQUIRED',
				},
				{ status: 401 }
			),
		};
	}

	return { authorized: true, user: auth.user };
}
