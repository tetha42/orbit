import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { generateSecret, generateURI, verify } from 'otplib';

/** Shown as the account label inside Google Authenticator and similar apps. */
const ISSUER = 'Orbit Community';

/** Google Authenticator's own tolerance is ±1 step; match that so clock skew is survivable. */
const EPOCH_TOLERANCE_SECONDS = 30;

/** TOTP step length, in seconds. RFC 6238's default and what authenticator apps assume. */
const STEP_SECONDS = 30;

/** The time step a given instant falls in. */
export function currentTimeStep(at: number = Date.now()): number {
	return Math.floor(at / 1000 / STEP_SECONDS);
}

const RECOVERY_CODE_COUNT = 8;

export interface RecoveryCodeSet {
	/** Plaintext codes — returned to the member exactly once, never stored. */
	plain: string[];
	/** bcrypt hashes persisted on the user row. */
	hashes: string[];
}

/** Generates a new base32 TOTP secret (160 bits). */
export function generateTotpSecret(): string {
	return generateSecret();
}

/** Builds the `otpauth://` URI that authenticator apps import from a QR code. */
export function buildOtpauthUri(email: string, secret: string): string {
	return generateURI({ issuer: ISSUER, label: email, secret });
}

export interface TotpVerification {
	valid: boolean;
	/**
	 * The time step the submitted code belonged to.
	 *
	 * Callers that guard a session must persist this and pass it back as
	 * `afterTimeStep` on the next attempt — that is what makes a code single-use.
	 */
	timeStep: number | null;
	/**
	 * The code itself is a valid TOTP, but it belongs to a time step that has
	 * already been consumed (or is older than the recorded step). Callers use
	 * this to explain "wait for a new code" instead of "wrong code".
	 */
	reused?: boolean;
}

/**
 * Checks a 6-digit TOTP code against a secret.
 *
 * @param afterTimeStep Reject any code at or before this step. Pass the value
 *        recorded from the previous successful verification to prevent a
 *        captured code being replayed within its validity window.
 */
export async function verifyTotpCodeDetailed(
	secret: string,
	code: string,
	afterTimeStep?: number | null
): Promise<TotpVerification> {
	const token = String(code ?? '').replace(/\s+/g, '');
	if (!secret || !/^\d{6}$/.test(token)) return { valid: false, timeStep: null };

	try {
		const result = await verify({
			secret,
			token,
			epochTolerance: EPOCH_TOLERANCE_SECONDS,
			// Undefined means "no previous step", which is the first-ever use.
			afterTimeStep: afterTimeStep ?? undefined,
		});

		if (!result?.valid) {
			// When a previous step is recorded, otplib refuses a code at or
			// before it. Retry without that guard to tell a replay apart from a
			// genuinely wrong code: the user needs a different message.
			if (afterTimeStep != null) {
				const withoutGuard = await verify({
					secret,
					token,
					epochTolerance: EPOCH_TOLERANCE_SECONDS,
				}).catch(() => null);
				if (withoutGuard?.valid) return { valid: false, timeStep: null, reused: true };
			}
			return { valid: false, timeStep: null };
		}

		// `delta` is the offset from the current step, so the accepted step is
		// current + delta. Rejections never reach here.
		const delta = Number(result.delta ?? 0);
		return { valid: true, timeStep: currentTimeStep() + delta };
	} catch {
		// Malformed input or a guardrail rejection is just an invalid code.
		return { valid: false, timeStep: null };
	}
}

/** Boolean convenience wrapper for callers that do not track replay state. */
export async function verifyTotpCode(
	secret: string,
	code: string,
	afterTimeStep?: number | null
): Promise<boolean> {
	return (await verifyTotpCodeDetailed(secret, code, afterTimeStep)).valid;
}

/**
 * Human-friendly recovery code, e.g. `4F7K-92QM`.
 *
 * Avoids ambiguous 0/O and 1/I, and draws from a CSPRNG — these are credential
 * material, so `Math.random()` would be the wrong generator even though the
 * values are hashed before storage.
 */
function randomRecoveryCode(): string {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	const block = () =>
		Array.from({ length: 4 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
	return `${block()}-${block()}`;
}

/** Mints a fresh recovery-code set: plaintext for display, hashes for storage. */
export async function generateRecoveryCodes(): Promise<RecoveryCodeSet> {
	const plain = Array.from({ length: RECOVERY_CODE_COUNT }, randomRecoveryCode);
	const hashes = await Promise.all(plain.map((code) => bcrypt.hash(code, 10)));
	return { plain, hashes };
}

/**
 * Consumes a recovery code.
 *
 * @returns the remaining hashes when the code matched (the spent one removed),
 *          or `null` when it did not match any stored code.
 */
export async function consumeRecoveryCode(
	hashes: string[],
	code: string
): Promise<string[] | null> {
	const normalized = String(code ?? '').trim().toUpperCase();
	if (!normalized || hashes.length === 0) return null;

	for (let i = 0; i < hashes.length; i += 1) {
		if (await bcrypt.compare(normalized, hashes[i])) {
			return [...hashes.slice(0, i), ...hashes.slice(i + 1)];
		}
	}
	return null;
}
