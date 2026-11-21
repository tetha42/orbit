import { getPgPool } from '@/db/core/pool';
import { ensurePostgresInit } from '@/db/core/init';
import type { HistogramBucket, SiemLogsResponse, SystemLog, SystemLogFilter } from './types';
import { buildSystemLogWhereClause } from './queryFilter';

export async function getSystemLogsPaginated(filter: SystemLogFilter = {}): Promise<SiemLogsResponse> {
	await ensurePostgresInit();
	const p = getPgPool();
	const now = Date.now();
	const { whereClause, values, effectiveStart, effectiveEnd } = buildSystemLogWhereClause(filter, now);

	const page = Math.max(1, Number(filter.page) || 1);
	const limit = Math.max(1, Math.min(Number(filter.limit) || 100, 5000));
	const reqOffset = (page - 1) * limit;

	const histStart = effectiveStart ?? now - 24 * 60 * 60_000;
	const histEnd = effectiveEnd ?? now;
	const span = Math.max(60_000, histEnd - histStart);
	const bucketSize =
		span <= 30 * 60_000
			? 60_000
			: span <= 3 * 3600_000
				? 5 * 60_000
				: span <= 24 * 3600_000
					? 3600_000
					: span <= 7 * 24 * 3600_000
						? 6 * 3600_000
						: 24 * 3600_000;

	const queryRows = (off: number) =>
		p.query(
			`SELECT id, timestamp AS time, level AS level, service AS service, message AS message, details AS detail, user_id AS "userId", ip
			 FROM system_logs
			 ${whereClause}
			 ORDER BY timestamp DESC NULLS LAST, id DESC
			 LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
			[...values, limit, off]
		);

	const [countRes, histRes, initialRowsRes] = await Promise.all([
		p.query(`SELECT COUNT(*)::int AS n FROM system_logs ${whereClause}`, values),
		p
			.query(
				`SELECT
					(timestamp / ${bucketSize}) * ${bucketSize} AS bucket,
					COUNT(*)::int AS count,
					COUNT(*) FILTER (WHERE level = 'CRITICAL')::int AS critical,
					COUNT(*) FILTER (WHERE level = 'ERROR')::int AS error,
					COUNT(*) FILTER (WHERE level = 'WARN')::int AS warn,
					COUNT(*) FILTER (WHERE level = 'INFO')::int AS info
				 FROM system_logs
				 ${whereClause}
				 GROUP BY 1
				 ORDER BY 1 ASC`,
				values
			)
			.catch((histErr) => {
				console.error('[getSystemLogsPaginated] Histogram query failed:', histErr);
				return null;
			}),
		queryRows(reqOffset),
	]);

	const totalCount = Number(countRes.rows[0]?.n || 0);
	const totalPages = Math.max(1, Math.ceil(totalCount / limit));
	const safePage = Math.min(page, totalPages);
	const rowsRes = safePage !== page ? await queryRows((safePage - 1) * limit) : initialRowsRes;

	const histogram: HistogramBucket[] = histRes
		? histRes.rows.map((r) => {
				const bTs = Number(r.bucket);
				const d = new Date(bTs);
				const label =
					bucketSize < 3600_000
						? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
						: bucketSize <= 3600_000
							? `${String(d.getHours()).padStart(2, '0')}:00`
							: `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:00`;

				return {
					bucket: bTs,
					start: bTs,
					end: bTs + bucketSize,
					label,
					count: Number(r.count || 0),
					critical: Number(r.critical || 0),
					error: Number(r.error || 0),
					warn: Number(r.warn || 0),
					info: Number(r.info || 0),
				};
			})
		: [];

	const logs = rowsRes.rows.map((row) => {
		let parsedDetail: Record<string, unknown> | null = null;
		if (row.detail) {
			try {
				parsedDetail = typeof row.detail === 'string' ? JSON.parse(row.detail) : row.detail;
			} catch {
				parsedDetail = null;
			}
		}
		return {
			id: Number(row.id),
			time: Number(row.time),
			level: row.level,
			service: row.service,
			message: row.message,
			detail: parsedDetail,
			userId: row.userId ?? null,
			ip: row.ip,
		};
	});

	return {
		logs,
		totalCount,
		page: safePage,
		limit,
		totalPages,
		histogram,
	};
}

export async function getSystemLogs(filter: SystemLogFilter = {}): Promise<SystemLog[]> {
	const res = await getSystemLogsPaginated(filter);
	return res.logs;
}
