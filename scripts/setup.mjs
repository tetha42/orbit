#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const pnpmCheck = spawnSync('pnpm', ['--version'], { stdio: 'pipe', encoding: 'utf8' });
if (pnpmCheck.status !== 0) {
	console.error('[ERR] pnpm is required (see packageManager in package.json). Enable via: corepack enable');
	process.exit(1);
}

if (!existsSync(join(ROOT, 'node_modules'))) {
	console.log('[INFO] Installing workspace dependencies via pnpm...');
	const installRes = spawnSync('pnpm', ['install'], { cwd: ROOT, stdio: 'inherit' });
	if (installRes.status !== 0) {
		process.exit(installRes.status ?? 1);
	}
}

const doctorRes = spawnSync(
	process.execPath,
	['--no-warnings', join(ROOT, 'scripts', 'orbit-cli.mjs'), 'doctor', ...process.argv.slice(2)],
	{ cwd: ROOT, stdio: 'inherit' }
);
process.exit(doctorRes.status ?? 0);
