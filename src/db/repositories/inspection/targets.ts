import { existsSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT_DIR = process.cwd();

function resolveSafePath(candidate: string): string {
	const cleaned = resolve(/*turbopackIgnore: true*/ ROOT_DIR, candidate);
	if (existsSync(/*turbopackIgnore: true*/ cleaned)) {
		return realpathSync(/*turbopackIgnore: true*/ cleaned);
	}
	const parent = dirname(cleaned);
	if (parent && parent !== cleaned && existsSync(/*turbopackIgnore: true*/ parent)) {
		const realParent = realpathSync(/*turbopackIgnore: true*/ parent);
		const base = cleaned.slice(parent.length).replace(/^[/\\]+/, '');
		return base ? join(realParent, base) : realParent;
	}
	return cleaned;
}

function getRealRoot(): string {
	return existsSync(ROOT_DIR) ? realpathSync(ROOT_DIR) : ROOT_DIR;
}

function getRealTmp(): string {
	return existsSync('/tmp') ? realpathSync('/tmp') : '/tmp';
}

/**
 * Sanitizes and maps target directory keys to safe filesystem paths,
 * resolving symlinks to prevent escaping repo root or /tmp.
 */
export function resolveTargetDir(target: string): { key: string; path: string } {
	const raw = (target || 'repo').trim();
	if (raw.includes('..')) {
		throw new Error('Access denied: path traversal is not allowed.');
	}

	const trimmed = raw.toLowerCase();
	const realRoot = getRealRoot();
	const uploadsDir = join(realRoot, 'data', 'uploads');

	if (trimmed === 'uploads') {
		if (!existsSync(uploadsDir)) {
			mkdirSync(uploadsDir, { recursive: true });
		}
		return { key: 'uploads', path: resolveSafePath(uploadsDir) };
	}

	if (trimmed === 'tmp') {
		return { key: 'tmp', path: getRealTmp() };
	}

	if (trimmed === 'repo' || trimmed === 'src') {
		return { key: 'repo', path: realRoot };
	}

	const resolved = resolveSafePath(raw);
	const realTmp = getRealTmp();
	const repoPrefix = realRoot.endsWith('/') ? realRoot : `${realRoot}/`;
	const tmpPrefix = realTmp.endsWith('/') ? realTmp : `${realTmp}/`;
	const uploadsPrefix = uploadsDir.endsWith('/') ? uploadsDir : `${uploadsDir}/`;

	const isInsideRepo = resolved === realRoot || resolved.startsWith(repoPrefix);
	const isInsideTmp = resolved === realTmp || resolved.startsWith(tmpPrefix);

	if (!isInsideRepo && !isInsideTmp) {
		throw new Error('Access denied: target directory is outside repo root or /tmp.');
	}

	if (isInsideTmp) {
		return { key: 'tmp', path: resolved };
	}
	if (resolved === uploadsDir || resolved.startsWith(uploadsPrefix)) {
		return { key: 'uploads', path: resolved };
	}
	if (resolved === realRoot) {
		return { key: 'repo', path: resolved };
	}

	return { key: 'custom', path: resolved };
}
