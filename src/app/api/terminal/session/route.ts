import { NextResponse } from 'next/server';
import { createTerminalSession, closeTerminalSession, getTerminalSession } from '@/server/terminalManager';
import { authorizeTerminal } from '@/server/terminalAccess';

import { getUserById, setUserTotpStep } from '@/db';
import { verifyTotpCodeDetailed } from '@/lib/auth/totp';
import { clearRateLimit, isRateLimited, recordFailure } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { recordSecurityStrike } from '@/db/repositories/security.repo';

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60_000;

interface CreateSessionBody {
	cols?: unknown;
	rows?: unknown;
	code?: unknown;
}

interface DeleteSessionBody {
	sessionId?: unknown;
}

export async function POST(request: Request) {
	const auth = await authorizeTerminal(request);
	if (!auth.authorized) return auth.response;

	const ip = clientAddress(request);
	const body = (await request.json().catch(() => ({}))) as CreateSessionBody;
	const rateKey = `2fa:terminal:${auth.user.id}`;
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

	// A passkey sign-in is already multi-factor. The session can open a shell
	// without replaying a TOTP code; a password/TOTP session still steps up.
	if ((user.authMethod ?? 'password') === 'passkey') {
		const cols = typeof body.cols === 'number' && body.cols > 10 ? body.cols : 80;
		const rows = typeof body.rows === 'number' && body.rows > 5 ? body.rows : 24;
		const sessionId = createTerminalSession(auth.user.id, cols, rows);
		await logSystemEvent({
			servis: 'terminal',
			seviye: 'INFO',
			mesaj: `${user.ad} ${user.soyad} (${user.email}) terminal oturumu başlattı (passkey oturumu).`,
			userId: user.id,
			ip,
		});
		return NextResponse.json({ sessionId, ok: true, authMethod: 'passkey' });
	}

	if (Number(user.totpEnabled) !== 1) {
		return NextResponse.json(
			{
				error: 'Terminali kullanabilmek için iki adımlı doğrulamayı (2FA) etkinleştirmeniz gerekmektedir.',
				code: '2FA_SETUP_REQUIRED',
			},
			{ status: 403 }
		);
	}

	try {
		const code = String(body.code || '').trim();

		if (!code) {
			return NextResponse.json(
				{ error: 'Terminali başlatmak için 2FA doğrulama kodu gereklidir.', code: '2FA_CODE_REQUIRED' },
				{ status: 400 }
			);
		}

		const verification = user.totpSecret
			? await verifyTotpCodeDetailed(user.totpSecret, code, user.totpSonAdim)
			: { valid: false, timeStep: null };

		if (!verification.valid) {
			const alreadyUsed = verification.reused === true;
			recordFailure(rateKey, WINDOW_MS);
			await recordSecurityStrike({
				ip,
				points: 20,
				reason: 'Terminal oturumu hatalı 2FA doğrulama denemesi',
				userId: user.id,
			});
			await logSystemEvent({
				servis: 'terminal',
				seviye: 'WARN',
				mesaj: alreadyUsed
					? `${user.ad} ${user.soyad} (${user.email}) daha önce kullanılmış bir 2FA kodu ile terminal oturumu başlatmayı denedi.`
					: `${user.ad} ${user.soyad} (${user.email}) geçersiz 2FA kodu ile terminal oturumu başlatmayı denedi.`,
				userId: user.id,
				ip,
			});
			return NextResponse.json(
				{
					error: alreadyUsed
						? 'Bu 2FA kodu daha önce kullanıldı. Authenticator uygulamanızda yeni bir kod oluşmasını bekleyip tekrar deneyin.'
						: 'Geçersiz veya süresi dolmuş 2FA kodu.',
					code: alreadyUsed ? 'TOTP_CODE_ALREADY_USED' : 'INVALID_2FA_CODE',
				},
				{ status: 401 }
			);
		}

		clearRateLimit(rateKey);

		if (verification.timeStep !== null) {
			await setUserTotpStep(user.id, verification.timeStep);
		}

		// Security audit log
		await logSystemEvent({
			servis: 'terminal',
			seviye: 'INFO',
			mesaj: `${user.ad} ${user.soyad} (${user.email}) terminal oturumu başlattı (2FA doğrulandı).`,
			userId: user.id,
			ip,
		});

		const cols = typeof body.cols === 'number' && body.cols > 10 ? body.cols : 80;
		const rows = typeof body.rows === 'number' && body.rows > 5 ? body.rows : 24;

		const sessionId = createTerminalSession(auth.user.id, cols, rows);
		return NextResponse.json({ sessionId, ok: true });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Terminal oturumu başlatılamadı';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	const auth = await authorizeTerminal(request);
	if (!auth.authorized) return auth.response;

	try {
		const { searchParams } = new URL(request.url);
		let sessionId = searchParams.get('sessionId');

		if (!sessionId) {
			const body = (await request.json().catch(() => ({}))) as DeleteSessionBody;
			sessionId = typeof body.sessionId === 'string' ? body.sessionId : null;
		}

		if (sessionId) {
			const session = getTerminalSession(sessionId);
			if (session && session.userId === auth.user.id) {
				closeTerminalSession(sessionId);
			}
		}

		return NextResponse.json({ ok: true });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Terminal kapatılamadı';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
