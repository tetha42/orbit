import { MAX_SERVICE_LEN, type FilterColumn, type SystemLogFilter } from './types';
import { likeEscape, sanitizeLogText } from './sanitizers';

function getColumnExpr(f: FilterColumn): string | null {
	switch (f) {
		case 'message':
			return 'message';
		case 'ip':
			return 'ip';
		case 'service':
			return 'service';
		case 'userId':
			return "COALESCE(user_id, '')";
		case 'detail':
			return "COALESCE(details::text, '')";
		default:
			return null;
	}
}

export function buildSystemLogWhereClause(filter: SystemLogFilter, now: number): {
	whereClause: string;
	values: unknown[];
	effectiveStart?: number;
	effectiveEnd?: number;
} {
	const conditions: string[] = [];
	const values: unknown[] = [];
	let idx = 1;

	let effectiveStart: number | undefined;
	let effectiveEnd: number | undefined;

	if (filter.timeRange === '15m') {
		effectiveStart = now - 15 * 60_000;
		effectiveEnd = now;
	} else if (filter.timeRange === '1h') {
		effectiveStart = now - 60 * 60_000;
		effectiveEnd = now;
	} else if (filter.timeRange === '6h') {
		effectiveStart = now - 6 * 60 * 60_000;
		effectiveEnd = now;
	} else if (filter.timeRange === '24h') {
		effectiveStart = now - 24 * 60 * 60_000;
		effectiveEnd = now;
	} else if (filter.timeRange === '7d') {
		effectiveStart = now - 7 * 24 * 60 * 60_000;
		effectiveEnd = now;
	} else {
		if (filter.startTime && Number.isFinite(Number(filter.startTime))) {
			effectiveStart = Number(filter.startTime);
		}
		if (filter.endTime && Number.isFinite(Number(filter.endTime))) {
			effectiveEnd = Number(filter.endTime);
		}
	}

	if (effectiveStart !== undefined && Number.isFinite(effectiveStart)) {
		conditions.push(`timestamp >= $${idx++}`);
		values.push(effectiveStart);
	}
	if (effectiveEnd !== undefined && Number.isFinite(effectiveEnd)) {
		conditions.push(`timestamp <= $${idx++}`);
		values.push(effectiveEnd);
	}

	if (filter.service && filter.service !== 'all') {
		const srv = sanitizeLogText(filter.service, MAX_SERVICE_LEN).toLowerCase();
		conditions.push(filter.serviceOp === 'neq' ? `service != $${idx++}` : `service = $${idx++}`);
		values.push(srv);
	}

	if (filter.level && filter.level !== 'all') {
		const sev = sanitizeLogText(filter.level, 16).toUpperCase();
		conditions.push(filter.levelOp === 'neq' ? `level != $${idx++}` : `level = $${idx++}`);
		values.push(sev);
	}

	if (filter.ip && filter.ip.trim()) {
		const clean = sanitizeLogText(filter.ip.trim(), 45);
		if (clean) {
			if (filter.ipOp === 'neq') {
				conditions.push(`ip != $${idx++}`);
				values.push(clean);
			} else if (filter.ipOp === 'not_contains') {
				conditions.push(`ip NOT ILIKE $${idx++} ESCAPE '\\'`);
				values.push(`%${likeEscape(clean)}%`);
			} else if (filter.ipOp === 'contains') {
				conditions.push(`ip ILIKE $${idx++} ESCAPE '\\'`);
				values.push(`%${likeEscape(clean)}%`);
			} else {
				conditions.push(`ip = $${idx++}`);
				values.push(clean);
			}
		}
	}

	if (filter.search && filter.search.trim()) {
		const rawQuery = filter.search.trim().slice(0, 160);
		const op = filter.searchOp || 'contains';
		const colExpr = getColumnExpr(filter.searchField || 'all');

		if (colExpr) {
			if (op === 'equals') {
				conditions.push(`${colExpr} = $${idx++}`);
				values.push(rawQuery);
			} else if (op === 'not_equals') {
				conditions.push(`${colExpr} != $${idx++}`);
				values.push(rawQuery);
			} else if (op === 'not_contains') {
				conditions.push(`${colExpr} NOT ILIKE $${idx++} ESCAPE '\\'`);
				values.push(`%${likeEscape(rawQuery)}%`);
			} else if (op === 'starts_with') {
				conditions.push(`${colExpr} ILIKE $${idx++} ESCAPE '\\'`);
				values.push(`${likeEscape(rawQuery)}%`);
			} else if (op === 'ends_with') {
				conditions.push(`${colExpr} ILIKE $${idx++} ESCAPE '\\'`);
				values.push(`%${likeEscape(rawQuery)}`);
			} else {
				conditions.push(`${colExpr} ILIKE $${idx++} ESCAPE '\\'`);
				values.push(`%${likeEscape(rawQuery)}%`);
			}
		} else if (op === 'equals') {
			conditions.push(`(message = $${idx} OR ip = $${idx} OR service = $${idx} OR COALESCE(user_id, '') = $${idx})`);
			values.push(rawQuery);
			idx++;
		} else if (op === 'not_equals') {
			conditions.push(`(message != $${idx} AND ip != $${idx} AND service != $${idx} AND COALESCE(user_id, '') != $${idx})`);
			values.push(rawQuery);
			idx++;
		} else if (op === 'not_contains') {
			conditions.push(
				`(message NOT ILIKE $${idx} ESCAPE '\\' AND ip NOT ILIKE $${idx} ESCAPE '\\' AND ` +
					`service NOT ILIKE $${idx} ESCAPE '\\' AND COALESCE(user_id, '') NOT ILIKE $${idx} ESCAPE '\\' ` +
					`AND COALESCE(details::text, '') NOT ILIKE $${idx} ESCAPE '\\')`
			);
			values.push(`%${likeEscape(rawQuery)}%`);
			idx++;
		} else {
			for (const token of rawQuery.split(/\s+/).filter(Boolean)) {
				const kqlMatch = token.match(/^(service|level|ip|user|msg):(!?)(.+)$/i);
				if (kqlMatch) {
					const key = kqlMatch[1].toLowerCase();
					const isNeg = kqlMatch[2] === '!';
					const val = kqlMatch[3].trim();
					if (key === 'service') {
						conditions.push(isNeg ? `service != $${idx++}` : `service = $${idx++}`);
						values.push(sanitizeLogText(val, MAX_SERVICE_LEN).toLowerCase());
					} else if (key === 'level') {
						conditions.push(isNeg ? `level != $${idx++}` : `level = $${idx++}`);
						values.push(sanitizeLogText(val, 16).toUpperCase());
					} else if (key === 'ip') {
						conditions.push(isNeg ? `ip != $${idx++}` : `ip = $${idx++}`);
						values.push(sanitizeLogText(val, 45));
					} else if (key === 'user') {
						conditions.push(isNeg ? `COALESCE(user_id, '') != $${idx++}` : `COALESCE(user_id, '') = $${idx++}`);
						values.push(sanitizeLogText(val, 120));
					} else if (key === 'msg') {
						conditions.push(isNeg ? `message NOT ILIKE $${idx++} ESCAPE '\\'` : `message ILIKE $${idx++} ESCAPE '\\'`);
						values.push(`%${likeEscape(val)}%`);
					}
				} else if ((token.startsWith('-') || token.startsWith('!')) && token.length > 1) {
					conditions.push(
						`(message NOT ILIKE $${idx} ESCAPE '\\' AND ip NOT ILIKE $${idx} ESCAPE '\\' AND ` +
							`service NOT ILIKE $${idx} ESCAPE '\\' AND COALESCE(user_id, '') NOT ILIKE $${idx} ESCAPE '\\' ` +
							`AND COALESCE(details::text, '') NOT ILIKE $${idx} ESCAPE '\\')`
					);
					values.push(`%${likeEscape(token.slice(1))}%`);
					idx++;
				} else {
					conditions.push(
						`(message ILIKE $${idx} ESCAPE '\\' OR service ILIKE $${idx} ESCAPE '\\' OR ` +
							`ip ILIKE $${idx} ESCAPE '\\' OR COALESCE(user_id, '') ILIKE $${idx} ESCAPE '\\' ` +
							`OR COALESCE(details::text, '') ILIKE $${idx} ESCAPE '\\')`
					);
					values.push(`%${likeEscape(token)}%`);
					idx++;
				}
			}
		}
	}

	return {
		whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
		values,
		effectiveStart,
		effectiveEnd,
	};
}
