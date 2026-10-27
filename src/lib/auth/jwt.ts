import crypto from 'crypto';
import { deriveKey } from './serverSecret';

/**
 * Lightweight, zero-dependency JWT (JSON Web Token) implementation for OAuth 2.0 / OIDC.
 * Uses Node's native crypto module for HS256 (HMAC-SHA256) signing and verification.
 */

function base64UrlEncode(str: string | Buffer): string {
	const buf = typeof str === 'string' ? Buffer.from(str, 'utf8') : str;
	return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
	let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	while (base64.length % 4) {
		base64 += '=';
	}
	return Buffer.from(base64, 'base64').toString('utf8');
}

export interface JwtHeader {
	alg: 'HS256';
	typ: 'JWT';
	kid?: string;
}

export interface JwtPayload {
	iss: string;
	sub: string;
	aud: string | string[];
	exp: number;
	nbf?: number;
	iat: number;
	jti?: string;
	[key: string]: unknown;
}

/**
 * Resolves the signing key for OAuth 2.0 / OIDC JWTs.
 * Uses explicit `OAUTH_JWT_SECRET` / `SESSION_SECRET` if configured, otherwise
 * derives a dedicated 256-bit key via HKDF from the installation's root secret (`serverSecret`).
 */
export async function resolveJwtSecret(): Promise<string | Buffer> {
	if (process.env.OAUTH_JWT_SECRET && process.env.OAUTH_JWT_SECRET.length >= 32) {
		return process.env.OAUTH_JWT_SECRET;
	}
	if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) {
		return process.env.SESSION_SECRET;
	}
	return deriveKey('oauth-jwt-hs256-v1');
}

/**
 * Signs a payload with an explicit secret and returns a compact JWT string.
 */
export function signJwt(payload: JwtPayload, secret: string | Buffer): string {
	const header: JwtHeader = { alg: 'HS256', typ: 'JWT', kid: 'orbit-community-hmac-key-1' };
	const encodedHeader = base64UrlEncode(JSON.stringify(header));
	const encodedPayload = base64UrlEncode(JSON.stringify(payload));
	const data = `${encodedHeader}.${encodedPayload}`;

	const signature = crypto.createHmac('sha256', secret).update(data).digest();
	const encodedSignature = base64UrlEncode(signature);

	return `${data}.${encodedSignature}`;
}

/**
 * Signs an OAuth JWT using the installation's resolved cryptographic key.
 */
export async function signOAuthJwt(payload: JwtPayload): Promise<string> {
	const secret = await resolveJwtSecret();
	return signJwt(payload, secret);
}

/**
 * Verifies and decodes a JWT using an explicit secret.
 */
export function verifyJwt<T extends JwtPayload = JwtPayload>(
	token: string,
	secret: string | Buffer
): { valid: true; payload: T } | { valid: false; error: string } {
	try {
		if (!token || typeof token !== 'string' || token.length > 4096) {
			return { valid: false, error: 'Geçersiz token formatı.' };
		}

		const parts = token.split('.');
		if (parts.length !== 3) {
			return { valid: false, error: 'Geçersiz token formatı.' };
		}

		const [encodedHeader, encodedPayload, encodedSignature] = parts;
		if (!encodedHeader || !encodedPayload || !encodedSignature) {
			return { valid: false, error: 'Geçersiz token bileşenleri.' };
		}

		// Strictly enforce algorithm in header to prevent algorithm-confusion / alg:none attacks
		const header = JSON.parse(base64UrlDecode(encodedHeader)) as Partial<JwtHeader>;
		if (!header || header.alg !== 'HS256' || (header.typ && header.typ !== 'JWT')) {
			return { valid: false, error: 'Desteklenmeyen imzalama algoritması.' };
		}

		const data = `${encodedHeader}.${encodedPayload}`;

		// Verify signature with timing-safe comparison and length guard
		const expectedSignature = base64UrlEncode(crypto.createHmac('sha256', secret).update(data).digest());
		const sigBuf = Buffer.from(encodedSignature, 'utf8');
		const expBuf = Buffer.from(expectedSignature, 'utf8');
		if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
			return { valid: false, error: 'Geçersiz imza.' };
		}

		const payload = JSON.parse(base64UrlDecode(encodedPayload)) as T;
		const now = Math.floor(Date.now() / 1000);

		if (typeof payload.exp !== 'number' || payload.exp < now) {
			return { valid: false, error: 'Token süresi dolmuş.' };
		}
		if (typeof payload.nbf === 'number' && payload.nbf > now) {
			return { valid: false, error: 'Token henüz aktif değil.' };
		}

		return { valid: true, payload };
	} catch {
		return { valid: false, error: 'Token çözümlenemedi.' };
	}
}

/**
 * Verifies an OAuth JWT using the installation's resolved cryptographic key.
 */
export async function verifyOAuthJwt<T extends JwtPayload = JwtPayload>(
	token: string
): Promise<{ valid: true; payload: T } | { valid: false; error: string }> {
	const secret = await resolveJwtSecret();
	return verifyJwt<T>(token, secret);
}
