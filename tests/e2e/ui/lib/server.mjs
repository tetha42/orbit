// Starting and stopping a dev server for the suites.
//
// Normally you start the server yourself and point the runner at it (E2E_BASE).
// The runner starts one only when it owns the whole run (no E2E_BASE): a fresh
// database, the .env admin, fixtures, then every suite.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, TMP } from './env.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function reachable(base) {
	try {
		await fetch(`${base}/api/auth/me`, { signal: AbortSignal.timeout(3000) });
		return true;
	} catch {
		return false;
	}
}

/**
 * `next dev` on `port` with `env` added to the environment. Resolves once the
 * app answers; the returned `stop()` ends the whole process group.
 */
export async function startServer({ port, env, name = 'server' }) {
	const base = `http://localhost:${port}`;
	if (await reachable(base)) throw new Error(`Port ${port} already answers. Free it, or point E2E_BASE at that server instead.`);

	fs.mkdirSync(TMP, { recursive: true });
	const logPath = path.join(TMP, `${name}.log`);
	const log = fs.openSync(logPath, 'w');
	const child = spawn('pnpm', ['exec', 'next', 'dev', '--port', String(port)], {
		cwd: ROOT,
		env: { ...process.env, MOCK_MAIL: 'true', ...env },
		stdio: ['ignore', log, log],
		// Own process group: pnpm → next → next-server must all go on stop().
		detached: true,
	});
	let exited = null;
	child.on('exit', (code) => (exited = code ?? 'signal'));

	const stop = async () => {
		if (exited === null) {
			try {
				process.kill(-child.pid, 'SIGTERM');
			} catch {
				// already gone
			}
			for (let i = 0; i < 50 && exited === null; i++) await sleep(100);
			if (exited === null) {
				try {
					process.kill(-child.pid, 'SIGKILL');
				} catch {
					// already gone
				}
			}
		}
		fs.closeSync(log);
	};

	const deadline = Date.now() + 180_000;
	while (!(await reachable(base))) {
		if (exited !== null) throw new Error(`next dev exited (${exited}) before it was ready; see ${logPath}`);
		if (Date.now() > deadline) {
			await stop();
			throw new Error(`next dev did not come up in 180 s; see ${logPath}`);
		}
		await sleep(500);
	}
	// The first request compiles the page and runs the database setup; do it now so a suite's first step is not the slow one.
	await fetch(`${base}/`, { signal: AbortSignal.timeout(120_000) }).catch(() => {});
	return { base, stop, logPath };
}
