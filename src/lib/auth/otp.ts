import crypto from 'node:crypto';

/**
 * Computes a secure SHA-256 digest of a 6-digit OTP code before storing it in PostgreSQL.
 * Format: "sha256:<hex>" so we can differentiate hashed vs legacy plaintext codes.
 */
export function hashOtpCode(code: string): string {
	const clean = String(code || '').trim();
	const digest = crypto.createHash('sha256').update(clean, 'utf8').digest('hex');
	return `sha256:${digest}`;
}

/**
 * Validates a submitted 6-digit OTP code against the stored database value.
 * Uses crypto.timingSafeEqual to prevent side-channel timing attacks.
 * Backward compatible: if stored code is legacy plaintext (e.g. 6 digits), verifies securely as well.
 */
export function verifyOtpCode(storedValue: string, submittedCode: string): boolean {
	const stored = String(storedValue || '').trim();
	const submitted = String(submittedCode || '').trim();
	if (!/^\d{6}$/.test(submitted)) return false;

	if (stored.startsWith('sha256:')) {
		const expectedHash = stored.slice(7);
		const actualHash = crypto.createHash('sha256').update(submitted, 'utf8').digest('hex');
		const bufA = Buffer.from(expectedHash, 'hex');
		const bufB = Buffer.from(actualHash, 'hex');
		return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
	}

	// Legacy fallback: stored is 6-digit plaintext
	if (!/^\d{6}$/.test(stored)) return false;
	const bufA = Buffer.from(stored, 'utf8');
	const bufB = Buffer.from(submitted, 'utf8');
	return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}
