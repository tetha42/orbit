import crypto from 'crypto';
import { deriveKey } from './serverSecret';

/**
 * Short-lived, stateless tokens used for the second step of a two-factor login.
 *
 * The password step cannot hand out a session cookie — it only proves the first
 * factor. Instead it mints a signed challenge that the TOTP step redeems. The
 * token carries the user id and an expiry, signed with a purpose-derived HKDF
 * secret (`login-challenge-v1`), so no extra table or cleanup job is needed.
 */

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function sign(payload: string, key: Buffer): string {
	return crypto.createHmac('sha256', key).update(payload).digest('base64url');
}

/** Mints a challenge token binding `userId` to a five-minute window. */
export async function createLoginChallenge(userId: string): Promise<string> {
	const expiresAt = Date.now() + CHALLENGE_TTL_MS;
	const encodedUser = Buffer.from(userId, 'utf8').toString('base64url');
	const payload = `c1.${encodedUser}.${expiresAt}`;
	const key = await deriveKey('login-challenge-v1');
	return `${payload}.${sign(payload, key)}`;
}

/**
 * Verifies a challenge token.
 *
 * @returns the user id it was minted for, or `null` if the signature is wrong
 *          or the token has expired.
 */
export async function verifyLoginChallenge(token: string): Promise<string | null> {
	if (!token || typeof token !== 'string' || token.length > 512) return null;
	const parts = token.split('.');
	if (parts.length !== 4) return null;

	const [version, encodedUser, expiresAtRaw, signature] = parts;
	if (version !== 'c1' || !encodedUser || !signature) return null;

	const expiresAt = Number(expiresAtRaw);
	if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

	const key = await deriveKey('login-challenge-v1');
	const expected = sign(`${version}.${encodedUser}.${expiresAtRaw}`, key);

	// Constant-time compare — both are the same length for a given algorithm.
	const a = Buffer.from(signature);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

	try {
		const userId = Buffer.from(encodedUser, 'base64url').toString('utf8');
		return userId || null;
	} catch {
		return null;
	}
}
