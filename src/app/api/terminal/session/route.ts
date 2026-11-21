import { NextResponse } from 'next/server';
import { createTerminalSession, closeTerminalSession, getTerminalSession } from '@/server/terminalManager';
import { authorizeTerminal } from '@/server/terminalAccess';
import { getUserById, setUserTotpStep } from '@/db';
import { verifyTotpCodeDetailed } from '@/lib/auth/totp';
import { clearRateLimit, isRateLimited, recordFailure } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { PayloadTooLargeError, readBoundedJson } from '@/lib/httpBodyGuard';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { recordSecurityStrike } from '@/db/repositories/security.repo';
import terminalContract from '@/apps/terminal/terminal.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';

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

function clampTerminalCols(raw: unknown): number {
	const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.trunc(raw) : 80;
	return Math.min(300, Math.max(20, n));
}

function clampTerminalRows(raw: unknown): number {
	const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.trunc(raw) : 24;
	return Math.min(120, Math.max(10, n));
}

export async function POST(request: Request) {
	const auth = await authorizeTerminal(request);
	if (!auth.authorized) return auth.response;

	const ip = clientAddress(request);
	let body: CreateSessionBody = {};
	try {
		body = await readBoundedJson<CreateSessionBody>(request, 32 * 1024);
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return NextResponse.json({ error: 'Request payload is too large.' }, { status: 413 });
		}
	}
	const rateKey = `2fa:terminal:${auth.user.id}`;
	const gate = isRateLimited(rateKey, MAX_ATTEMPTS);
	if (!gate.allowed) {
		const res = contractErrorResponse(
			terminalContract,
			'TERMINAL_SESSION_LIMIT',
			`Too many invalid 2FA attempts. Try again in ${Math.ceil(gate.retryAfter / 60)} minutes.`,
			{
				code: 'RATE_LIMITED',
				maxConcurrentShells: terminalContract.limits.maxConcurrentShellsPerUser,
			}
		);
		res.headers.set('Retry-After', String(gate.retryAfter));
		return res;
	}

	const user = await getUserById(auth.user.id);
	if (!user) {
		return NextResponse.json({ error: 'User not found.' }, { status: 404 });
	}

	// A passkey sign-in is already multi-factor. The session can open a shell
	// without replaying a TOTP code; a password/TOTP session still steps up.
	if ((user.authMethod ?? 'password') === 'passkey') {
		const cols = clampTerminalCols(body.cols);
		const rows = clampTerminalRows(body.rows);
		const sessionId = createTerminalSession(auth.user.id, cols, rows);
		const userName = `${user.firstName || user.name || ''} ${user.lastName || user.surname || ''}`.trim();
		await logSystemEvent({
			service: 'terminal',
			level: 'INFO',
			message: `${userName} (${user.email}) started a terminal session (passkey session).`,
			detail: {
				maxConcurrentShellsPerUser: terminalContract.limits.maxConcurrentShellsPerUser,
				sessionTimeoutSeconds: terminalContract.limits.sessionTimeoutSeconds,
			},
			userId: user.id,
			ip,
		});
		return NextResponse.json({ sessionId, ok: true, authMethod: 'passkey' });
	}

	if (Number(user.totpEnabled) !== 1) {
		return NextResponse.json(
			{
				error: 'Two-factor authentication (2FA) must be enabled to use the terminal.',
				code: '2FA_SETUP_REQUIRED',
			},
			{ status: 403 }
		);
	}

	try {
		const code = String(body.code || '').trim();

		if (!code) {
			return NextResponse.json(
				{ error: 'A 2FA verification code is required to start the terminal.', code: '2FA_CODE_REQUIRED' },
				{ status: 400 }
			);
		}

		const verification = user.totpSecret
			? await verifyTotpCodeDetailed(user.totpSecret, code, user.totpLastStep)
			: { valid: false, timeStep: null };

		if (!verification.valid) {
			const alreadyUsed = verification.reused === true;
			recordFailure(rateKey, WINDOW_MS);
			await recordSecurityStrike({
				ip,
				points: 20,
				reason: 'Failed 2FA verification attempt for terminal session',
				userId: user.id,
			});
			const userName = `${user.firstName || user.name || ''} ${user.lastName || user.surname || ''}`.trim();
			await logSystemEvent({
				service: 'terminal',
				level: 'WARN',
				message: alreadyUsed
					? `${userName} (${user.email}) attempted to start a terminal session with an already-used 2FA code.`
					: `${userName} (${user.email}) attempted to start a terminal session with an invalid 2FA code.`,
				userId: user.id,
				ip,
			});
			return NextResponse.json(
				{
					error: alreadyUsed
						? 'This 2FA code has already been used. Wait for a new code in your authenticator app and try again.'
						: 'Invalid or expired 2FA code.',
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
		const userName = `${user.firstName || user.name || ''} ${user.lastName || user.surname || ''}`.trim();
		await logSystemEvent({
			service: 'terminal',
			level: 'INFO',
			message: `${userName} (${user.email}) started a terminal session (2FA verified).`,
			detail: {
				maxConcurrentShellsPerUser: terminalContract.limits.maxConcurrentShellsPerUser,
				sessionTimeoutSeconds: terminalContract.limits.sessionTimeoutSeconds,
			},
			userId: user.id,
			ip,
		});

		const cols = clampTerminalCols(body.cols);
		const rows = clampTerminalRows(body.rows);

		const sessionId = createTerminalSession(auth.user.id, cols, rows);
		return NextResponse.json({ sessionId, ok: true });
	} catch (error: unknown) {
		console.error('[terminal/session] POST failed:', error);
		if (error instanceof Error && error.message.includes('capacity')) {
			return NextResponse.json({ error: 'Terminal session capacity reached.' }, { status: 429 });
		}
		return NextResponse.json({ error: 'Failed to start terminal session.' }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	const auth = await authorizeTerminal(request);
	if (!auth.authorized) return auth.response;

	try {
		const { searchParams } = new URL(request.url);
		let sessionId = searchParams.get('sessionId');

		if (!sessionId) {
			const body = await readBoundedJson<DeleteSessionBody>(request, 16 * 1024).catch(
				() => ({}) as DeleteSessionBody
			);
			sessionId = typeof body.sessionId === 'string' ? body.sessionId : null;
		}

		if (sessionId) {
			const session = getTerminalSession(sessionId);
			if (session && session.userId === auth.user.id) {
				closeTerminalSession(sessionId);
				void logSystemEvent({
					service: 'terminal',
					level: 'INFO',
					message: `${auth.user.email} closed terminal session ${sessionId}.`,
					detail: { sessionId },
					userId: auth.user.id,
					ip: clientAddress(request),
				});
			}
		}

		return NextResponse.json({ ok: true });
	} catch (error: unknown) {
		console.error('[terminal/session] DELETE failed:', error);
		return NextResponse.json({ error: 'Failed to close terminal session.' }, { status: 500 });
	}
}
