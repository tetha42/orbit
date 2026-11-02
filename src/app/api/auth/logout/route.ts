import { NextResponse } from 'next/server';
import { getUserBySessionToken, updateUserSession } from '@/db';
import { readSessionToken } from '@/lib/auth/authGuard';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { closeUserTerminalSessions } from '@/server/terminalManager';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/db/repositories/logs.repo';

export async function POST(request: Request) {
	try {
		const sessionToken = readSessionToken(request);
		const ip = clientAddress(request);

		if (sessionToken) {
			const user = await getUserBySessionToken(sessionToken);
			if (user) {
				// Clear session token in database
				await updateUserSession(user.id, null);
				// Terminate any active terminal PTY processes
				closeUserTerminalSessions(user.id);
				// Log audit event
				await logSystemEvent({
					servis: 'auth',
					seviye: 'INFO',
					mesaj: `Kullanıcı güvenli çıkış yaptı: ${user.ad} ${user.soyad} (${user.email})`,
					userId: user.id,
					ip,
				});
			}
		}

		const response = NextResponse.json({ success: true, message: 'Oturum kapatıldı' });
		response.cookies.delete(SESSION_COOKIE);
		return response;
	} catch (error) {
		console.error('API error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}
