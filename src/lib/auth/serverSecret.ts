import crypto from 'crypto';
import { getSystemSetting, setSystemSetting } from '@/db';

/**
 * The installation's root secret, used to key signing (login challenges) and
 * encryption (stored credentials).
 *
 * Resolution order:
 *   1. `AUTH_SECRET` from the environment — recommended for deployments,
 *   2. a random value minted once and kept in `sistem_ayarlari`.
 *
 * The database-backed fallback keeps installs secure with no configuration and
 * survives restarts. Losing it invalidates pending 2FA challenges and makes
 * stored SMTP passwords undecryptable, so it should be set via env in production.
 */

const SECRET_SETTING_KEY = 'auth_secret';

let cachedSecret: string | null = null;

export async function getServerSecret(): Promise<string> {
	if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
	if (cachedSecret) return cachedSecret;

	let secret = await getSystemSetting(SECRET_SETTING_KEY, '');
	if (!secret) {
		secret = crypto.randomBytes(32).toString('hex');
		await setSystemSetting(SECRET_SETTING_KEY, secret);
	}
	cachedSecret = secret;
	return secret;
}

/**
 * Derives a purpose-bound 32-byte key from an arbitrary secret.
 */
export function deriveKeyWithSecret(secret: string, info: string): Buffer {
	return Buffer.from(crypto.hkdfSync('sha256', secret, 'kulup-portal', info, 32));
}

/**
 * Derives a purpose-bound 32-byte key from the root secret.
 * Separate `info` values keep the encryption key independent from the signing key.
 */
export async function deriveKey(info: string): Promise<Buffer> {
	const secret = await getServerSecret();
	return deriveKeyWithSecret(secret, info);
}
