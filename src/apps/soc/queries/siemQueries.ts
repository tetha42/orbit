import type { SystemLog, HistogramBucket } from '../types';

export interface SiemQueryResult {
	logs: SystemLog[];
	totalCount: number;
	totalPages: number;
	histogram: HistogramBucket[];
	page: number;
	limit: number;
}

export async function fetchFilteredSiemLogs(params: URLSearchParams): Promise<SiemQueryResult> {
	const sp = new URLSearchParams(params.toString());
	sp.set('action', 'siem');

	const res = await fetch(`/api/soc?${sp.toString()}`, { cache: 'no-store' });
	if (!res.ok) {
		throw new Error(`Failed to load SIEM logs: ${res.status}`);
	}
	const data = await res.json();
	return {
		logs: Array.isArray(data.siem) ? data.siem : [],
		totalCount: typeof data.totalCount === 'number' ? data.totalCount : 0,
		totalPages: typeof data.totalPages === 'number' ? data.totalPages : 1,
		histogram: Array.isArray(data.histogram) ? data.histogram : [],
		page: typeof data.page === 'number' ? data.page : 1,
		limit: typeof data.limit === 'number' ? data.limit : 50,
	};
}
