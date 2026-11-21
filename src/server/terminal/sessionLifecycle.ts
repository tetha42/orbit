import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import type { Writable } from 'stream';
import { buildPtyBridgeScript, buildTerminalEnv, resolveShell } from './envAndPty';
import {
	MAX_GLOBAL_TERMINAL_SESSIONS,
	MAX_SESSIONS_PER_USER,
	recentlyClosedSessions,
	sessions,
	type TerminalSession,
} from './typesAndState';

const MAX_OUTPUT_CHUNK_CHARS = 16 * 1024;

function pushBoundedOutput(session: TerminalSession, text: string): void {
	const bounded = text.length > MAX_OUTPUT_CHUNK_CHARS ? text.slice(-MAX_OUTPUT_CHUNK_CHARS) : text;
	session.outputBuffer.push(bounded);
	if (session.outputBuffer.length > 300) {
		session.outputBuffer.shift();
	}
}

/** Keeps one account and the host from exhausting descriptors with shells. */
function enforceSessionCap(userId: string): void {
	const mine = [...sessions.values()]
		.filter((session) => session.userId === userId)
		.sort((a, b) => a.lastActive - b.lastActive);
	while (mine.length >= MAX_SESSIONS_PER_USER) {
		const oldest = mine.shift();
		if (oldest) closeTerminalSession(oldest.id);
	}
	const all = [...sessions.values()].sort((a, b) => a.lastActive - b.lastActive);
	while (all.length >= MAX_GLOBAL_TERMINAL_SESSIONS) {
		const oldestGlobal = all.shift();
		if (oldestGlobal) closeTerminalSession(oldestGlobal.id);
	}
}

export function createTerminalSession(userId: string, initialCols = 80, initialRows = 24): string {
	enforceSessionCap(userId);

	const id = randomUUID();
	const cols = Math.max(10, Math.min(initialCols, 500));
	const rows = Math.max(4, Math.min(initialRows, 200));

	// Use python3 pty bridge to allocate an authentic Linux pseudo-terminal with live SIGWINCH resizing
	const shellPath = resolveShell();
	const ptyBridgeScript = buildPtyBridgeScript(cols, rows, shellPath);

	let proc: ChildProcess;
	let controlStream: Writable | null = null;

	const canUsePty =
		existsSync('/usr/bin/python3') || existsSync('/usr/local/bin/python3') || existsSync('/bin/python3');
	if (canUsePty) {
		proc = spawn('python3', ['-u', '-c', ptyBridgeScript], {
			env: buildTerminalEnv(),
			stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
		});
		controlStream = (proc.stdio[3] as unknown as Writable) || null;
	} else {
		// Runtime path by design (validated in resolveShell); not a file to bundle.
		proc = spawn(/*turbopackIgnore: true*/ shellPath, ['-i'], {
			env: buildTerminalEnv(),
			stdio: ['pipe', 'pipe', 'pipe'],
		});
	}

	const session: TerminalSession = {
		id,
		userId,
		process: proc,
		controlStream,
		outputBuffer: [],
		commandBuffer: '',
		listeners: new Set(),
		closeListeners: new Set(),
		lastActive: Date.now(),
		cols,
		rows,
		isClosed: false,
	};

	proc.stdout?.on('data', (chunk: Buffer) => {
		session.lastActive = Date.now();
		const text = chunk.toString('utf-8');
		pushBoundedOutput(session, text);
		for (const listener of session.listeners) {
			try {
				listener(text);
			} catch {
				// Isolate broken stdout SSE subscriber from sibling listeners.
			}
		}
	});

	proc.stderr?.on('data', (chunk: Buffer) => {
		session.lastActive = Date.now();
		const text = chunk.toString('utf-8');
		pushBoundedOutput(session, text);
		for (const listener of session.listeners) {
			try {
				listener(text);
			} catch {
				// Isolate broken stderr SSE subscriber from sibling listeners.
			}
		}
	});

	const handleSessionClose = (code: number | null) => {
		if (session.isClosed) return;
		session.isClosed = true;
		recentlyClosedSessions.set(id, {
			userId: session.userId,
			closedAt: Date.now(),
			exitCode: code,
		});
		for (const closeListener of session.closeListeners) {
			try {
				closeListener(code);
			} catch {
				// Isolate broken close subscriber during session exit cleanup.
			}
		}
		sessions.delete(id);
	};

	proc.on('error', (err) => {
		console.error('[TerminalManager] Process error:', err);
		handleSessionClose(1);
	});
	proc.on('close', (code) => handleSessionClose(code));
	proc.on('exit', (code) => handleSessionClose(code));

	sessions.set(id, session);
	return id;
}

export function writeToTerminal(id: string, data: string): { ok: boolean; executedCommands: string[] } {
	const session = sessions.get(id);
	if (!session || !session.process.stdin?.writable) return { ok: false, executedCommands: [] };
	session.lastActive = Date.now();
	session.process.stdin.write(data);

	const executedCommands: string[] = [];
	for (const ch of data) {
		if (ch === '\r' || ch === '\n') {
			const cmd = session.commandBuffer.trim();
			if (cmd) {
				executedCommands.push(cmd.slice(0, 300));
			}
			session.commandBuffer = '';
		} else if (ch === '\x7f' || ch === '\b') {
			session.commandBuffer = session.commandBuffer.slice(0, -1);
		} else if (ch === '\x03' || ch === '\x15') {
			// Ctrl+C or Ctrl+U clears the current line buffer
			session.commandBuffer = '';
		} else if (ch >= ' ' && ch !== '\x1b' && session.commandBuffer.length < 500) {
			session.commandBuffer += ch;
		}
	}

	return { ok: true, executedCommands };
}

export function resizeTerminalSession(id: string, cols: number, rows: number): boolean {
	const session = sessions.get(id);
	if (!session) return false;

	const safeCols = Math.max(10, Math.min(cols, 500));
	const safeRows = Math.max(4, Math.min(rows, 200));

	session.cols = safeCols;
	session.rows = safeRows;
	session.lastActive = Date.now();

	if (session.controlStream && session.controlStream.writable) {
		try {
			session.controlStream.write(`RESIZE:${safeCols}:${safeRows}\n`);
			return true;
		} catch (err) {
			console.error('[TerminalManager] Failed to write to controlStream:', err);
		}
	}
	return false;
}

export function closeTerminalSession(id: string): void {
	const session = sessions.get(id);
	if (session) {
		session.isClosed = true;
		recentlyClosedSessions.set(id, {
			userId: session.userId,
			closedAt: Date.now(),
			exitCode: 0,
		});
		for (const closeListener of session.closeListeners) {
			try {
				closeListener(0);
			} catch {
				// Isolate broken close subscriber during forced session termination.
			}
		}
		session.listeners.clear();
		session.closeListeners.clear();
		const child = session.process;
		try {
			child.kill('SIGTERM');
		} catch {
			// Process may have already exited before SIGTERM.
		}
		const killTimer = setTimeout(() => {
			if (child.exitCode === null && child.signalCode === null) {
				try {
					child.kill('SIGKILL');
				} catch {
					// Process may have already exited before SIGKILL.
				}
			}
		}, 2000);
		killTimer.unref?.();
		sessions.delete(id);
	}
}

export function closeUserTerminalSessions(userId: string): number {
	let closed = 0;
	for (const [id, session] of sessions.entries()) {
		if (session.userId === userId) {
			closeTerminalSession(id);
			closed++;
		}
	}
	return closed;
}
