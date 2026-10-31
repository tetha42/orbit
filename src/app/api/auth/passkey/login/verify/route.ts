import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import {
	consumeWebauthnChallenge,
	getUserById,
	getWebauthnCredentialById,
	updateWebauthnCounter,
} from '@/db';
import { getWebauthnConfig, toAuthenticatorDevice } from '@/lib/auth/webauthn';
import { attachSessionCookie, establishSession, sessionUserOf } from '@/lib/auth/session';
import { consumeRateLimit } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { inspectRequestPayload } from '@/lib/waf';
import { ADMIN_ROLE_ID } from '@/core/permissions';
import { logSystemEvent } from '@/server/db/domains/logs.repo';
import { getLockdownState, isIpBanned, recordSecurityStrike } from '@/server/db/domains/security.repo';

/**
 * Second step of a passkey sign-in: verifies the assertion and issues a session.
 *
 * A passkey assertion is already multi-factor (the device plus its biometric/PIN
 * unlock), so it completes authentication on its own — except for a role that
 * requires two-factor auth and a member who enrolled it: they get the login
 * challenge and still enter the authenticator code (see below).
 */
export async function POST(request: Request) {
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
			mesaj: `[WAF] Saldırı imzası engellendi (${waf.signature}): POST /api/auth/passkey/login/verify`,
			detay: { category: waf.category, signature: waf.signature },
			ip,
		});
		void recordSecurityStrike({
			ip,
			points: waf.points,
			reason: `WAF: ${waf.signature}`,
			path: '/api/auth/passkey/login/verify',
		});
		return NextResponse.json(
			{ error: 'Güvenlik duvarı (WAF) tarafından şüpheli istek engellendi.' },
			{ status: 403 }
		);
	}

	const limit = consumeRateLimit(`passkey:verify:ip:${ip}`, 20, 60_000);
	if (!limit.allowed) {
		void recordSecurityStrike({
			ip,
			points: 25,
			reason: 'Passkey doğrulama hız sınırı aşımı',
			path: '/api/auth/passkey/login/verify',
		});
		return NextResponse.json(
			{ error: 'Çok fazla istek, lütfen biraz bekleyin.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
		);
	}

	try {
		const body = await request.json().catch(() => ({}));
		const { challengeId, response } = body;

		if (!challengeId || !response) {
			return NextResponse.json({ error: 'Eksik parametreler.' }, { status: 400 });
		}

		// Consumed before verification so a replayed response cannot be reused.
		const pending = await consumeWebauthnChallenge(String(challengeId), 'giris');
		if (!pending || !pending.userId) {
			return NextResponse.json(
				{ error: 'Doğrulama oturumu geçersiz veya süresi dolmuş. Lütfen tekrar deneyin.' },
				{ status: 400 }
			);
		}

		const user = await getUserById(pending.userId);
		if (!user || user.status !== 'aktif') {
			return NextResponse.json({ error: 'Hesabınız aktif durumda değildir.' }, { status: 403 });
		}

		const credentialRow = await getWebauthnCredentialById(String(response.id));
		// The credential must belong to the account the challenge was issued for.
		if (!credentialRow || credentialRow.userId !== user.id) {
			void recordSecurityStrike({
				ip,
				points: 25,
				reason: `Farklı hesaba ait Passkey denemesi (${user.email})`,
				path: '/api/auth/passkey/login/verify',
				userId: user.id,
			});
			await logSystemEvent({
				servis: 'auth',
				seviye: 'WARN',
				mesaj: `Passkey doğrulama hatası (farklı hesaba ait anahtar): ${user.email}`,
				userId: user.id,
				ip,
			});
			return NextResponse.json({ error: 'Passkey bu hesaba ait değil.' }, { status: 401 });
		}

		const { rpID, origin } = getWebauthnConfig(request);

		const verification = await verifyAuthenticationResponse({
			response,
			expectedChallenge: pending.challenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			credential: toAuthenticatorDevice(credentialRow),
		});

		if (!verification.verified) {
			void recordSecurityStrike({
				ip,
				points: 20,
				reason: `Başarısız Passkey imza doğrulaması (${user.email})`,
				path: '/api/auth/passkey/login/verify',
				userId: user.id,
			});
			await logSystemEvent({
				servis: 'auth',
				seviye: 'WARN',
				mesaj: `Başarısız Passkey imza doğrulaması: ${user.email}`,
				userId: user.id,
				ip,
			});
			return NextResponse.json({ error: 'Passkey doğrulanamadı.' }, { status: 401 });
		}

		const { newCounter } = verification.authenticationInfo;

		// A counter that does not advance is the standard signal that the
		// authenticator has been cloned. Zero means the device does not implement
		// counters at all, which is allowed.
		const storedCounter = Number(credentialRow.counter) || 0;
		if (newCounter !== 0 && newCounter <= storedCounter) {
			console.error(
				`⚠️ Passkey counter did not advance (stored=${storedCounter}, received=${newCounter}) for credential ${credentialRow.id}`
			);
			void recordSecurityStrike({
				ip,
				points: 50,
				reason: `Passkey klonlama şüphesi (${user.email})`,
				path: '/api/auth/passkey/login/verify',
				userId: user.id,
			});
			await logSystemEvent({
				servis: 'auth',
				seviye: 'ERROR',
				mesaj: `Passkey klonlama şüphesi (sayaç ilerlemedi): ${user.email}`,
				detay: { credentialId: credentialRow.id, storedCounter, newCounter },
				userId: user.id,
				ip,
			});
			return NextResponse.json(
				{ error: 'Passkey doğrulanamadı. Güvenlik nedeniyle yöneticiyle iletişime geçin.' },
				{ status: 401 }
			);
		}

		if (newCounter !== 0) {
			await updateWebauthnCounter(credentialRow.id, newCounter);
		}

		const lockdown = await getLockdownState();
		if (lockdown.active && user.roleId !== ADMIN_ROLE_ID) {
			return NextResponse.json(
				{
					error: 'Sistem şu anda siber saldırı savunması kapsamında Kalkan Modundadır (Lockdown). Yalnızca yöneticiler giriş yapabilir.',
					code: 'LOCKDOWN_ACTIVE',
				},
				{ status: 503 }
			);
		}

		const sessionToken = await establishSession(user, request, 'passkey');
		await logSystemEvent({
			servis: 'auth',
			seviye: 'INFO',
			mesaj: `Kullanıcı Passkey ile giriş yaptı: ${user.ad} ${user.soyad} (${user.email})`,
			userId: user.id,
			ip,
		});
		const res = NextResponse.json({ success: true, user: await sessionUserOf(user) });
		return attachSessionCookie(res, sessionToken);
	} catch (error) {
		console.error('API /api/auth/passkey/login/verify error:', error);
		return NextResponse.json({ error: 'Passkey ile giriş yapılamadı.' }, { status: 500 });
	}
}
