#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const binDir = join(rootDir, 'tools', 'bin');
const targetBin = join(binDir, 'fim-scanner');
const sourceFile = join(rootDir, 'tools', 'fim', 'main.go');

if (!existsSync(binDir)) {
	mkdirSync(binDir, { recursive: true });
}

let goCmd = 'go';
if (existsSync('/usr/bin/go')) {
	goCmd = '/usr/bin/go';
} else if (existsSync('/usr/local/go/bin/go')) {
	goCmd = '/usr/local/go/bin/go';
}

function hasGo() {
	try {
		const res = spawnSync(goCmd, ['version'], { stdio: 'ignore' });
		return res.status === 0;
	} catch {
		return false;
	}
}

if (!hasGo()) {
	console.log('[BUILD-FIM] Go compiler not found on system. Native compilation skipped (built-in scanner will be used).');
	process.exit(0);
}

console.log('[BUILD-FIM] Compiling Native Go FIM & Web Shell Scanner...');

try {
	execFileSync(goCmd, ['build', '-ldflags=-s -w', '-o', targetBin, sourceFile], {
		cwd: rootDir,
		stdio: 'inherit',
	});

	if (existsSync(targetBin)) {
		chmodSync(targetBin, 0o755);
		console.log(`[BUILD-FIM] Successfully compiled: ${targetBin}`);
	}
} catch (err) {
	console.warn('[BUILD-FIM] Warning: build failed, built-in scanner will be used:', err.message);
	process.exit(0);
}
