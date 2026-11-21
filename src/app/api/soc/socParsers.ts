import { parseIpCandidate } from '@/lib/http';
import type {
	FilterOperator,
	FilterColumn,
	TimeRangePreset,
} from '@/db/repositories/logs.repo';

export function parseIpOrCidr(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const candidate = raw.trim();
	if (candidate.includes('/')) {
		const parts = candidate.split('/');
		if (parts.length === 2) {
			const subnet = parseIpCandidate(parts[0]);
			const prefixStr = parts[1].trim();
			if (subnet && /^\d+$/.test(prefixStr)) {
				const prefix = parseInt(prefixStr, 10);
				const isIpv6 = subnet.includes(':');
				const minPrefix = isIpv6 ? 16 : 8;
				const maxPrefix = isIpv6 ? 128 : 32;
				// Safety: don't allow subnets broader than /8 (/16 for IPv6) to prevent accidental global lockout
				if (prefix >= minPrefix && prefix <= maxPrefix) {
					return `${subnet}/${prefix}`;
				}
			}
		}
		return null;
	}
	return parseIpCandidate(candidate);
}

export function parseSiemFilter(searchParams: URLSearchParams) {
	const service = searchParams.get('service') || undefined;
	const serviceOp = (searchParams.get('serviceOp') as 'eq' | 'neq') || undefined;
	const level = searchParams.get('level') || undefined;
	const levelOp = (searchParams.get('levelOp') as 'eq' | 'neq') || undefined;
	const ip = searchParams.get('ip') || undefined;
	const ipOp = (searchParams.get('ipOp') as 'eq' | 'neq' | 'contains' | 'not_contains') || undefined;
	const search = searchParams.get('search') || undefined;
	const searchOp = (searchParams.get('searchOp') as FilterOperator) || undefined;
	const searchField = (searchParams.get('searchField') as FilterColumn) || undefined;
	const timeRange = (searchParams.get('timeRange') as TimeRangePreset) || undefined;
	const rawStartTime = searchParams.get('startTime');
	const rawEndTime = searchParams.get('endTime');
	const parsedStartTime = rawStartTime !== null && rawStartTime.trim() !== '' ? Number(rawStartTime) : NaN;
	const parsedEndTime = rawEndTime !== null && rawEndTime.trim() !== '' ? Number(rawEndTime) : NaN;
	const startTime = Number.isFinite(parsedStartTime) ? parsedStartTime : undefined;
	const endTime = Number.isFinite(parsedEndTime) ? parsedEndTime : undefined;
	const parsedPage = parseInt(searchParams.get('page') || '1', 10);
	const parsedLimit = parseInt(searchParams.get('limit') || '50', 10);
	const page = Math.max(1, Number.isFinite(parsedPage) ? parsedPage : 1);
	const limit = Math.min(500, Math.max(10, Number.isFinite(parsedLimit) ? parsedLimit : 50));

	return {
		service,
		serviceOp,
		level,
		levelOp,
		ip,
		ipOp,
		search,
		searchOp,
		searchField,
		timeRange,
		startTime,
		endTime,
		page,
		limit,
	};
}
