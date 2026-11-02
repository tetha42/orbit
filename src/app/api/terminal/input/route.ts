import { NextResponse } from 'next/server';
import { writeToTerminal, getTerminalSession } from '@/server/terminalManager';
import { authorizeTerminal } from '@/server/terminalAccess';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/db/repositories/logs.repo';

/** A paste can be large, but nothing legitimate sends megabytes in one keystroke batch. */
const MAX_INPUT_LENGTH = 64 * 1024;

interface TerminalInputBody {
	sessionId?: unknown;
	data?: unknown;
}

export async function POST(request: Request) {
	const auth = await authorizeTerminal(request);
	if (!auth.authorized) return auth.response;

	try {
		const body = (await request.json().catch(() => ({}))) as TerminalInputBody;
		const { sessionId, data } = body;

		if (!sessionId || typeof sessionId !== 'string' || typeof data !== 'string') {
			return NextResponse.json({ error: 'Geçersiz parametreler' }, { status: 400 });
		}
		if (data.length > MAX_INPUT_LENGTH) {
			return NextResponse.json({ error: 'Girdi çok büyük' }, { status: 413 });
		}

		const session = getTerminalSession(sessionId);
		if (!session || session.userId !== auth.user.id) {
			return NextResponse.json({ error: 'Oturum bulunamadı' }, { status: 404 });
		}

		const { ok, executedCommands } = writeToTerminal(sessionId, data);
		if (ok && executedCommands.length > 0) {
			const ip = clientAddress(request);
			for (const cmd of executedCommands) {
				void logSystemEvent({
					servis: 'terminal',
					seviye: 'INFO',
					mesaj: `Terminal komutu çalıştırıldı (${auth.user.email}): ${cmd.slice(0, 120)}`,
					detay: { komut: cmd, sessionId },
					userId: auth.user.id,
					ip,
				});
			}
		}

		return NextResponse.json({ success: ok });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Girdi iletilemedi';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
