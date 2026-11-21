import { createHash } from 'node:crypto';
import { closeSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import type { FimSuspiciousMatch } from './types';
import {
	PURE_HEURISTIC_RULES,
	SCANNABLE_EXTENSIONS,
	type HeuristicRuleDef,
} from './heuristicRules';

const MAX_HEURISTIC_BYTES = 2 * 1024 * 1024;
const MAX_HASH_FILE_BYTES = 32 * 1024 * 1024;
export const FIM_CHUNK_SIZE = 64 * 1024;

const GLOBAL_HEURISTIC_RULES: HeuristicRuleDef[] = PURE_HEURISTIC_RULES.filter(
	(rule) => !rule.extensions || rule.extensions.length === 0
);
const RULES_BY_EXT = new Map<string, HeuristicRuleDef[]>();
for (const ext of SCANNABLE_EXTENSIONS) {
	RULES_BY_EXT.set(
		ext,
		PURE_HEURISTIC_RULES.filter(
			(rule) =>
				!rule.extensions ||
				rule.extensions.length === 0 ||
				rule.extensions.includes(ext)
		)
	);
}

const FAST_HEURISTIC_PREFILTER_RE = new RegExp(
	[
		'eval',
		'assert',
		'\\$\\$',
		'create_function',
		'preg_replace',
		'passthru',
		'shell_exec',
		'system',
		'popen',
		'proc_open',
		'pcntl_exec',
		'child_process',
		'exec',
		'spawn',
		'writeFile',
		'file_put_contents',
		'\\/dev\\/(?:tcp|udp)',
		'ncat',
		'netcat',
		'nc\\s',
		'python',
		'perl',
		'ruby',
		'mkfifo',
		'powershell',
		'curl',
		'wget',
		'\\\\x[0-9a-f]{2}',
		'base64_decode',
		'gzinflate',
		'gzuncompress',
		'gzdecode',
		'str_rot13',
		'hex2bin',
		'bash',
		'\\/bin\\/sh',
	].join('|'),
	'i'
);

export function isBaselineStateFile(slashPath: string, normalizedBaselinePath?: string): boolean {
	if (normalizedBaselinePath && slashPath === normalizedBaselinePath) return true;
	const base = slashPath.split('/').pop() || '';
	const isScopedBaselineName =
		base === 'baseline.json' || /^baseline-(uploads|tmp|custom)\.json$/.test(base);
	if (slashPath.includes('tools/fim/baseline')) return true;
	const envBaselineDir = (process.env.ORBIT_FIM_BASELINE_DIR || '').trim();
	if (envBaselineDir && isScopedBaselineName) {
		const normDir = resolve(/*turbopackIgnore: true*/ process.cwd(), envBaselineDir).replace(/\\/g, '/');
		if (slashPath.startsWith(`${normDir}/`)) return true;
	}
	if (slashPath.includes('/state/baseline') && isScopedBaselineName) {
		return true;
	}
	if (
		slashPath.includes('/data/fim-baseline-') &&
		!slashPath.includes('/data/uploads/') &&
		base.endsWith('.json')
	) {
		return true;
	}
	return false;
}

function isSelfInspectorFile(slashPath: string): boolean {
	return (
		slashPath.endsWith('tools/fim/main.go') ||
		slashPath.endsWith('services/security-guard/fim.go') ||
		slashPath.endsWith('services/security-guard/fim_test.go') ||
		slashPath.endsWith('src/db/repositories/inspection/heuristicRules.ts') ||
		slashPath.endsWith('tests/security/security-e2e.mjs') ||
		slashPath.endsWith('scripts/security-e2e-test.mjs')
	);
}

function detectUploadExecutable(headBuf: Buffer, relPath: string): FimSuspiciousMatch | null {
	if (headBuf.length < 2) return null;
	const isElf =
		headBuf.length >= 4 &&
		headBuf[0] === 0x7f &&
		headBuf[1] === 0x45 &&
		headBuf[2] === 0x4c &&
		headBuf[3] === 0x46;
	const isPe = headBuf[0] === 0x4d && headBuf[1] === 0x5a;
	if (!isElf && !isPe) return null;
	return {
		path: relPath,
		matchedRule: 'EXECUTABLE_BINARY_IN_UPLOADS',
		severity: 'CRITICAL',
		line: 1,
		snippet: '[Compiled ELF / PE binary executable file detected in uploads directory]',
	};
}

function scanBufferHeuristics(
	buffer: Buffer,
	relPath: string,
	ext: string,
	isUploadOrTmp: boolean
): FimSuspiciousMatch[] {
	if (buffer.includes(0)) return [];

	const text = buffer.toString('utf-8');
	if (!FAST_HEURISTIC_PREFILTER_RE.test(text)) return [];

	const rules = isUploadOrTmp
		? PURE_HEURISTIC_RULES
		: RULES_BY_EXT.get(ext) || GLOBAL_HEURISTIC_RULES;
	const lines = text.split('\n');
	const matches: FimSuspiciousMatch[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line || line.trim().length === 0) continue;

		for (let r = 0; r < rules.length; r++) {
			const rule = rules[r];
			if (rule.pattern.test(line)) {
				let snippet = line.trim();
				if (snippet.length > 160) snippet = `${snippet.slice(0, 157)}...`;
				matches.push({
					path: relPath,
					matchedRule: rule.name,
					severity: rule.severity,
					line: i + 1,
					snippet,
				});
				break;
			}
		}
	}

	return matches;
}

