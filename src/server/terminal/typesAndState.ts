import type { ChildProcess } from 'child_process';
import type { Writable } from 'stream';

export interface TerminalSession {
	id: string;
	userId: string;
	process: ChildProcess;
	controlStream: Writable | null;
	outputBuffer: string[];
	commandBuffer: string;
	listeners: Set<(data: string) => void>;
	closeListeners: Set<(exitCode: number | null) => void>;
	lastActive: number;
	cols: number;
	rows: number;
	isClosed: boolean;
}

export interface ClosedSessionInfo {
	userId: string;
	closedAt: number;
	exitCode: number | null;
}

declare global {
	var __terminalSessions: Map<string, TerminalSession> | undefined;
	var __terminalRecentlyClosed: Map<string, ClosedSessionInfo> | undefined;
	var __terminalInterval: NodeJS.Timeout | undefined;
}

// Global in-memory session registry (persists across Next.js Turbopack chunks and HMR in the Node process)
const globalStore = globalThis as typeof globalThis & {
	__terminalSessions?: Map<string, TerminalSession>;
	__terminalRecentlyClosed?: Map<string, ClosedSessionInfo>;
	__terminalInterval?: NodeJS.Timeout;
};

if (!globalStore.__terminalSessions) {
	globalStore.__terminalSessions = new Map<string, TerminalSession>();
}
if (!globalStore.__terminalRecentlyClosed) {
	globalStore.__terminalRecentlyClosed = new Map<string, ClosedSessionInfo>();
}

export const sessions = globalStore.__terminalSessions;
export const recentlyClosedSessions = globalStore.__terminalRecentlyClosed;

export const MAX_SESSIONS_PER_USER = 3;
export const MAX_GLOBAL_TERMINAL_SESSIONS = 24;

// Cleanup stale sessions after 60 minutes of inactivity and old closed session markers
if (!globalStore.__terminalInterval) {
	globalStore.__terminalInterval = setInterval(() => {
		const now = Date.now();
		for (const [id, session] of sessions.entries()) {
			if (now - session.lastActive > 60 * 60 * 1000) {
				try {
					session.process.kill('SIGTERM');
				} catch {
					// Stale child process may have already exited before cleanup.
				}
				sessions.delete(id);
			}
		}
		for (const [id, info] of recentlyClosedSessions.entries()) {
			if (now - info.closedAt > 60 * 1000) {
				recentlyClosedSessions.delete(id);
			}
		}
	}, 60 * 1000);
	globalStore.__terminalInterval.unref?.();
}

export function getTerminalSession(id: string): TerminalSession | undefined {
	return sessions.get(id);
}

export function getRecentlyClosedSession(id: string): ClosedSessionInfo | undefined {
	const info = recentlyClosedSessions.get(id);
	if (!info) return undefined;
	if (Date.now() - info.closedAt > 60 * 1000) {
		recentlyClosedSessions.delete(id);
		return undefined;
	}
	return info;
}
