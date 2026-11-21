'use client';

import type { AppID } from '@/types/workspace';

export interface WorkspaceSessionData {
	activeWallpaper: string;
	brightness: number;
	volume: number;
	isMuted: boolean;
	isDockAutoHide: boolean;
	dockApps: AppID[];
	updatedAt: number;
}

const DB_NAME = 'macos_workspace_db';
const DB_VERSION = 1;
const STORE_NAME = 'session_store';
const SESSION_KEY = 'current_workspace_session';

let cachedDbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
	if (cachedDbPromise) return cachedDbPromise;
	cachedDbPromise = new Promise((resolve, reject) => {
		if (typeof window === 'undefined' || !window.indexedDB) {
			cachedDbPromise = null;
			return reject(new Error('IndexedDB not supported in this environment'));
		}

		const request = window.indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		};

		request.onsuccess = () => {
			const db = request.result;
			db.onclose = () => {
				cachedDbPromise = null;
			};
			db.onversionchange = () => {
				db.close();
				cachedDbPromise = null;
			};
			resolve(db);
		};

		request.onerror = () => {
			cachedDbPromise = null;
			reject(request.error);
		};
	});
	return cachedDbPromise;
}

export async function saveWorkspaceSession(data: WorkspaceSessionData): Promise<void> {
	if (typeof window === 'undefined' || !window.indexedDB) return;
	try {
		const db = await openDatabase();
		return await new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE_NAME, 'readwrite');
			const store = transaction.objectStore(STORE_NAME);
			const putRequest = store.put(data, SESSION_KEY);

			putRequest.onsuccess = () => resolve();
			putRequest.onerror = () => reject(putRequest.error);
		});
	} catch (err) {
		console.warn('Failed to save session to IndexedDB:', err);
	}
}

export async function loadWorkspaceSession(): Promise<WorkspaceSessionData | null> {
	if (typeof window === 'undefined' || !window.indexedDB) return null;
	try {
		const db = await openDatabase();
		return await new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE_NAME, 'readonly');
			const store = transaction.objectStore(STORE_NAME);
			const getRequest = store.get(SESSION_KEY);

			getRequest.onsuccess = () => {
				resolve(getRequest.result || null);
			};

			getRequest.onerror = () => {
				reject(getRequest.error);
			};
		});
	} catch (err) {
		console.warn('Failed to load session from IndexedDB:', err);
		return null;
	}
}

export async function clearWorkspaceSession(): Promise<void> {
	if (typeof window === 'undefined' || !window.indexedDB) return;
	try {
		const db = await openDatabase();
		return await new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE_NAME, 'readwrite');
			const store = transaction.objectStore(STORE_NAME);
			const delRequest = store.delete(SESSION_KEY);

			delRequest.onsuccess = () => resolve();
			delRequest.onerror = () => reject(delRequest.error);
		});
	} catch (err) {
		console.warn('Failed to clear session in IndexedDB:', err);
	}
}
