import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import type { Writable } from 'stream';

interface TerminalSession {
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

const sessions = globalStore.__terminalSessions;
const recentlyClosedSessions = globalStore.__terminalRecentlyClosed;

const MAX_SESSIONS_PER_USER = 3;

/**
 * The environment handed to the shell.
 *
 * The server's own environment carries DATABASE_URL, AUTH_SECRET and the SMTP
 * password, none of which an interactive shell needs. This only removes the
 * casual exposure: the shell still runs as the same OS user as the server, which
 * is why the terminal is also opt-in outside development (see terminalAccess.ts).
 */
const ENV_ALLOWLIST = [
	'PATH',
	'HOME',
	'LANG',
	'LC_ALL',
	'LC_CTYPE',
	'TERM',
	'COLORTERM',
	'SHELL',
	'USER',
	'LOGNAME',
	'TZ',
	'TMUX',
	'TMUX_PANE',
	'LS_COLORS',
	'GREP_COLORS',
	'GCC_COLORS',
];

const VIVID_LS_COLORS =
	'rs=0:di=01;34:ln=01;36:mh=00:pi=40;33:so=01;35:do=01;35:bd=40;33;01:cd=40;33;01:or=40;31;01:mi=00:su=37;41:sg=30;43:ca=30;41:tw=30;42:ow=34;42:st=37;44:ex=01;32:*.tar=01;31:*.tgz=01;31:*.zip=01;31:*.gz=01;31:*.bz2=01;31:*.xz=01;31:*.jpg=01;35:*.jpeg=01;35:*.png=01;35:*.gif=01;35:*.svg=01;35:*.webp=01;35:*.mp4=01;35:*.mp3=01;36:*.json=01;33:*.yml=01;33:*.yaml=01;33:*.toml=01;33:*.ini=01;33:*.md=01;36';

const BASH_RC_POSTLUDE_B64 = Buffer.from(
	[
		'[ -r /etc/bash.bashrc ] && . /etc/bash.bashrc',
		'[ -r "$HOME/.bashrc" ] && . "$HOME/.bashrc"',
		"alias ls='ls --color=auto'",
		"alias grep='grep --color=auto'",
		"alias diff='diff --color=auto'",
		"alias ip='ip -color=auto'",
		'if [[ "$PS1" != *$' + "'\\033'" + '* && "$PS1" != *' + "'\\e'" + '* && "$PS1" != *' + "'\\033'" + '* ]]; then',
		'  PS1=' + "'\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;36m\\]\\w\\[\\033[01;35m\\]$(git branch --show-current 2>/dev/null | sed \"s/.*/ (&)/\")\\[\\033[01;33m\\]\\$\\[\\033[00m\\] '",
		'fi',
		'',
	].join('\n'),
	'utf-8'
).toString('base64');

function buildTerminalEnv(): NodeJS.ProcessEnv {
	const env: Record<string, string> = {};
	for (const key of ENV_ALLOWLIST) {
		const value = process.env[key];
		if (value !== undefined) env[key] = value;
	}
	// Cast: Next's typings make NODE_ENV mandatory on ProcessEnv, which a child
	// process environment deliberately does not carry.
	return {
		...env,
		TERM: 'xterm-256color',
		COLORTERM: 'truecolor',
		CLICOLOR: '1',
		CLICOLOR_FORCE: '1',
		FORCE_COLOR: '3',
		LS_COLORS: env.LS_COLORS || VIVID_LS_COLORS,
		GREP_COLORS: env.GREP_COLORS || 'ms=01;31:mc=01;31:sl=:cx=:fn=35:ln=32:bn=32:se=36',
		GCC_COLORS: env.GCC_COLORS || 'error=01;31:warning=01;35:note=01;36:caret=01;32:locus=01:quote=01',
		LANG: 'en_US.UTF-8',
		LC_ALL: 'en_US.UTF-8',
	} as unknown as NodeJS.ProcessEnv;
}

/**
 * Picks an interactive shell that actually exists in this environment.
 *
 * The path is interpolated into the PTY bridge script below, so anything that is
 * not a plain absolute path is rejected. Alpine images ship no bash, so the
 * fallback chain ends at /bin/sh.
 */
function resolveShell(): string {
	for (const candidate of [process.env.SHELL, '/bin/bash', '/bin/sh']) {
		if (candidate && /^\/[A-Za-z0-9_./-]+$/.test(candidate) && existsSync(/*turbopackIgnore: true*/ candidate)) {
			return candidate;
		}
	}
	return '/bin/sh';
}

// Cleanup stale sessions after 60 minutes of inactivity and old closed session markers
if (!globalStore.__terminalInterval) {
	globalStore.__terminalInterval = setInterval(() => {
		const now = Date.now();
		for (const [id, session] of sessions.entries()) {
			if (now - session.lastActive > 60 * 60 * 1000) {
				try {
					session.process.kill('SIGTERM');
				} catch {}
				sessions.delete(id);
			}
		}
		for (const [id, info] of recentlyClosedSessions.entries()) {
			if (now - info.closedAt > 60 * 1000) {
				recentlyClosedSessions.delete(id);
			}
		}
	}, 60 * 1000);
}

/** Keeps one account from exhausting the host with shells: the oldest one is closed. */
function enforceSessionCap(userId: string): void {
	const mine = [...sessions.values()]
		.filter((session) => session.userId === userId)
		.sort((a, b) => a.lastActive - b.lastActive);
	while (mine.length >= MAX_SESSIONS_PER_USER) {
		const oldest = mine.shift();
		if (oldest) closeTerminalSession(oldest.id);
	}
}

export function createTerminalSession(userId: string, initialCols = 80, initialRows = 24): string {
	enforceSessionCap(userId);

	const id = randomUUID();
	const cols = Math.max(10, Math.min(initialCols, 500));
	const rows = Math.max(4, Math.min(initialRows, 200));

	// Use python3 pty bridge to allocate an authentic Linux pseudo-terminal with live SIGWINCH resizing
	const shellPath = resolveShell();
	const ptyBridgeScript = `
import pty, os, sys, termios, struct, fcntl, select, tempfile, base64

rows = ${rows}
cols = ${cols}
shell_path = "${shellPath}"

master, slave = pty.openpty()
winsize = struct.pack("HHHH", rows, cols, 0, 0)
fcntl.ioctl(slave, termios.TIOCSWINSZ, winsize)

pid = os.fork()
if pid == 0:
    os.close(master)
    os.setsid()
    try:
        fcntl.ioctl(slave, termios.TIOCSCTTY, 0)
    except Exception:
        pass
    os.dup2(slave, 0)
    os.dup2(slave, 1)
    os.dup2(slave, 2)
    os.close(slave)
    os.environ["TERM"] = "xterm-256color"
    os.environ["COLORTERM"] = "truecolor"
    os.environ["CLICOLOR"] = "1"
    os.environ["CLICOLOR_FORCE"] = "1"
    os.environ["FORCE_COLOR"] = "3"
    os.environ["LANG"] = "en_US.UTF-8"
    os.environ["LC_ALL"] = "en_US.UTF-8"
    if shell_path.endswith("bash"):
        try:
            fd, rc_path = tempfile.mkstemp(prefix=".beu_bashrc_", text=True)
            with os.fdopen(fd, "w") as f:
                f.write('rm -f "' + rc_path + '"\\n')
                f.write(base64.b64decode("${BASH_RC_POSTLUDE_B64}").decode("utf-8"))
            os.execlp(shell_path, shell_path, "--rcfile", rc_path, "-i")
        except Exception:
            os.execlp(shell_path, shell_path, "-i")
    else:
        os.execlp(shell_path, shell_path, "-i")
else:
    os.close(slave)
    ctrl_buf = ""
    control_fd = 3

    while True:
        try:
            r, _, _ = select.select([0, master, control_fd], [], [])
        except Exception:
            break

        if 0 in r:
            try:
                data = os.read(0, 2048)
                if not data:
                    break
                os.write(master, data)
            except OSError:
                break

        if master in r:
            try:
                data = os.read(master, 2048)
                if not data:
                    break
                os.write(1, data)
            except OSError:
                # EIO (Errno 5) occurs normally when the child exits
                break

        if control_fd in r:
            try:
                data = os.read(control_fd, 1024).decode("utf-8", errors="ignore")
                if data:
                    ctrl_buf += data
                    while "\\n" in ctrl_buf:
                        line, ctrl_buf = ctrl_buf.split("\\n", 1)
                        line = line.strip()
                        if line.startswith("RESIZE:"):
                            parts = line.split(":")
                            c = int(parts[1])
                            rw = int(parts[2])
                            new_ws = struct.pack("HHHH", rw, c, 0, 0)
                            fcntl.ioctl(master, termios.TIOCSWINSZ, new_ws)
            except Exception:
                pass
`;

	let proc: ChildProcess;
	let controlStream: Writable | null = null;

	try {
		proc = spawn('python3', ['-u', '-c', ptyBridgeScript], {
			env: buildTerminalEnv(),
			stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
		});
		controlStream = (proc.stdio[3] as unknown as Writable) || null;
	} catch {
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
		session.outputBuffer.push(text);
		if (session.outputBuffer.length > 300) {
			session.outputBuffer.shift();
		}
		for (const listener of session.listeners) {
			try {
				listener(text);
			} catch {}
		}
	});

	proc.stderr?.on('data', (chunk: Buffer) => {
		session.lastActive = Date.now();
		const text = chunk.toString('utf-8');
		session.outputBuffer.push(text);
		for (const listener of session.listeners) {
			try {
				listener(text);
			} catch {}
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
			} catch {}
		}
		sessions.delete(id);
	};

	proc.on('close', (code) => handleSessionClose(code));
	proc.on('exit', (code) => handleSessionClose(code));

	sessions.set(id, session);
	return id;
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
			} catch {}
		}
		try {
			session.process.kill('SIGTERM');
		} catch {}
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
