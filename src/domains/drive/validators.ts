import type { DriveSharePermission, DriveViewMode, StorageQuotaScope } from './types';

export const MAX_DRIVE_FILE_BYTES = 250 * 1024 * 1024;
export const DRIVE_CHUNK_BYTES = 4 * 1024 * 1024;
export const MAX_DRIVE_CHUNKS = Math.ceil(MAX_DRIVE_FILE_BYTES / DRIVE_CHUNK_BYTES) + 2;

const SAFE_UPLOAD_ID = /^up_[a-zA-Z0-9_-]{12,64}$/;
const VALID_VIEWS = new Set<DriveViewMode>(['my', 'shared', 'starred', 'recent', 'trash']);
const VALID_PERMS = new Set<DriveSharePermission>(['view', 'edit']);
const VALID_SCOPES = new Set<StorageQuotaScope>(['global', 'role', 'user']);

export function normalizeDriveView(raw: unknown): DriveViewMode {
	const v = String(raw || 'my').trim() as DriveViewMode;
	return VALID_VIEWS.has(v) ? v : 'my';
}

export function sanitizeDriveName(raw: unknown): string {
	return String(raw ?? '')
		.replace(/[\u0000-\u001f\u007f/\\]/g, ' ')
		.trim()
		.slice(0, 160);
}

export function isValidUploadSessionId(id: string): boolean {
	return SAFE_UPLOAD_ID.test(id);
}

export function normalizeSharePermission(raw: unknown): DriveSharePermission {
	const p = String(raw || 'view').trim() as DriveSharePermission;
	return VALID_PERMS.has(p) ? p : 'view';
}

export function normalizeQuotaScope(raw: unknown): StorageQuotaScope | null {
	const s = String(raw || '').trim() as StorageQuotaScope;
	return VALID_SCOPES.has(s) ? s : null;
}

export function normalizeSafeMimeType(rawMime: unknown, fileName: string): string {
	const mime = String(rawMime || 'application/octet-stream').trim().toLowerCase();
	if (
		mime.includes('html') ||
		mime.includes('javascript') ||
		mime.includes('ecmascript') ||
		mime.includes('svg') ||
		fileName.toLowerCase().endsWith('.html') ||
		fileName.toLowerCase().endsWith('.htm') ||
		fileName.toLowerCase().endsWith('.svg')
	) {
		return 'application/octet-stream';
	}
	return /^[a-z0-9!#$&-^_.+]+\/[a-z0-9!#$&-^_.+]+$/.test(mime)
		? mime
		: 'application/octet-stream';
}
