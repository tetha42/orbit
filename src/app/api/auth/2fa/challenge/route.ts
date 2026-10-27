import { NextResponse } from 'next/server';
import {
	getUserById,
	parseRecoveryCodes,
	setUserRecoveryCodes,
	setUserTotpStep,
} from '@/db';
import { verifyLoginChallenge } from '@/lib/auth/authToken';
import { consumeRecoveryCode, verifyTotpCodeDetailed } from '@/lib/auth/totp';
import { attachSessionCookie, establishSession, sessionUserOf } from '@/lib/auth/session';
import { clearRateLimit, isRateLimited, recordFailure } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { inspectRequestPayload } from '@/lib/waf';
import { ADMIN_ROL_ID } from '@/core/permissions';
import { logSystemEvent } from '@/server/db/domains/logs.repo';
import { getLockdownState, isIpBanned, recordSecurityStrike } from '@/server/db/domains/security.repo';

const MAX_2FA_USER_ATTEMPTS = 8;
const MAX_2FA_IP_ATTEMPTS = 25;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
	try {
		const ip = clientAddress(request);
		const ban = await isIpBanned(ip);
		if (ban.banned) {
			return NextResponse.json(
				{ error: 'IP adresiniz siber güvenlik politikası nedeniyle geçici olarak karantinaya alınmıştır.' },
				{ status: 403 }
			);
		}

		const waf = inspectRequestPayload(request);
		if (waf.matched) {
			void logSystemEvent({
				servis: 'security',
				seviye: 'ERROR',
				mesaj: `[WAF] Saldırı imzası engellendi (${waf.signature}): POST /api/auth/2fa/challenge`,
				detay: { category: waf.category, signature: waf.signature },
				ip,
			});
			void recordSecurityStrike({
				ip,
				points: waf.points,
				reason: `WAF: ${waf.signature}`,
				path: '/api/auth/2fa/challenge',
			});
			return NextResponse.json(
				{ error: 'Güvenlik duvarı (WAF) tarafından şüpheli istek engellendi.' },
				{ status: 403 }
			);
		}

		const ipKey = `2fa:challenge:ip:${ip}`;
		const ipGate = isRateLimited(ipKey, MAX_2FA_IP_ATTEMPTS);
		if (!ipGate.allowed) {
			await logSystemEvent({
				servis: 'auth',
				seviye: 'WARN',
				mesaj: '2FA doğrulama IP hız sınırı aşıldı',
				detay: { kilitAnahtari: ipKey, kalanSaniye: ipGate.retryAfter },
				ip,
			});
			void recordSecurityStrike({
				ip,
				points: 40,
				reason: '2FA doğrulama hız sınırı aşımı',
				path: '/api/auth/2fa/challenge',
			});
			return NextResponse.json(
				{
					error: `Too many failed 2FA attempts. Please try again in ${Math.ceil(ipGate.retryAfter / 60)} minutes.`,
					code: 'RATE_LIMITED',
				},
				{ status: 429, headers: { 'Retry-After': String(ipGate.retryAfter) } }
			);
		}

		const body = await request.json().catch(() => ({}));
		const { challengeToken, code } = body;

		const userId = await verifyLoginChallenge(String(challengeToken ?? ''));
		if (!userId) {
			recordFailure(ipKey, ATTEMPT_WINDOW_MS);
			void recordSecurityStrike({
				ip,
				points: 20,
				reason: 'Geçersiz 2FA challenge token',
				path: '/api/auth/2fa/challenge',
			});
			return NextResponse.json(
				{ error: 'Verification challenge expired. Please sign in again.', code: 'CHALLENGE_EXPIRED' },
				{ status: 401 }
			);
		}

		const userKey = `2fa:challenge:user:${userId}`;
		const userGate = isRateLimited(userKey, MAX_2FA_USER_ATTEMPTS);
		if (!userGate.allowed) {
			await logSystemEvent({
				servis: 'auth',
				seviye: 'WARN',
				mesaj: '2FA verification user rate limit exceeded',
				detay: { userId, kilitAnahtari: userKey, kalanSaniye: userGate.retryAfter },
				userId,
				ip,
			});
			void recordSecurityStrike({
				ip,
				points: 35,
				reason: 'User 2FA rate limit exceeded',
				path: '/api/auth/2fa/challenge',
				userId,
			});
			return NextResponse.json(
				{
					error: `Too many failed 2FA attempts. Please try again in ${Math.ceil(userGate.retryAfter / 60)} minutes.`,
					code: 'RATE_LIMITED',
				},
				{ status: 429, headers: { 'Retry-After': String(userGate.retryAfter) } }
			);
		}

		const user = await getUserById(userId);
		if (!user || Number(user.totpEnabled) !== 1) {
			return NextResponse.json(
				{ error: 'Two-factor authentication is not enabled for this account.', code: '2FA_NOT_ENABLED' },
				{ status: 400 }
			);
		}

		if (user.status !== 'aktif') {
			return NextResponse.json(
				{ error: 'Account is not active.', code: 'ACCOUNT_INACTIVE' },
				{ status: 403 }
			);
		}

		const submitted = String(code ?? '').trim();

		const verification = user.totpSecret
			? await verifyTotpCodeDetailed(user.totpSecret, submitted, user.totpSonAdim)
			: { valid: false, timeStep: null };

		let authenticated = verification.valid;
		if (authenticated && verification.timeStep !== null) {
			await setUserTotpStep(user.id, verification.timeStep);
		}

		if (!authenticated) {
			const remaining = await consumeRecoveryCode(parseRecoveryCodes(user), submitted);
			if (remaining) {
				await setUserRecoveryCodes(user.id, remaining);
				authenticated = true;
			}
		}

		if (!authenticated) {
			recordFailure(userKey, ATTEMPT_WINDOW_MS);
			recordFailure(ipKey, ATTEMPT_WINDOW_MS);
			void recordSecurityStrike({
				ip,
				points: 20,
				reason: `Invalid 2FA code (${user.email})`,
				path: '/api/auth/2fa/challenge',
				userId: user.id,
			});
			await logSystemEvent({
				servis: 'auth',
				seviye: 'WARN',
				mesaj: `Failed 2FA verification attempt: ${user.email}`,
				detay: { email: user.email },
				userId: user.id,
				ip,
			});
			return NextResponse.json(
				{ error: 'Invalid verification code.', code: 'INVALID_2FA_CODE' },
				{ status: 401 }
			);
		}

		clearRateLimit(userKey);

		const lockdown = await getLockdownState();
		if (lockdown.active && user.roleId !== ADMIN_ROL_ID) {
			return NextResponse.json(
				{
					error: 'Workspace is currently in Lockdown Mode under active cyber defense. Only administrators may sign in.',
					code: 'LOCKDOWN_ACTIVE',
				},
				{ status: 503 }
			);
		}

		const sessionToken = await establishSession(user, request);
		await logSystemEvent({
			servis: 'auth',
			seviye: 'INFO',
			mesaj: `Kullanıcı 2FA ile giriş yaptı: ${user.ad} ${user.soyad} (${user.email})`,
			userId: user.id,
			ip,
		});

		const response = NextResponse.json({ success: true, user: await sessionUserOf(user) });
		return attachSessionCookie(response, sessionToken);
	} catch (error) {
		console.error('API /api/auth/2fa/challenge error:', error);
		return NextResponse.json({ error: 'Doğrulama tamamlanamadı.' }, { status: 500 });
	}
}
