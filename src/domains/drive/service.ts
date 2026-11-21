import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db';
import { publishEvent } from '@/db/events';
import { addStoredFile } from '@/db/repositories/files.repo';
import { UPLOAD_NAME_RE } from '@/lib/uploads';
import { CONFIG } from '@/server/config';
import { reserveUserStorageQuota, resolveEffectiveQuotaBytes } from '@/server/storage/quota';
import type { DriveItemRecord } from './types';
import { sweepStaleDriveUploadSessions } from './uploadCleanup';
import {
	DRIVE_CHUNK_BYTES,
	isValidUploadSessionId,
	MAX_DRIVE_CHUNKS,
	MAX_DRIVE_FILE_BYTES,
	normalizeSafeMimeType,
	sanitizeDriveName,
} from './validators';

interface UploadSessionMeta {
	uploadId: string;
	userId: string;
	fileName: string;
	mimeType: string;
	totalBytes: number;
	totalChunks: number;
	folderId: string | null;
	createdAt: number;
}

function getUploadBaseDir(): string {
	return path.resolve(/*turbopackIgnore: true*/ process.cwd(), CONFIG.storage.uploadDir || './data/uploads');
}

function getTempUploadDir(uploadId: string): string {
	const base = path.join(/*turbopackIgnore: true*/ getUploadBaseDir(), '.tmp');
	return path.resolve(/*turbopackIgnore: true*/ base, path.basename(uploadId));
}

export async function initChunkedDriveUpload(params: {
	userId: string;
	fileName: string;
	mimeType: string;
	totalBytes: number;
	folderId: string | null;
}): Promise<
	| { ok: true; uploadId: string; chunkBytes: number; totalChunks: number }
	| { ok: false; code: string; status: number }
> {
	const cleanName = sanitizeDriveName(params.fileName) || 'file.bin';
	const totalBytes = Math.ceil(Number(params.totalBytes ?? 0));
	if (!Number.isFinite(totalBytes) || totalBytes < 0 || totalBytes > MAX_DRIVE_FILE_BYTES) {
		return { ok: false, code: 'FILE_TOO_LARGE', status: 413 };
	}

	const quotaBytes = await resolveEffectiveQuotaBytes(params.userId);
	if (quotaBytes !== -1 && totalBytes > quotaBytes) {
		return { ok: false, code: 'STORAGE_QUOTA_EXCEEDED', status: 413 };
	}

	const totalChunks = Math.max(1, Math.ceil(totalBytes / DRIVE_CHUNK_BYTES));
	if (totalChunks > MAX_DRIVE_CHUNKS) {
		return { ok: false, code: 'FILE_TOO_LARGE', status: 413 };
	}

	const uploadId = `up_${crypto.randomUUID().replace(/-/g, '')}`;
	const uploadDir = getUploadBaseDir();
	void sweepStaleDriveUploadSessions(uploadDir).catch((err) => {
		console.warn('[Drive] Temp sweep skipped:', err instanceof Error ? err.message : String(err));
	});
	const sessionDir = getTempUploadDir(uploadId);
	await fs.promises.mkdir(sessionDir, { recursive: true, mode: 0o700 });

	const meta: UploadSessionMeta = {
		uploadId,
		userId: params.userId,
		fileName: cleanName,
		mimeType: normalizeSafeMimeType(params.mimeType, cleanName),
		totalBytes,
		totalChunks,
		folderId: params.folderId?.trim() || null,
		createdAt: Date.now(),
	};

	await fs.promises.writeFile(
		path.join(sessionDir, 'meta.json'),
		JSON.stringify(meta),
		{ encoding: 'utf8', mode: 0o600 }
	);

	return {
		ok: true,
		uploadId,
		chunkBytes: DRIVE_CHUNK_BYTES,
		totalChunks,
	};
}

export async function writeDriveUploadChunk(params: {
	uploadId: string;
	userId: string;
	chunkIndex: number;
	bytes: Buffer;
}): Promise<{ ok: true } | { ok: false; code: string; status: number }> {
	if (!isValidUploadSessionId(params.uploadId)) {
		return { ok: false, code: 'INVALID_UPLOAD_ID', status: 400 };
	}
	const sessionDir = getTempUploadDir(params.uploadId);
	const metaPath = path.join(sessionDir, 'meta.json');
	if (!fs.existsSync(metaPath)) {
		return { ok: false, code: 'UPLOAD_NOT_FOUND', status: 404 };
	}
	const meta = JSON.parse(await fs.promises.readFile(metaPath, 'utf8')) as UploadSessionMeta;
	if (meta.userId !== params.userId) {
		return { ok: false, code: 'FORBIDDEN', status: 403 };
	}
	if (
		!Number.isInteger(params.chunkIndex) ||
		params.chunkIndex < 0 ||
		params.chunkIndex >= meta.totalChunks ||
		params.bytes.length > DRIVE_CHUNK_BYTES + 1024
	) {
		return { ok: false, code: 'INVALID_CHUNK', status: 400 };
	}

	const chunkPath = path.join(sessionDir, `part_${params.chunkIndex}`);
	await fs.promises.writeFile(chunkPath, params.bytes, { mode: 0o600 });
	return { ok: true };
}

