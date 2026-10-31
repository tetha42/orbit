import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getUserByEmail, getWebauthnCredentials, createWebauthnChallenge } from '@/db';
import { getWebauthnConfig, newChallengeId, parseTransports } from '@/lib/auth/webauthn';
import { consumeRateLimit } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/server/db/domains/logs.repo';
import { isIpBanned, recordSecurityStrike } from '@/server/db/domains/security.repo';
import { inspectRequestPayload } from '@/lib/waf';

/**
 * First step of signing in with a passkey.
 *
 * Unauthenticated by definition. Only the credential ids for the named account
 * are offered, so the browser can go straight to the right authenticator.
 */
export async function POST(request: Request) {
	const ip = clientAddress(request);

	const ban = await isIpBanned(ip);
	if (ban.banned) {
		void recordSecurityStrike({
			ip,
			points: 10,
			reason: 'Karantinadaki IP Passkey options denemesi',
			path: '/api/auth/passkey/login/options',
		});
		return NextResponse.json(
			{ error: 'IP adresiniz güvenlik politikası nedeniyle karantinaya alınmıştır.' },
			{ status: 403 }
		);
	}

	const wafUrl = inspectRequestPayload(request);
	if (wafUrl.matched) {
		void recordSecurityStrike({
			ip,
			points: wafUrl.points,
			reason: `WAF: ${wafUrl.signature}`,
			path: '/api/auth/passkey/login/options',
		});
		return NextResponse.json(
			{ error: 'Güvenlik duvarı (WAF) tarafından şüpheli istek engellendi.' },
			{ status: 403 }
		);
	}

	const limit = consumeRateLimit(`passkey:options:ip:${ip}`, 20, 60_000);
	if (!limit.allowed) {
		return NextResponse.json(
			{ error: 'Çok fazla istek, lütfen biraz bekleyin.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
		);
	}

	try {
		const rawText = await request.clone().text().catch(() => '');
		const wafBody = inspectRequestPayload(request, rawText);
		if (wafBody.matched) {
			void recordSecurityStrike({
				ip,
				points: wafBody.points,
				reason: `WAF: ${wafBody.signature}`,
				path: '/api/auth/passkey/login/options',
			});
			return NextResponse.json(
				{ error: 'Güvenlik duvarı (WAF) tarafından şüpheli istek engellendi.' },
				{ status: 403 }
			);
		}

		const body = await request.json().catch(() => ({}));
		const email = String(body.email ?? '').trim().toLowerCase();

		if (!email || email.length > 254) {
			return NextResponse.json({ error: 'E-posta zorunludur.' }, { status: 400 });
		}

		// Uniform message prevents distinguishing "not registered", "no passkey", and "pending/rejected"
		const UNIFORM_NOT_AVAILABLE =
			'Bu hesap için kullanılabilir bir passkey bulunamadı. Şifre ile giriş yapabilirsiniz.';

		const user = await getUserByEmail(email);
		if (!user || user.status !== 'aktif') {
			return NextResponse.json({ error: UNIFORM_NOT_AVAILABLE }, { status: 404 });
		}

		const credentials = await getWebauthnCredentials(user.id);
		if (credentials.length === 0) {
			return NextResponse.json({ error: UNIFORM_NOT_AVAILABLE }, { status: 404 });
		}

		const { rpID } = getWebauthnConfig(request);

		const options = await generateAuthenticationOptions({
			rpID,
			allowCredentials: credentials.map((c) => ({
				id: c.id,
				transports: parseTransports(c.transports),
			})),
			// The passkey itself is the second factor, so no extra user check is needed.
			userVerification: 'preferred',
			// Give password-manager extensions time to open their picker.
			timeout: 120_000,
		});

		const challengeId = newChallengeId();
		await createWebauthnChallenge({
			id: challengeId,
			userId: user.id,
			challenge: options.challenge,
			tur: 'giris',
		});

		return NextResponse.json({ success: true, challengeId, options });
	} catch (error) {
		console.error('API /api/auth/passkey/login/options error:', error);
		await logSystemEvent({
			servis: 'auth',
			seviye: 'WARN',
			mesaj: 'Passkey giriş seçenekleri oluşturulurken hata oluştu',
			ip,
		});
		return NextResponse.json({ error: 'Passkey girişi başlatılamadı.' }, { status: 500 });
	}
}
