import { NextResponse } from 'next/server';
import { writeToTerminal, getTerminalSession } from '@/server/terminalManager';
import { authorizeTerminal } from '@/server/terminalAccess';
import { clientAddress } from '@/lib/http';
import { InvalidBodyError, PayloadTooLargeError, readBoundedJson } from '@/lib/httpBodyGuard';
import { logSystemEvent } from '@/db/repositories/logs.repo';

/** A paste can be large, but nothing legitimate sends megabytes in one keystroke batch. */
const MAX_INPUT_LENGTH = 64 * 1024;
const MAX_INPUT_BODY_BYTES = 128 * 1024;

interface TerminalInputBody {
	sessionId?: unknown;
	data?: unknown;
}

export async function POST(request: Request) {
	const auth = await authorizeTerminal(request);
	if (!auth.authorized) return auth.response;

	try {
		const body = await readBoundedJson<TerminalInputBody>(request, MAX_INPUT_BODY_BYTES);
		const { sessionId, data } = body;

		if (!sessionId || typeof sessionId !== 'string' || typeof data !== 'string') {
			return NextResponse.json({ error: 'Invalid parameters.' }, { status: 400 });
		}
		if (data.length > MAX_INPUT_LENGTH) {
			return NextResponse.json({ error: 'Input is too large.' }, { status: 413 });
		}

		const session = getTerminalSession(sessionId);
		if (!session || session.userId !== auth.user.id) {
			return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
		}

		const { ok, executedCommands } = writeToTerminal(sessionId, data);
		if (ok && executedCommands.length > 0) {
			const ip = clientAddress(request);
			for (const cmd of executedCommands) {
				void logSystemEvent({
					service: 'terminal',
					level: 'INFO',
					message: `Terminal command executed (${auth.user.email}): ${cmd.slice(0, 120)}`,
					detail: { command: cmd, sessionId },
					userId: auth.user.id,
					ip,
				});
			}
		}

		return NextResponse.json({ success: ok });
	} catch (error: unknown) {
		if (error instanceof PayloadTooLargeError) {
			return NextResponse.json({ error: 'Input is too large.' }, { status: 413 });
		}
		if (error instanceof InvalidBodyError) {
			return NextResponse.json({ error: 'Invalid parameters.' }, { status: 400 });
		}
		console.error('[terminal/input] failed:', error);
		return NextResponse.json({ error: 'Failed to deliver input.' }, { status: 500 });
	}
}