export async function completeChunkedDriveUpload(params: {
	uploadId: string;
	userId: string;
}): Promise<{ ok: true; item: DriveItemRecord } | { ok: false; code: string; status: number }> {
	if (!isValidUploadSessionId(params.uploadId)) {
		return { ok: false, code: 'INVALID_UPLOAD_ID', status: 400 };
	}
	const sessionDir = getTempUploadDir(params.uploadId);
	const metaPath = path.join(sessionDir, 'meta.json');
	if (!fs.existsSync(metaPath)) {
		return { ok: false, code: 'UPLOAD_NOT_FOUND', status: 404 };
	}
	const meta = JSON.parse(await fs.promises.readFile(metaPath, 'utf8')) as UploadSessionMeta;
	if (meta.userId !== params.userId) {
		return { ok: false, code: 'FORBIDDEN', status: 403 };
	}

	const uploadDir = getUploadBaseDir();
	await fs.promises.mkdir(uploadDir, { recursive: true });
	const rawExt = path.extname(meta.fileName).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 12);
	const baseToken = `${Date.now()}_${crypto.randomBytes(9).toString('hex')}`;
	const candidateName = `${baseToken}${rawExt || '.bin'}`;
	const storedName = UPLOAD_NAME_RE.test(candidateName) ? candidateName : `${baseToken}.bin`;
	const finalPath = path.join(/*turbopackIgnore: true*/ uploadDir, storedName);

	let assembledBytes = 0;
	try {
		const outHandle = await fs.promises.open(finalPath, 'w', 0o600);
		try {
			for (let i = 0; i < meta.totalChunks; i++) {
				const partPath = path.join(sessionDir, `part_${i}`);
				if (!fs.existsSync(partPath)) {
					return { ok: false, code: 'MISSING_CHUNK', status: 400 };
				}
				const buf = await fs.promises.readFile(partPath);
				assembledBytes += buf.length;
				if (assembledBytes > MAX_DRIVE_FILE_BYTES) {
					await outHandle.close().catch(() => { /* ignore handle close error */ });
					await fs.promises.unlink(finalPath).catch(() => { /* ignore cleanup error */ });
					await fs.promises.rm(sessionDir, { recursive: true, force: true }).catch(() => { /* ignore cleanup error */ });
					return { ok: false, code: 'FILE_TOO_LARGE', status: 413 };
				}
				await outHandle.write(buf);
			}
		} finally {
			await outHandle.close();
		}

		await ensurePostgresInit();
		const txRes = await withTransaction(async (client) => {
			const quotaCheck = await reserveUserStorageQuota(client, params.userId, assembledBytes);
			if (!quotaCheck.allowed) {
				return { ok: false as const, code: 'STORAGE_QUOTA_EXCEEDED', status: 413 };
			}

			await addStoredFile(
				{ name: storedName, uploaderId: params.userId, mime: meta.mimeType, size: assembledBytes, everyoneOpen: false, sourceApp: 'drive', scopeId: meta.folderId },
				client
			);

			const itemId = `di_${crypto.randomUUID()}`;
			const now = Date.now();
			const insertRes = await client.query(
				`INSERT INTO drive_items (
					id, owner_id, folder_id, file_id, display_name, mime_type,
					size_bytes, is_starred, is_trashed, created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, FALSE, $8, $8)
				RETURNING *`,
				[
					itemId,
					params.userId,
					meta.folderId,
					storedName,
					meta.fileName,
					meta.mimeType,
					assembledBytes,
					now,
				]
			);
			const row = insertRes.rows[0] as Record<string, unknown>;
			const item: DriveItemRecord = {
				id: String(row.id ?? itemId),
				ownerId: params.userId,
				folderId: meta.folderId,
				fileId: storedName,
				displayName: meta.fileName,
				mimeType: meta.mimeType,
				sizeBytes: assembledBytes,
				isStarred: false,
				isTrashed: false,
				trashedAt: null,
				createdAt: now,
				updatedAt: now,
			};
			return { ok: true as const, item };
		});

		if (!txRes.ok) {
			await fs.promises.unlink(finalPath).catch(() => {});
			await fs.promises.rm(sessionDir, { recursive: true, force: true }).catch(() => { /* ignore cleanup error */ });
			return txRes;
		}

		await fs.promises.rm(sessionDir, { recursive: true, force: true }).catch(() => { /* ignore cleanup error */ });
		void publishEvent(getPgPool(), { k: 'drive_updated', ownerId: params.userId, itemId: txRes.item.id });
		return txRes;
	} catch (err) {
		await fs.promises.unlink(finalPath).catch(() => { /* ignore cleanup error */ });
		throw err;
	}
}
