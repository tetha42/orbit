import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, type Dirent } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import type { FimScanResult } from './types';
import { SCANNABLE_EXTENSIONS } from './heuristicRules';
import { resolveTargetDir } from './targets';
import { FIM_CHUNK_SIZE, hashAndInspectFile, isBaselineStateFile } from './fileScannerHelpers';

const ROOT_DIR = process.cwd();
const FAST_EXCLUDED_DIRS = new Set(['.git', 'node_modules', '.next', 'dist']);

function walkFimDirectory(
	dirPath: string,
	excludes: string[],
	targetKey: string,
	normalizedBaselinePath: string | undefined,
	onFile: (filePath: string) => void
): void {
	if (!existsSync(dirPath)) return;

	const isUploadOrTmp = targetKey === 'uploads' || targetKey === 'tmp';
	const normExcludes = excludes.map((excl) => excl.replace(/\\/g, '/'));

	function isPathExcluded(norm: string): boolean {
		for (let i = 0; i < normExcludes.length; i++) {
			const e = normExcludes[i];
			if (
				norm.includes(`/${e}/`) ||
				norm.endsWith(`/${e}`) ||
				norm === e ||
				norm.startsWith(`${e}/`)
			) {
				return true;
			}
		}
		return false;
	}

	function walk(current: string) {
		let entries: Dirent[];
		try {
			entries = readdirSync(current, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			const name = entry.name;
			if (entry.isDirectory()) {
				if (FAST_EXCLUDED_DIRS.has(name)) continue;
				if (!isUploadOrTmp && name === 'state') continue;
				const fullPath = join(current, name);
				const norm = fullPath.replace(/\\/g, '/');
				if (isPathExcluded(norm)) continue;
				walk(fullPath);
			} else if (entry.isFile()) {
				if (!isUploadOrTmp) {
					const ext = extname(name).toLowerCase();
					if (!SCANNABLE_EXTENSIONS.has(ext)) continue;
				}
				const fullPath = join(current, name);
				const norm = fullPath.replace(/\\/g, '/');
				if (isPathExcluded(norm)) continue;
				if (!isUploadOrTmp && isBaselineStateFile(norm, normalizedBaselinePath)) {
					continue;
				}
				onFile(fullPath);
			}
		}
	}

	walk(dirPath);
}

export async function runPureNodeFimScan(
	targetDir: string,
	baselinePath: string,
	saveBaseline = false,
	targetKeyOverride?: string
): Promise<FimScanResult> {
	const startTime = Date.now();
	let resolvedTarget = resolve(/*turbopackIgnore: true*/ ROOT_DIR, targetDir);
	let detectedKey = targetKeyOverride || 'custom';
	try {
		const resolved = resolveTargetDir(targetDir);
		resolvedTarget = resolved.path;
		if (!targetKeyOverride) detectedKey = resolved.key;
	} catch {
		// Direct filesystem paths outside allowlist can still be passed in internal tests
	}

	const res: FimScanResult = {
		targetDir: resolvedTarget,
		targetKey: detectedKey,
		scannedFiles: 0,
		durationMs: 0,
		timestamp: Date.now(),
		suspiciousFiles: [],
		anomalies: [],
		baselineSaved: false,
		errors: [],
	};

	let existingBaseline: Record<string, string> = {};
	if (baselinePath && existsSync(baselinePath)) {
		try {
			existingBaseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
		} catch {
			existingBaseline = {};
		}
	}

	const currentHashes: Record<string, string> = {};
	const excludes = ['.git', 'node_modules', '.next', 'dist', 'tools/bin'];
	if (detectedKey === 'repo') {
		excludes.push('data/uploads', 'data/custom');
	}
	const normBaseline = baselinePath ? baselinePath.replace(/\\/g, '/') : undefined;
	const chunkBuf = Buffer.allocUnsafe(FIM_CHUNK_SIZE);
	const isUploadOrTmp = detectedKey === 'uploads' || detectedKey === 'tmp';

	try {
		walkFimDirectory(res.targetDir, excludes, detectedKey, normBaseline, (filePath) => {
			try {
				const ext = extname(filePath).toLowerCase();
				if (!isUploadOrTmp && !SCANNABLE_EXTENSIONS.has(ext)) {
					return;
				}
				const relPath = relative(res.targetDir, filePath).replace(/\\/g, '/');
				const { hash, matches, skippedTooLarge } = hashAndInspectFile(
					filePath,
					relPath,
					detectedKey,
					chunkBuf,
					normBaseline
				);
				if (skippedTooLarge) return;
				currentHashes[relPath] = hash;
				res.scannedFiles++;
				if (matches.length > 0) res.suspiciousFiles.push(...matches);
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				res.errors.push(`hash error ${filePath}: ${msg}`);
			}
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		res.errors.push(`walk error: ${msg}`);
	}

	if (Object.keys(existingBaseline).length > 0) {
		for (const [path, oldHash] of Object.entries(existingBaseline)) {
			const newHash = currentHashes[path];
			if (newHash !== undefined) {
				if (oldHash !== newHash) res.anomalies.push({ path, type: 'modified', oldHash, newHash });
			} else {
				res.anomalies.push({ path, type: 'deleted', oldHash });
			}
		}
		for (const [path, newHash] of Object.entries(currentHashes)) {
			if (existingBaseline[path] === undefined) res.anomalies.push({ path, type: 'added', newHash });
		}
	}

	if (saveBaseline && baselinePath) {
		try {
			const dir = dirname(baselinePath);
			if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
			writeFileSync(baselinePath, JSON.stringify(currentHashes, null, 2), 'utf-8');
			res.baselineSaved = true;
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			res.errors.push(`failed to save baseline: ${msg}`);
		}
	}

	res.durationMs = Date.now() - startTime;
	return res;
}
