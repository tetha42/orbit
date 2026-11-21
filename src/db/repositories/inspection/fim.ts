import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, chmodSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { logSystemEvent } from '../logs.repo';
import { runFimScanWithGuard } from '@/server/security/securityGuardClient';
import { runPureNodeFimScan } from './pureScanner';
import { resolveTargetDir } from './targets';
import type { FimScanResult } from './types';

const ROOT_DIR = process.cwd();
const FIM_BINARY_PATH = join(ROOT_DIR, 'tools', 'bin', 'fim-scanner');
const FIM_GO_SOURCE = join(ROOT_DIR, 'tools', 'fim', 'main.go');
const BUILD_SCRIPT_PATH = join(ROOT_DIR, 'scripts', 'build-fim.mjs');

export type FimBaselineScope = 'repo' | 'uploads' | 'tmp' | 'custom';

export function getFimBaselineDir(): string {
	const configured = (process.env.ORBIT_FIM_BASELINE_DIR || '').trim();
	return configured ? resolve(/*turbopackIgnore: true*/ ROOT_DIR, configured) : join(ROOT_DIR, 'tools', 'fim');
}

export function getBaselinePathForScope(key: FimBaselineScope | string): string {
	const baseDir = getFimBaselineDir();
	switch (key) {
		case 'uploads':
			return join(baseDir, 'baseline-uploads.json');
		case 'tmp':
			return join(baseDir, 'baseline-tmp.json');
		case 'custom':
			return join(baseDir, 'baseline-custom.json');
		case 'repo':
		default:
			return join(baseDir, 'baseline.json');
	}
}

const fimCache = new Map<string, { timestamp: number; data: FimScanResult }>();
const CACHE_TTL_MS = 15_000;

let cachedHasGo: boolean | null = null;

function hasGoCompiler(): boolean {
	if (cachedHasGo !== null) return cachedHasGo;
	try {
		const res = spawnSync('go', ['version'], { stdio: 'ignore' });
		cachedHasGo = res.status === 0;
	} catch {
		cachedHasGo = false;
	}
	return cachedHasGo;
}

export async function ensureFimBinary(): Promise<string | null> {
	if (existsSync(FIM_BINARY_PATH)) {
		try {
			chmodSync(FIM_BINARY_PATH, 0o755);
		} catch { /* Read-only filesystem or non-owner context; binary may already be executable. */ }

		if (process.env.NODE_ENV === 'production' || !hasGoCompiler()) {
			return FIM_BINARY_PATH;
		}

		if (existsSync(FIM_GO_SOURCE)) {
			try {
				const binMtime = statSync(FIM_BINARY_PATH).mtimeMs;
				const srcMtime = statSync(FIM_GO_SOURCE).mtimeMs;
				if (srcMtime <= binMtime) {
					return FIM_BINARY_PATH;
				}
			} catch {
				return FIM_BINARY_PATH;
			}
		} else {
			return FIM_BINARY_PATH;
		}
	}

	if (process.env.NODE_ENV === 'production' || !hasGoCompiler()) {
		return null;
	}

	const binDir = join(ROOT_DIR, 'tools', 'bin');
	if (!existsSync(binDir)) {
		mkdirSync(binDir, { recursive: true });
	}

	try {
		execFileSync(process.execPath, [BUILD_SCRIPT_PATH], {
			cwd: ROOT_DIR,
			timeout: 20_000,
		});
		if (existsSync(FIM_BINARY_PATH)) {
			chmodSync(FIM_BINARY_PATH, 0o755);
			return FIM_BINARY_PATH;
		}
	} catch {
		return null;
	}

	return null;
}

