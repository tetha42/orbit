import type { SiemFilterSnapshot } from '../../types';

export const INITIAL_SIEM_FILTER_SNAPSHOT: SiemFilterSnapshot = {
	service: 'all',
	serviceOp: 'eq',
	level: 'all',
	levelOp: 'eq',
	ip: '',
	ipOp: 'eq',
	search: '',
	searchOp: 'contains',
	searchField: 'all',
	timeRange: '24h',
	page: 1,
	limit: 50,
};

export function buildSiemQueryParams(current: SiemFilterSnapshot): URLSearchParams {
	const params = new URLSearchParams();

	if (current.service && current.service !== 'all') {
		params.set('service', current.service);
		if (current.serviceOp === 'neq') params.set('serviceOp', 'neq');
	}
	if (current.level && current.level !== 'all') {
		params.set('level', current.level);
		if (current.levelOp === 'neq') params.set('levelOp', 'neq');
	}
	if (current.ip && current.ip.trim()) {
		params.set('ip', current.ip.trim());
		if (current.ipOp !== 'eq') params.set('ipOp', current.ipOp);
	}
	if (current.search && current.search.trim()) {
		params.set('search', current.search.trim());
		if (current.searchOp !== 'contains') params.set('searchOp', current.searchOp);
		if (current.searchField !== 'all') params.set('searchField', current.searchField);
	}
	if (current.timeRange && current.timeRange !== 'all') {
		params.set('timeRange', current.timeRange);
	}
	if (current.startTime) {
		params.set('startTime', String(current.startTime));
	}
	if (current.endTime) {
		params.set('endTime', String(current.endTime));
	}
	params.set('page', String(current.page || 1));
	params.set('limit', String(current.limit || 50));

	return params;
}

export function parseCustomDateRange(
	startStr: string,
	endStr: string
): { startTs: number; endTs: number } | null {
	if (!startStr || !endStr) return null;
	const startTs = new Date(startStr).getTime();
	const endTs = new Date(endStr).getTime();
	if (isNaN(startTs) || isNaN(endTs) || startTs >= endTs) return null;
	return { startTs, endTs };
}

export function clampDateWindowStart(
	startTs: number,
	endTs: number,
	maxWindowHours: number
): number {
	const maxWindowMs = maxWindowHours * 3600_000;
	if (endTs - startTs > maxWindowMs) return endTs - maxWindowMs;
	return startTs;
}

export function computePivotOverride(
	field: string,
	value: string,
	op: 'eq' | 'neq'
): Partial<SiemFilterSnapshot> {
	if (field === 'ip') {
		return { ip: value, ipOp: op, page: 1 };
	}
	if (field === 'service') {
		return { service: value, serviceOp: op, page: 1 };
	}
	if (field === 'level') {
		return { level: value, levelOp: op, page: 1 };
	}
	if (field === 'userId') {
		const searchOp = op === 'eq' ? 'equals' : 'not_equals';
		return { searchField: 'userId', search: value, searchOp, page: 1 };
	}
	const searchTerm = `"${field}":`;
	const searchOp = op === 'eq' ? 'contains' : 'not_contains';
	return { searchField: 'detail', search: searchTerm, searchOp, page: 1 };
}
