import crypto from 'crypto';
import { deriveKey, deriveKeyWithSecret } from './serverSecret';

/**
 * Authenticated encryption for credentials that must be readable by the server
 * later — currently the SMTP password.
 *
 * AES-256-GCM, random IV per value, stored as `enc:v1:<iv>:<tag>:<ciphertext>`
 * (all base64url). The prefix lets `decryptSecret` recognise values written
 * before encryption existed and pass them through unchanged, so existing
 * installs keep working and get upgraded on the next save.
 */

const PREFIX = 'enc:v1:';
const KEY_INFO = 'smtp-credential';

// base64url never contains ':', so splitting the stored form is unambiguous.
const SEPARATOR = ':';

export function isEncrypted(value: string | null | undefined): boolean {
	return typeof value === 'string' && value.startsWith(PREFIX);
}

/** @returns `enc:v1:<iv>:<tag>:<ciphertext>` */
export async function encryptSecret(plaintext: string): Promise<string> {
	const key = await deriveKey(KEY_INFO);
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

	const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();

	return (
		PREFIX +
		[iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(
			SEPARATOR
		)
	);
}

/**
 * Decrypts a stored value.
 *
 * Plaintext legacy values are returned as-is, so an install that has not saved
 * since encryption was introduced keeps sending mail. A value that is encrypted
 * but fails authentication returns `null` — the caller must treat that as "no
 * credential" rather than falling back to using ciphertext as a password.
 */
export async function decryptSecret(stored: string | null | undefined): Promise<string | null> {
	if (!stored) return null;
	if (!isEncrypted(stored)) return stored;

	const [ivRaw, tagRaw, dataRaw] = stored.slice(PREFIX.length).split(SEPARATOR);
	if (!ivRaw || !tagRaw || !dataRaw) return null;

	try {
		const key = await deriveKey(KEY_INFO);
		const decipher = crypto.createDecipheriv(
			'aes-256-gcm',
			key,
			Buffer.from(ivRaw, 'base64url')
		);
		decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));

		return Buffer.concat([
			decipher.update(Buffer.from(dataRaw, 'base64url')),
			decipher.final(),
		]).toString('utf8');
	} catch {
		// Key Rotation fallback: attempt decryption with AUTH_SECRET_OLD if defined
		if (process.env.AUTH_SECRET_OLD) {
			try {
				const oldKey = deriveKeyWithSecret(process.env.AUTH_SECRET_OLD, KEY_INFO);
				const decipherOld = crypto.createDecipheriv(
					'aes-256-gcm',
					oldKey,
					Buffer.from(ivRaw, 'base64url')
				);
				decipherOld.setAuthTag(Buffer.from(tagRaw, 'base64url'));
				return Buffer.concat([
					decipherOld.update(Buffer.from(dataRaw, 'base64url')),
					decipherOld.final(),
				]).toString('utf8');
			} catch {
				return null;
			}
		}
		return null;
	}
}
