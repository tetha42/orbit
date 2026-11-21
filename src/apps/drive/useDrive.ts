'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DriveFolderRecord, DriveItemRecord, DriveViewMode } from '@/domains/drive/types';
import { DRIVE_CHUNK_BYTES, MAX_DRIVE_FILE_BYTES } from '@/domains/drive/validators';
import type { UserStorageBreakdown } from '@/server/storage/quota';

export interface DriveUploadJob {
	id: string;
	name: string;
	pct: number;
	status: 'uploading' | 'finalizing' | 'done' | 'failed';
	errorKey?: string;
}

export function useDrive() {
	const [view, setView] = useState<DriveViewMode>('my');
	const [folderId, setFolderId] = useState<string | null>(null);
	const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([]);
	const [query, setQuery] = useState('');
	const [folders, setFolders] = useState<DriveFolderRecord[]>([]);
	const [items, setItems] = useState<DriveItemRecord[]>([]);
	const [storage, setStorage] = useState<UserStorageBreakdown | null>(null);
	const [loading, setLoading] = useState(false);
	const [uploads, setUploads] = useState<DriveUploadJob[]>([]);

	const refresh = useCallback(async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams({ view });
			if (folderId && view === 'my') params.set('folderId', folderId);
			if (query.trim()) params.set('q', query.trim());
			const res = await fetch(`/api/drive/items?${params.toString()}`, { cache: 'no-store' });
			if (!res.ok) return;
			const data = (await res.json()) as {
				folders?: DriveFolderRecord[];
				items?: DriveItemRecord[];
				storage?: UserStorageBreakdown;
			};
			setFolders(Array.isArray(data.folders) ? data.folders : []);
			setItems(Array.isArray(data.items) ? data.items : []);
			if (data.storage) setStorage(data.storage);
		} catch (err) {
			console.warn('[Drive] Failed to load items:', err);
		} finally {
			setLoading(false);
		}
	}, [view, folderId, query]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const openFolder = useCallback((folder: { id: string; name: string } | null) => {
		if (!folder) {
			setFolderId(null);
			setBreadcrumbs([]);
			return;
		}
		setFolderId(folder.id);
		setBreadcrumbs((prev) => {
			const idx = prev.findIndex((b) => b.id === folder.id);
			return idx >= 0 ? prev.slice(0, idx + 1) : [...prev, folder];
		});
	}, []);

	const switchView = useCallback((nextView: DriveViewMode) => {
		setView(nextView);
		setFolderId(null);
		setBreadcrumbs([]);
	}, []);

	const createFolder = useCallback(
		async (name: string) => {
			const res = await fetch('/api/drive/folders', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, parentId: view === 'my' ? folderId : null }),
			});
			if (res.ok) await refresh();
			return res.ok;
		},
		[folderId, view, refresh]
	);

	const updateItem = useCallback(
		async (
			itemId: string,
			patch: { displayName?: string; folderId?: string | null; isStarred?: boolean; isTrashed?: boolean }
		) => {
			const res = await fetch(`/api/drive/items/${encodeURIComponent(itemId)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(patch),
			});
			if (res.ok) await refresh();
			return res.ok;
		},
		[refresh]
	);

	const deleteItemForever = useCallback(
		async (itemId: string) => {
			const res = await fetch(`/api/drive/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
			if (res.ok) await refresh();
			return res.ok;
		},
		[refresh]
	);

	const deleteFolder = useCallback(
		async (targetFolderId: string, permanent: boolean) => {
			const url = `/api/drive/folders/${encodeURIComponent(targetFolderId)}`;
			const res = permanent
				? await fetch(url, { method: 'DELETE' })
				: await fetch(url, {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ isTrashed: true }),
				  });
			if (res.ok) await refresh();
			return res.ok;
		},
		[refresh]
	);

	const uploadFiles = useCallback(
		async (fileList: FileList | File[]) => {
			for (const file of Array.from(fileList)) {
				const jobId = `${file.name}_${Date.now()}`;
				if (file.size > MAX_DRIVE_FILE_BYTES) {
					setUploads((p) => [{ id: jobId, name: file.name, pct: 0, status: 'failed', errorKey: 'driveUploadTooLarge' }, ...p.slice(0, 9)]);
					continue;
				}
				setUploads((p) => [{ id: jobId, name: file.name, pct: 0, status: 'uploading' }, ...p.slice(0, 9)]);
				try {
					const initRes = await fetch('/api/drive/upload/init', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							fileName: file.name,
							mimeType: file.type || 'application/octet-stream',
							totalBytes: file.size,
							folderId: view === 'my' ? folderId : null,
						}),
					});
					const initData = (await initRes.json().catch(() => ({}))) as { uploadId?: string; totalChunks?: number; code?: string };
					if (!initRes.ok || !initData.uploadId) {
						const errKey = initData.code === 'STORAGE_QUOTA_EXCEEDED' ? 'driveQuotaExceeded' : 'driveUploadFailed';
						setUploads((p) => p.map((j) => (j.id === jobId ? { ...j, status: 'failed', errorKey: errKey } : j)));
						continue;
					}
					const totalChunks = initData.totalChunks || Math.max(1, Math.ceil(file.size / DRIVE_CHUNK_BYTES));
					let failed = false;
					for (let idx = 0; idx < totalChunks; idx++) {
						const buf = await file.slice(idx * DRIVE_CHUNK_BYTES, (idx + 1) * DRIVE_CHUNK_BYTES).arrayBuffer();
						const cRes = await fetch(`/api/drive/upload/chunk?uploadId=${encodeURIComponent(initData.uploadId)}&index=${idx}`, { method: 'PUT', body: buf });
						if (!cRes.ok) {
							failed = true;
							break;
						}
						setUploads((p) => p.map((j) => (j.id === jobId ? { ...j, pct: Math.round(((idx + 1) / totalChunks) * 100) } : j)));
					}
					if (failed) {
						setUploads((p) => p.map((j) => (j.id === jobId ? { ...j, status: 'failed', errorKey: 'driveUploadFailed' } : j)));
						continue;
					}
					setUploads((p) => p.map((j) => (j.id === jobId ? { ...j, status: 'finalizing', pct: 100 } : j)));
					const compRes = await fetch('/api/drive/upload/complete', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ uploadId: initData.uploadId }),
					});
					setUploads((p) => p.map((j) => (j.id === jobId ? { ...j, status: compRes.ok ? 'done' : 'failed', errorKey: compRes.ok ? undefined : 'driveQuotaExceeded' } : j)));
				} catch {
					setUploads((p) => p.map((j) => (j.id === jobId ? { ...j, status: 'failed', errorKey: 'driveUploadFailed' } : j)));
				}
			}
			await refresh();
		},
		[folderId, view, refresh]
	);

	return {
		view,
		switchView,
		folderId,
		breadcrumbs,
		openFolder,
		query,
		setQuery,
		folders,
		items,
		storage,
		loading,
		uploads,
		refresh,
		createFolder,
		updateItem,
		deleteItemForever,
		deleteFolder,
		uploadFiles,
	};
}
