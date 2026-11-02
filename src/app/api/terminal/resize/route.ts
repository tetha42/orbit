import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { resizeTerminalSession, getTerminalSession } from '@/server/terminalManager';
import { authorizeTerminal } from '@/server/terminalAccess';

interface ResizeSessionBody {
	sessionId?: unknown;
	cols?: unknown;
	rows?: unknown;
}

async function handlePOST(request: Request) {
	const auth = await authorizeTerminal(request);
	if (!auth.authorized) return auth.response;

	try {
		const body = (await request.json().catch(() => ({}))) as ResizeSessionBody;
		const { sessionId, cols, rows } = body;

		if (!sessionId || typeof sessionId !== 'string') {
			return NextResponse.json({ error: 'Geçersiz sessionId' }, { status: 400 });
		}

		const session = getTerminalSession(sessionId);
		if (!session) {
			return NextResponse.json({ error: 'Oturum bulunamadı veya sonlandı' }, { status: 404 });
		}

		if (session.userId !== auth.user.id) {
			return NextResponse.json({ error: 'Bu oturumu yönetme yetkiniz yok' }, { status: 403 });
		}

		const numCols = typeof cols === 'number' && cols > 0 ? cols : 80;
		const numRows = typeof rows === 'number' && rows > 0 ? rows : 24;

		const ok = resizeTerminalSession(sessionId, numCols, numRows);
		return NextResponse.json({ ok, cols: numCols, rows: numRows });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Terminal boyutu güncellenemedi';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'terminal.resize.create', target: 'terminal.resize' });
