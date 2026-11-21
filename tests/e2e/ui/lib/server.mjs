// Starting and stopping an isolated Next.js server for E2E suites.
//
// By default this launches the prebuilt production standalone server (`node .next/standalone/server.js`),
// which boots in under a second with ~100 MB RSS and zero on-demand Turbopack compilation.
// Pass `E2E_DEV_SERVER=1` only if you explicitly need `next dev`.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, TMP } from './env.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function reachable(base) {
	try {
		await fetch(`${base}/api/auth/me`, { signal: AbortSignal.timeout(2000) });
		return true;
	} catch {
		return false;
	}
}

function ensureSymlink(linkPath, targetPath, replaceRealDir = false) {
	if (!fs.existsSync(targetPath)) return;
	try {
		const stat = fs.lstatSync(linkPath);
		if (stat.isSymbolicLink()) {
			const current = path.resolve(path.dirname(linkPath), fs.readlinkSync(linkPath));
			if (current === path.resolve(targetPath) && fs.existsSync(linkPath)) return;
			fs.rmSync(linkPath, { recursive: true, force: true });
		} else if (fs.existsSync(linkPath)) {
			if (!replaceRealDir) return;
			fs.rmSync(linkPath, { recursive: true, force: true });
		}
	} catch {
		// Link does not exist yet
	}
	fs.mkdirSync(path.dirname(linkPath), { recursive: true });
	fs.symlinkSync(targetPath, linkPath, 'dir');
}

function mergeNodeOptions(existing = '', mb = 112) {
	const parts = [existing.trim()];
	if (!existing.includes('--max-old-space-size')) parts.push(`--max-old-space-size=${mb}`);
	if (!existing.includes('--max-semi-space-size')) parts.push('--max-semi-space-size=2');
	return parts.filter(Boolean).join(' ');
}

export function ensureStandaloneServer() {
	const standaloneDir = path.join(ROOT, '.next', 'standalone');
	const serverScript = path.join(standaloneDir, 'server.js');
	if (!fs.existsSync(serverScript)) {
		if (process.env.E2E_AUTO_BUILD === '1') {
			const built = spawnSync('pnpm', ['build'], {
				cwd: ROOT,
				env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
				stdio: 'inherit',
			});
			if (built.status !== 0) throw new Error('E2E_AUTO_BUILD=1 failed during `pnpm build`.');
		} else {
			throw new Error(
				'Missing `.next/standalone/server.js`. Run `NEXT_TELEMETRY_DISABLED=1 pnpm build` first (or set E2E_AUTO_BUILD=1).'
			);
		}
	}
	ensureSymlink(path.join(standaloneDir, '.next', 'static'), path.join(ROOT, '.next', 'static'), true);
	ensureSymlink(path.join(standaloneDir, 'public'), path.join(ROOT, 'public'), true);
	return { serverScript, standaloneDir };
}

/**
 * Starts the test server on `port` with `env` added to the environment.
 * Resolves once `/api/auth/me` answers; `stop()` terminates the process group.
 */
export async function startServer({ port, env = {}, name = 'server' }) {
	const base = `http://localhost:${port}`;
	if (await reachable(base)) {
		throw new Error(`Port ${port} already answers. Free it, or point E2E_BASE at that server instead.`);
	}

	const useDevServer = process.env.E2E_DEV_SERVER === '1';
	const standalone = useDevServer ? null : ensureStandaloneServer();

	fs.mkdirSync(TMP, { recursive: true });
	const logPath = path.join(TMP, `${name}.log`);
	const log = fs.openSync(logPath, 'w');

	const cmd = useDevServer ? 'pnpm' : process.execPath;
	const args = useDevServer ? ['exec', 'next', 'dev', '--port', String(port)] : [standalone.serverScript];
	const cwd = useDevServer ? ROOT : standalone.standaloneDir;

	const childEnv = {
		...process.env,
		MOCK_MAIL: 'true',
		TERMINAL_ENABLED: '1',
		NEXT_TELEMETRY_DISABLED: '1',
		...(useDevServer
			? {}
			: {
					NODE_ENV: 'production',
					PORT: String(port),
					HOSTNAME: 'localhost',
					NODE_OPTIONS: mergeNodeOptions(env.NODE_OPTIONS ?? process.env.NODE_OPTIONS, 112),
				}),
		...env,
	};

	const child = spawn(cmd, args, {
		cwd,
		env: childEnv,
		stdio: ['ignore', log, log],
		// Own process group so stopping tears down the entire server subtree.
		detached: true,
	});

	let exited = null;
	child.on('exit', (code) => {
		exited = code ?? 'signal';
	});

	const stop = async () => {
		if (exited === null) {
			try {
				process.kill(-child.pid, 'SIGTERM');
			} catch {
				// already gone
			}
			for (let i = 0; i < 40 && exited === null; i++) await sleep(50);
			if (exited === null) {
				try {
					process.kill(-child.pid, 'SIGKILL');
				} catch {
					// already gone
				}
			}
		}
		try {
			fs.closeSync(log);
		} catch {
			// already closed
		}
	};

	const modeLabel = useDevServer ? 'next dev' : 'standalone server';
	const timeoutMs = useDevServer ? 120_000 : 30_000;
	const pollMs = useDevServer ? 500 : 150;
	const deadline = Date.now() + timeoutMs;

	while (!(await reachable(base))) {
		if (exited !== null) {
			throw new Error(`${modeLabel} exited (${exited}) before it was ready; see ${logPath}`);
		}
		if (Date.now() > deadline) {
			await stop();
			throw new Error(`${modeLabel} did not come up in ${timeoutMs / 1000} s; see ${logPath}`);
		}
		await sleep(pollMs);
	}

	// Warm `/` so database initialization completes before the first suite action.
	await fetch(`${base}/`, { signal: AbortSignal.timeout(30_000) }).catch(() => {});
	return { base, stop, logPath, pid: child.pid };
}