function runFimProcessViaSpawn(binPath: string, args: string[], cwd: string, timeoutMs = 30_000): Promise<string> {
	return new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(binPath, args, { cwd, stdio: ['ignore', 'pipe'] });
		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		const timer = setTimeout(() => {
			try {
				child.kill('SIGTERM');
				setTimeout(() => {
					try {
						child.kill('SIGKILL');
					} catch { /* Process may have exited before SIGKILL. */ }
				}, 2000);
			} catch { /* Process may have exited before SIGTERM. */ }
			rejectPromise(new Error(`FIM scan timed out (${timeoutMs}ms)`));
		}, timeoutMs);

		child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
		child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

		child.on('error', (err) => {
			clearTimeout(timer);
			rejectPromise(err);
		});

		child.on('close', (code) => {
			clearTimeout(timer);
			const stdoutStr = Buffer.concat(stdoutChunks).toString('utf-8');
			const stderrStr = Buffer.concat(stderrChunks).toString('utf-8');
			if (code !== 0 && !stdoutStr.trim()) {
				rejectPromise(new Error(`FIM binary exit code ${code}: ${stderrStr || 'Unknown error'}`));
			} else {
				resolvePromise(stdoutStr);
			}
		});
	});
}

export async function runFimScan(
	targetKeyOrPath = 'repo',
	options: { force?: boolean; saveBaseline?: boolean } = {}
): Promise<FimScanResult> {
	const { key, path: resolvedTarget } = resolveTargetDir(targetKeyOrPath);
	const cacheKey = key === 'custom' ? `${key}:${resolvedTarget}` : key;

	if (!options.force && !options.saveBaseline) {
		const cached = fimCache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
			return cached.data;
		}
	}

	const baselinePath = getBaselinePathForScope(key);
	let parsed: FimScanResult | null = null;

	// 1. Try Go Security Guard microservice via BFF bridge
	try {
		const guardTarget = key === 'custom' ? resolvedTarget : key;
		const guardRes = await runFimScanWithGuard(guardTarget, options.saveBaseline);
		if (
			guardRes !== null &&
			typeof guardRes.scannedFiles === 'number' &&
			(guardRes.scannedFiles > 0 || key !== 'repo')
		) {
			parsed = guardRes as unknown as FimScanResult;
		}
	} catch {
		parsed = null;
	}

	// 2. Fallback to native binary if available
	if (!parsed) {
		const binPath = await ensureFimBinary();
		if (binPath) {
			const args = [`--dir=${resolvedTarget}`, `--baseline=${baselinePath}`, `--workers=8`];
			if (key === 'repo') {
				const baseDirRel = relative(ROOT_DIR, getFimBaselineDir()).replace(/\\/g, '/');
				const scopedExcludes =
					baseDirRel && !baseDirRel.startsWith('..')
						? [
								`${baseDirRel}/baseline.json`,
								`${baseDirRel}/baseline-uploads.json`,
								`${baseDirRel}/baseline-tmp.json`,
								`${baseDirRel}/baseline-custom.json`,
							]
						: [];
				const repoExcludes = [
					'.git',
					'node_modules',
					'.next',
					'dist',
					'tools/bin',
					'tools/fim/baseline.json',
					'tools/fim/baseline-uploads.json',
					'tools/fim/baseline-tmp.json',
					'tools/fim/baseline-custom.json',
					'data/fim-baseline-uploads.json',
					'data/fim-baseline-tmp.json',
					'data/fim-baseline-custom.json',
					'data/uploads',
					'data/custom',
					...scopedExcludes,
				].join(',');
				args.push(`--excludes=${repoExcludes}`);
			}
			if (options.saveBaseline) {
				args.push('--save-baseline');
			}
			try {
				const stdout = await runFimProcessViaSpawn(binPath, args, ROOT_DIR, 30_000);
				parsed = JSON.parse(stdout.trim());
			} catch {
				parsed = null;
			}
		}
	}

	// 3. Fallback to Pure Node.js engine
	if (!parsed) {
		parsed = await runPureNodeFimScan(resolvedTarget, baselinePath, options.saveBaseline, key);
	}

	parsed.targetKey = key;

	if (parsed.suspiciousFiles && parsed.suspiciousFiles.length > 0) {
		void logSystemEvent({
			service: 'security',
			level: 'ERROR',
			message: `[FIM Security Alert] ${parsed.suspiciousFiles.length} suspicious files/backdoors detected in (${key})!`,
			detail: {
				target: key,
				count: parsed.suspiciousFiles.length,
				preview: parsed.suspiciousFiles.slice(0, 5),
			},
		});
	}

	fimCache.set(cacheKey, { timestamp: Date.now(), data: parsed });
	return parsed;
}

