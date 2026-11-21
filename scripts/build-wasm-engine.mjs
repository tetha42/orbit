#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const outDir = join(rootDir, 'public', 'wasm');
const outFile = join(outDir, 'security_engine.wasm');
const sourceFile = join(rootDir, 'tools', 'wasm', 'main.go');

if (!existsSync(outDir)) {
	mkdirSync(outDir, { recursive: true });
}

console.log('[BUILD-WASM] Compiling WebAssembly Security Engine via Go js/wasm...');

const res = spawnSync('go', ['build', '-ldflags=-s -w', '-o', outFile, sourceFile], {
	cwd: rootDir,
	env: { ...process.env, GOOS: 'js', GOARCH: 'wasm' },
	stdio: 'inherit',
});

if (res.status === 0 && existsSync(outFile)) {
	console.log(`[BUILD-WASM] Successfully built: ${outFile}`);
} else {
	console.warn('[BUILD-WASM] Warning: WASM build exited with status', res.status);
}
