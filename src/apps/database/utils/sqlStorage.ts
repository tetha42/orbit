export interface SavedQuery {
	id: string;
	title: string;
	sql: string;
	createdAt: number;
}

export interface QueryHistoryItem {
	id: string;
	sql: string;
	timestamp: number;
	durationMs?: number;
}

export const SAVED_QUERIES_STORAGE_KEY = 'clubpanel_db_saved_queries';
export const QUERY_HISTORY_STORAGE_KEY = 'clubpanel_db_query_history';

export function loadSavedQueries(): SavedQuery[] {
	try {
		const raw = localStorage.getItem(SAVED_QUERIES_STORAGE_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as SavedQuery[]) : [];
	} catch {
		return [];
	}
}

export function persistSavedQueries(queries: SavedQuery[]): void {
	try {
		localStorage.setItem(SAVED_QUERIES_STORAGE_KEY, JSON.stringify(queries));
	} catch {
		// Ignore local storage errors
	}
}

export function loadQueryHistory(): QueryHistoryItem[] {
	try {
		const raw = localStorage.getItem(QUERY_HISTORY_STORAGE_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as QueryHistoryItem[]) : [];
	} catch {
		return [];
	}
}

export function appendQueryHistory(sql: string, durationMs?: number): void {
	try {
		const list = loadQueryHistory();
		const newItem: QueryHistoryItem = {
			id: 'h_' + Date.now(),
			sql: sql.trim(),
			timestamp: Date.now(),
			durationMs,
		};
		const updated = [newItem, ...list.slice(0, 49)];
		localStorage.setItem(QUERY_HISTORY_STORAGE_KEY, JSON.stringify(updated));
	} catch {
		// Ignore local storage errors
	}
}

export function clearQueryHistoryStorage(): void {
	try {
		localStorage.removeItem(QUERY_HISTORY_STORAGE_KEY);
	} catch {
		// Ignore local storage errors
	}
}
