import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth/access';
import { getUserById, setUserTotpStep } from '@/db';
import { verifyTotpCodeDetailed } from '@/lib/auth/totp';
import { createDatabaseSessionToken, isUserDatabaseFrozen } from '@/server/databaseAccess';
import { clearRateLimit, isRateLimited, recordFailure } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { recordSecurityStrike } from '@/db/repositories/security.repo';

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60_000;

export async function POST(request: Request) {
	const auth = await authenticate(request);
	if (!auth.authorized) return auth.response;

	if (!auth.user.permission.admin) {
		return NextResponse.json(
			{ error: 'Veritabanı stüdyosuna yalnızca yöneticiler erişebilir.', code: 'ADMIN_REQUIRED' },
			{ status: 403 }
		);
	}

	if (isUserDatabaseFrozen(auth.user.id)) {
		return NextResponse.json(
			{
				error: 'Veritabanı erişimi SoC güvenlik tecrit protokolü kapsamında dondurulmuştur.',
				code: 'DATABASE_ACCESS_FROZEN',
			},
			{ status: 403 }
		);
	}

	const ip = clientAddress(request);
	const rateKey = `2fa:db:${auth.user.id}`;
	const gate = isRateLimited(rateKey, MAX_ATTEMPTS);
	if (!gate.allowed) {
		return NextResponse.json(
			{
				error: `Çok fazla hatalı 2FA denemesi. ${Math.ceil(gate.retryAfter / 60)} dakika sonra tekrar deneyin.`,
				code: 'RATE_LIMITED',
			},
			{ status: 429, headers: { 'Retry-After': String(gate.retryAfter) } }
		);
	}

	const user = await getUserById(auth.user.id);
	if (!user) {
		return NextResponse.json({ error: 'Kullanıcı bulunamadı.' }, { status: 404 });
	}

	try {
		const body = await request.json().catch(() => ({}));

		// A passkey session already satisfies the second-factor requirement, so it
		// receives the short-lived database token without a fresh TOTP code.
		if (String(body.method || '') === 'passkey') {
			if ((auth.user.authMethod ?? 'password') !== 'passkey') {
				return NextResponse.json(
					{
						error: 'This session was not authenticated with a passkey. Sign in with your passkey or enter a TOTP code.',
						code: 'PASSKEY_SESSION_REQUIRED',
					},
					{ status: 403 }
				);
			}
			const token = await createDatabaseSessionToken(auth.user.id);
			await logSystemEvent({
				servis: 'database',
				seviye: 'INFO',
				mesaj: 'Veritabanı Yöneticisi passkey oturumu ile açıldı',
				detay: { email: auth.user.email },
				userId: auth.user.id,
				ip,
			});
			return NextResponse.json({ success: true, token, expiresInMs: 30 * 60 * 1000, method: 'passkey' });
		}

		if (Number(user.totpEnabled) !== 1 || !user.totpSecret) {
			return NextResponse.json(
				{
					error: 'Veritabanı yöneticisini kullanabilmek için iki adımlı doğrulamayı (2FA) Ayarlar bölümünden etkinleştirmeniz gerekmektedir.',
					code: '2FA_SETUP_REQUIRED',
				},
				{ status: 403 }
			);
		}

		const code = String(body.code || '').trim();

		if (!code) {
			return NextResponse.json(
				{ error: '2FA doğrulama kodu gereklidir.', code: '2FA_CODE_REQUIRED' },
				{ status: 400 }
			);
		}

		const verification = await verifyTotpCodeDetailed(user.totpSecret, code, user.totpSonAdim);

		if (!verification.valid) {
			recordFailure(rateKey, WINDOW_MS);
			await recordSecurityStrike({
				ip,
				points: 20,
				reason: 'Veritabanı Stüdyosu hatalı 2FA doğrulama denemesi',
				userId: user.id,
			});
			await logSystemEvent({
				servis: 'database',
				seviye: 'WARN',
				mesaj: 'Geçersiz 2FA kodu ile veritabanı erişim denemesi',
				detay: { email: user.email },
				userId: user.id,
				ip,
			});
			return NextResponse.json(
				{ error: 'Geçersiz veya süresi dolmuş 2FA kodu.', code: 'INVALID_2FA_CODE' },
				{ status: 401 }
			);
		}

		clearRateLimit(rateKey);

		if (verification.timeStep !== null) {
			await setUserTotpStep(user.id, verification.timeStep);
		}

		const token = await createDatabaseSessionToken(user.id);

		await logSystemEvent({
			servis: 'database',
			seviye: 'INFO',
			mesaj: 'Veritabanı Yöneticisi 2FA oturumu başlatıldı',
			detay: { email: user.email },
			userId: user.id,
			ip,
		});

		return NextResponse.json({
			success: true,
			token,
			expiresInMs: 30 * 60 * 1000,
		});
	} catch (error) {
		console.error('API /api/database/auth error:', error);
		return NextResponse.json({ error: '2FA doğrulama işlemi başarısız.' }, { status: 500 });
	}
}
