import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { updateUserPassword } from '@/db';
import { verifyAuth } from '@/lib/auth/authGuard';
import { attachSessionCookie, establishSession } from '@/lib/auth/session';
import { clientAddress } from '@/lib/http';
import { clearRateLimit, isRateLimited, recordFailure } from '@/lib/rateLimit';
import { passwordProblem, PASSWORD_MAX } from '@/lib/profile';
import { closeUserTerminalSessions } from '@/lib/server/terminalManager';
import { logSystemEvent } from '@/server/db/domains/logs.repo';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60_000;

/**
 * Changes the member's password. The current one is required (a session left
 * open on a shared machine must not be enough), wrong guesses are rate limited
 * like sign-in, and the new one is checked against the shared rules.
 */
export async function POST(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;
	const ip = clientAddress(request);
	const key = `password-change:${auth.user.id}`;
	const gate = isRateLimited(key, MAX_ATTEMPTS);
	if (!gate.allowed) {
		return NextResponse.json(
			{ error: 'Çok fazla hatalı deneme. Lütfen daha sonra tekrar deneyin.' },
			{ status: 429, headers: { 'Retry-After': String(gate.retryAfter) } }
		);
	}
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const mevcut = typeof body.mevcut === 'string' ? body.mevcut : '';
		const yeni = body.yeni;
		if (!mevcut || mevcut.length > PASSWORD_MAX || !(await bcrypt.compare(mevcut, auth.user.passwordHash))) {
			const attempts = recordFailure(key, WINDOW_MS);
			await logSystemEvent({
				servis: 'auth',
				seviye: 'WARN',
				mesaj: `Şifre değiştirme hatalı mevcut şifre denemesi: ${auth.user.email}`,
				userId: auth.user.id,
				detay: { denemeSayisi: attempts },
				ip,
			});
			return NextResponse.json({ error: 'Mevcut şifre hatalı.' }, { status: 400 });
		}
		const problem = passwordProblem(yeni, { mevcut, email: auth.user.email });
		if (problem) return NextResponse.json({ error: problem }, { status: 400 });
		await updateUserPassword(auth.user.id, await bcrypt.hash(String(yeni), 12), true);
		try { closeUserTerminalSessions(auth.user.id); } catch {}
		clearRateLimit(key);
		const newSessionToken = await establishSession(auth.user, request, auth.user.authMethod ?? 'password');
		await logSystemEvent({
			servis: 'auth',
			seviye: 'INFO',
			mesaj: `Kullanıcı şifresini değiştirdi: ${auth.user.email}`,
			userId: auth.user.id,
			ip,
		});
		const response = NextResponse.json({
			success: true,
			message: 'Şifreniz değiştirildi ve diğer açık oturumlar güvenle sonlandırıldı.',
		});
		return attachSessionCookie(response, newSessionToken);
	} catch (error) {
		console.error('API /api/profil/password error:', error);
		return NextResponse.json({ error: 'Şifre değiştirilemedi.' }, { status: 500 });
	}
}
