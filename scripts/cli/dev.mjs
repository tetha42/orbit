import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { runDbCommand } from './db.mjs';
import { createStyle } from './format.mjs';

export async function runDevCommand(ROOT, _args, flags, output, getFlagValue) {
	if (flags.has('--json')) {
		console.error(JSON.stringify({ ok: false, error: 'orbit dev is interactive and does not support --json.' }));
		process.exit(2);
	}

	const portRaw = getFlagValue('--port', process.env.PORT || '3000').trim();
	const port = Number(portRaw);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		console.error(`Invalid port '${portRaw}'. Pass a numeric port between 1 and 65535.`);
		process.exit(2);
	}

	if (flags.has('--with-db')) {
		await runDbCommand(ROOT, ['up'], new Set(), output);
	}

	const s = createStyle(false);
	const { ensureSetupToken, isSetupLocked, resolveSetupUrl } = await import('@/lib/setup');
	const { collectConfigProvenance } = await import('@/server/config/provenance');
	const config = collectConfigProvenance(ROOT);
	const bootstrapConfigured = Boolean(config.find((c) => c.key === 'BOOTSTRAP_ADMIN_PASSWORD')?.configured);
	const baseUrlEntry = config.find((c) => c.key === 'PUBLIC_BASE_URL');
	const baseUrl = baseUrlEntry?.configured ? baseUrlEntry.value : `http://localhost:${port}`;

	if (!isSetupLocked() && !bootstrapConfigured) {
		const token = ensureSetupToken({ announce: false });
		if (token) {
			console.log(`${s.cyan('[SETUP]')} Wizard URL: ${resolveSetupUrl(token, baseUrl)}`);
		}
	}

	const child = spawn('pnpm', ['exec', 'next', 'dev', '--port', String(port)], {
		cwd: ROOT,
		stdio: 'inherit',
		env: {
			...process.env,
			PORT: String(port),
			NEXT_TELEMETRY_DISABLED: '1',
		},
	});

	const forwardSignal = (sig) => {
		if (!child.killed) {
			child.kill(sig);
		}
	};
	process.on('SIGINT', forwardSignal);
	process.on('SIGTERM', forwardSignal);

	const code = await new Promise((resolvePromise) => {
		child.on('error', (err) => {
			console.error(`Failed to launch dev server (${join(ROOT, 'package.json')}): ${err.message}`);
			resolvePromise(1);
		});
		child.on('close', (exitCode) => {
			resolvePromise(exitCode ?? 0);
		});
	});

	process.off('SIGINT', forwardSignal);
	process.off('SIGTERM', forwardSignal);
	if (code !== 0) process.exit(code);
}