export function hashAndInspectFile(
	filePath: string,
	relPath: string,
	targetKey: string,
	chunkBuf: Buffer,
	normalizedBaselinePath?: string
): { hash: string; matches: FimSuspiciousMatch[]; skippedTooLarge?: boolean } {
	const stat = statSync(filePath);
	if (stat.size > MAX_HASH_FILE_BYTES) {
		return { hash: '', matches: [], skippedTooLarge: true };
	}

	const ext = extname(filePath).toLowerCase();
	const slashPath = filePath.replace(/\\/g, '/');
	const isUploadOrTmp =
		targetKey === 'uploads' ||
		targetKey === 'tmp' ||
		slashPath.includes('data/uploads') ||
		slashPath.startsWith('/tmp');
	const isUploadDir = targetKey === 'uploads' || slashPath.includes('data/uploads');
	const shouldInspect =
		(isUploadOrTmp || SCANNABLE_EXTENSIONS.has(ext)) &&
		(isUploadOrTmp ||
			(!isSelfInspectorFile(slashPath) &&
				!isBaselineStateFile(slashPath, normalizedBaselinePath)));

	if (stat.size <= MAX_HEURISTIC_BYTES) {
		const buffer = readFileSync(filePath);
		const hash = createHash('sha256').update(buffer).digest('hex');
		if (!shouldInspect) return { hash, matches: [] };
		if (isUploadDir) {
			const exeMatch = detectUploadExecutable(buffer, relPath);
			if (exeMatch) return { hash, matches: [exeMatch] };
		}
		return { hash, matches: scanBufferHeuristics(buffer, relPath, ext, isUploadOrTmp) };
	}

	const fd = openSync(filePath, 'r');
	const hasher = createHash('sha256');
	let headBuf = Buffer.alloc(0);
	let totalRead = 0;

	try {
		while (true) {
			const bytesRead = readSync(fd, chunkBuf, 0, FIM_CHUNK_SIZE, null);
			if (bytesRead <= 0) break;
			const slice = chunkBuf.subarray(0, bytesRead);
			hasher.update(slice);
			if (totalRead === 0) {
				headBuf = Buffer.from(slice.subarray(0, Math.min(512, bytesRead)));
			}
			totalRead += bytesRead;
		}
	} finally {
		closeSync(fd);
	}

	const hash = hasher.digest('hex');
	if (shouldInspect && isUploadDir) {
		const exeMatch = detectUploadExecutable(headBuf, relPath);
		if (exeMatch) return { hash, matches: [exeMatch] };
	}
	return { hash, matches: [] };
}
