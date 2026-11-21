import crypto from 'node:crypto';
import { getUserBySessionToken } from '@/db';
import { ADMIN_ROLE_ID } from '@/core/permissions';
import { readSessionToken } from './helpers';

function getProbeSigningKey(): string {
	return (
		process.env.SECURITY_GUARD_TOKEN?.trim() ||
		process.env.AUTH_SECRET?.trim() ||
		'orbit-internal-probe-key'
	);
}

export function createAppSecProbeToken(): string {
	return crypto
		.createHmac('sha256', getProbeSigningKey())
		.update('orbit-appsec-probe:v1')
		.digest('hex');
}

/**
 * Synchronous HMAC check for `x-appsec-probe`.
 * Rejects unauthenticated external `x-appsec-probe: 1` spoofing headers.
 */
export function isValidAppSecProbe(request: Request): boolean {
	const raw = request.headers.get('x-appsec-probe')?.trim();
	if (!raw) return false;
	const expected = createAppSecProbeToken();
	if (raw.length !== expected.length) return false;
	try {
		return crypto.timingSafeEqual(Buffer.from(raw), Buffer.from(expected));
	} catch {
		return false;
	}
}

/**
 * Verifies whether an incoming `x-appsec-probe` request is legitimately authorized
 * either via signed HMAC probe token or an active Administrator session (SoC Testbench).
 */
export async function isAuthorizedAppSecProbe(request: Request): Promise<boolean> {
	if (!request.headers.has('x-appsec-probe')) return false;
	if (isValidAppSecProbe(request)) return true;

	const sessionToken = readSessionToken(request);
	if (!sessionToken) return false;
	try {
		const user = await getUserBySessionToken(sessionToken);
		return Boolean(user && user.status === 'active' && user.roleId === ADMIN_ROLE_ID);
	} catch {
		return false;
	}
}
