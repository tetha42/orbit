import os from 'node:os';
import { ensurePostgresInit, getPgPool } from '@/db';
import type { HostAndPoolTelemetry, HourlyAttackPoint } from './types';

export function getHostAndPoolTelemetry(): HostAndPoolTelemetry {
	let pgPool = {
		totalCount: 0,
		idleCount: 0,
		waitingCount: 0,
		max: 15,
	};
	try {
		const pool = getPgPool();
		pgPool = {
			totalCount: pool.totalCount ?? 0,
			idleCount: pool.idleCount ?? 0,
			waitingCount: pool.waitingCount ?? 0,
			max: 15,
		};
	} catch {
		// Ignore pool initialization errors in telemetry
	}

	const mem = process.memoryUsage();
	const osTotal = os.totalmem();
	const osFree = os.freemem();

	return {
		pgPool,
		memory: {
			processRss: mem.rss,
			processHeapUsed: mem.heapUsed,
			processHeapTotal: mem.heapTotal,
			osTotal,
			osFree,
			osUsed: Math.max(0, osTotal - osFree),
		},
		cpu: {
			loadAvg: os.loadavg(),
			uptime: os.uptime(),
		},
	};
}

export async function getHourlyStrikeDistribution(): Promise<HourlyAttackPoint[]> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();
	const since24h = now - 24 * 3600_000;
	try {
		const res = await pool.query(
			`SELECT
				(timestamp / 3600000) * 3600000 AS "hourBucket",
				COUNT(*) FILTER (WHERE level IN ('ERROR', 'CRITICAL'))::int AS "blockedCount",
				COUNT(*) FILTER (WHERE level = 'WARN')::int AS "warningCount",
				COUNT(*)::int AS "totalCount"
			 FROM system_logs
			 WHERE timestamp >= $1 AND service IN ('security', 'auth') AND level IN ('WARN', 'ERROR', 'CRITICAL')
			 GROUP BY 1
			 ORDER BY 1 ASC`,
			[since24h]
		);
		const currentHour = Math.floor(now / 3600_000) * 3600_000;
		const map = new Map<number, { blocked: number; warning: number; total: number }>();
		for (const r of res.rows) {
			map.set(Number(r.hourBucket), {
				blocked: Number(r.blockedCount ?? 0),
				warning: Number(r.warningCount ?? 0),
				total: Number(r.totalCount ?? 0),
			});
		}
		const list: HourlyAttackPoint[] = [];
		for (let i = 23; i >= 0; i--) {
			const ts = currentHour - i * 3600_000;
			const d = new Date(ts);
			const hourLabel = `${String(d.getHours()).padStart(2, '0')}:00`;
			const item = map.get(ts) ?? { blocked: 0, warning: 0, total: 0 };
			list.push({
				hourLabel,
				timestamp: ts,
				blockedCount: item.blocked,
				warningCount: item.warning,
				totalCount: item.total,
			});
		}
		return list;
	} catch {
		return [];
	}
}
