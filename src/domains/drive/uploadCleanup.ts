import fs from 'node:fs';
import path from 'node:path';

export const DRIVE_TMP_UPLOAD_TTL_MS = 2 * 60 * 60_000;
export const DRIVE_TMP_SWEEP_INTERVAL_MS = 15 * 60_000;

let lastSweepAt = 0;

async function readSessionCreatedAt(sessionDir: string): Promise<number> {
	const metaPath = path.join(/*turbopackIgnore: true*/ sessionDir, 'meta.json');
	try {
		const raw = await fs.promises.readFile(/*turbopackIgnore: true*/ metaPath, 'utf8');
		const parsed = JSON.parse(raw) as { createdAt?: unknown };
		if (typeof parsed.createdAt === 'number' && Number.isFinite(parsed.createdAt)) {
			return parsed.createdAt;
		}
	} catch {
		// Fall back to directory mtime when meta.json is absent or partial.
	}
	const stats = await fs.promises.stat(/*turbopackIgnore: true*/ sessionDir);
	return stats.mtimeMs;
}

/**
 * Deletes stale interrupted Drive chunked-upload staging folders (`up_*`) under `.tmp`.
 */
export async function sweepStaleDriveUploadSessions(
	uploadBaseDir: string,
	options?: { ttlMs?: number; force?: boolean; now?: number }
): Promise<{ scanned: number; removed: number }> {
	const now = options?.now ?? Date.now();
	const ttlMs = options?.ttlMs ?? DRIVE_TMP_UPLOAD_TTL_MS;
	if (!options?.force && now - lastSweepAt < DRIVE_TMP_SWEEP_INTERVAL_MS) {
		return { scanned: 0, removed: 0 };
	}
	lastSweepAt = now;

	const tmpRoot = path.resolve(/*turbopackIgnore: true*/ [uploadBaseDir, '.tmp'].join(path.sep));
	if (!fs.existsSync(/*turbopackIgnore: true*/ tmpRoot)) {
		return { scanned: 0, removed: 0 };
	}

	let scanned = 0;
	let removed = 0;
	const entries = await fs.promises.readdir(/*turbopackIgnore: true*/ tmpRoot, { withFileTypes: true });
	for (const entry of entries) {
		if (!entry.isDirectory() || !entry.name.startsWith('up_')) continue;
		scanned += 1;
		const sessionDir = path.join(/*turbopackIgnore: true*/ tmpRoot, entry.name);
		try {
			const createdAt = await readSessionCreatedAt(sessionDir);
			if (now - createdAt > ttlMs) {
				await fs.promises.rm(/*turbopackIgnore: true*/ sessionDir, { recursive: true, force: true });
				removed += 1;
			}
		} catch (err) {
			console.warn('[Drive] Failed to clean stale temp folder:', entry.name, err);
		}
	}

	return { scanned, removed };
}
