import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth/access';
import { auditContext } from '@/db/audit';
import {
	disableUserTotp,
	getUserByEmail,
	parseRecoveryCodes,
	setUserTotpStep,
} from '@/db';
import { consumeRecoveryCode, verifyTotpCodeDetailed } from '@/lib/auth/totp';
import { clearRateLimit, isRateLimited, recordFailure } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/db/repositories/logs.repo';

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60_000;

/**
 * Turns two-factor auth off.
 *
 * Requires proof of possession — either a current TOTP code or an unused recovery
 * code — so a borrowed session alone cannot strip the second factor. Members
 * whose role requires it (admins always) cannot disable it at all.
 */
export async function POST(request: Request) {
	const auth = await authenticate(request);
	if (!auth.authorized) return auth.response;

	const ip = clientAddress(request);
	const rateKey = `2fa:disable:${auth.user.id}`;
	const gate = isRateLimited(rateKey, MAX_ATTEMPTS);
	if (!gate.allowed) {
		return NextResponse.json(
			{ error: `Too many failed attempts. Please try again in ${Math.ceil(gate.retryAfter / 60)} minutes.`, code: 'RATE_LIMITED' },
			{ status: 429, headers: { 'Retry-After': String(gate.retryAfter) } }
		);
	}

	try {
		const { user } = auth;
		if (user.permission.ikiAdimZorunlu) {
			return NextResponse.json(
				{ error: `Two-factor authentication is strictly required for this role and cannot be turned off.`, code: 'ROLE_REQUIRED' },
				{ status: 403 }
			);
		}

		const body = await request.json().catch(() => ({}));
		const code = String(body.code ?? '').trim();
		if (!code) {
			return NextResponse.json({ error: 'Verification code is required.', code: 'CODE_REQUIRED' }, { status: 400 });
		}

		// Re-read so the check runs against the stored secret and code set.
		const fresh = await getUserByEmail(user.email);
		if (!fresh) {
			return NextResponse.json({ error: 'User not found.', code: 'USER_NOT_FOUND' }, { status: 404 });
		}

		// Replay-protected like the sign-in step: a code spent here cannot be reused.
		const verification = fresh.totpSecret
			? await verifyTotpCodeDetailed(fresh.totpSecret, code, fresh.totpSonAdim)
			: { valid: false, timeStep: null };
		const validTotp = verification.valid;
		if (validTotp && verification.timeStep !== null) {
			await setUserTotpStep(fresh.id, verification.timeStep);
		}

		const spentRecovery = validTotp
			? null
			: await consumeRecoveryCode(parseRecoveryCodes(fresh), code);

		if (!validTotp && !spentRecovery) {
			recordFailure(rateKey, WINDOW_MS);
			await logSystemEvent({
				servis: 'auth',
				seviye: 'WARN',
				mesaj: `2FA disable failed (invalid code): ${user.email}`,
				userId: user.id,
				ip,
			});
			return NextResponse.json(
				{ error: 'Invalid verification code or recovery code.', code: 'INVALID_2FA_CODE' },
				{ status: 400 }
			);
		}

		clearRateLimit(rateKey);
		await disableUserTotp(user.id, auditContext(request, user));
		await logSystemEvent({
			servis: 'auth',
			seviye: 'WARN',
			mesaj: `Kullanıcı iki adımlı doğrulamayı (2FA) kapattı: ${user.email}`,
			userId: user.id,
			ip,
		});
		return NextResponse.json({ success: true, message: 'İki adımlı doğrulama kapatıldı.' });
	} catch (error) {
		console.error('API /api/auth/2fa/disable error:', error);
		return NextResponse.json({ error: 'İki adımlı doğrulama kapatılamadı.' }, { status: 500 });
	}
}
