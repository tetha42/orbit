import { getPgPool } from '@/db/core/pool';
import { ensurePostgresInit } from '@/db/core/init';
import { cleanIp } from '@/lib/audit';
import {
	DEFAULT_RETENTION_DAYS,
	MAX_DETAIL_JSON_LEN,
	MAX_MESSAGE_LENGTH,
	MAX_SERVICE_LEN,
	type SystemLog,
} from './types';
import { sanitizeLogDetail, sanitizeLogText } from './sanitizers';
import { dispatchLog } from './liveStream';

const logMaintenanceState = globalThis as { __SystemLogMaintenance?: boolean };
const MAX_SYSTEM_LOG_COUNT = 5_000;

function systemLogRetentionDays(): number {
	const n = Number(process.env.SYSTEM_LOG_RETENTION_DAYS);
	return Number.isInteger(n) && n >= 7 && n <= 3650 ? n : DEFAULT_RETENTION_DAYS;
}

export function startSystemLogMaintenance(): void {
	if (logMaintenanceState.__SystemLogMaintenance) return;
	logMaintenanceState.__SystemLogMaintenance = true;
	const run = async () => {
		try {
			const pool = getPgPool();
			const limit = Date.now() - systemLogRetentionDays() * 24 * 3600 * 1000;
			// 1. Time-based retention cleanup
			await pool.query('DELETE FROM system_logs WHERE timestamp < $1', [limit]);
			// 2. Maximum row quota (prune INFO/WARN only; preserve CRITICAL/ERROR logs)
			await pool.query(
				`DELETE FROM system_logs
				 WHERE level NOT IN ('CRITICAL', 'ERROR')
				   AND id NOT IN (
					 SELECT id FROM system_logs
					 WHERE level NOT IN ('CRITICAL', 'ERROR')
					 ORDER BY timestamp DESC
					 LIMIT $1
				 )`,
				[MAX_SYSTEM_LOG_COUNT]
			);
			// 3. Remove expired email verification OTP records to prevent bloat
			await pool.query('DELETE FROM verification_tokens WHERE expires_at < $1', [Date.now()]);
		} catch (err) {
			console.error('[SystemLog] Cleanup error:', err);
		}
	};
	setTimeout(run, 15_000).unref?.();
	setInterval(run, 60 * 60 * 1000).unref?.();
}

export async function logSystemEvent(params: {
	service: string;
	level?: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
	message: string;
	detail?: Record<string, unknown> | null;
	userId?: string | null;
	ip?: string;
}): Promise<void> {
	try {
		await ensurePostgresInit();
		startSystemLogMaintenance();
		const p = getPgPool();

		let level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' =
			params.level === 'CRITICAL' || params.level === 'WARN' || params.level === 'ERROR'
				? params.level
				: 'INFO';
		const service = sanitizeLogText(params.service || 'system', MAX_SERVICE_LEN).toLowerCase() || 'system';
		const message = sanitizeLogText(params.message, MAX_MESSAGE_LENGTH);
		if (!message) return;

		const ip = cleanIp(params.ip || '');
		// Localhost test isolation: Do not write CRITICAL for localhost traffic in development/test
		const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
		if (level === 'CRITICAL' && isLocalhost && process.env.NODE_ENV !== 'production') {
			level = 'WARN';
		}

		const safeDetail = sanitizeLogDetail(params.detail);
		let detailJson = safeDetail ? JSON.stringify(safeDetail) : null;
		if (detailJson && detailJson.length > MAX_DETAIL_JSON_LEN) {
			detailJson = JSON.stringify({ _truncated: true, preview: detailJson.slice(0, 1024) });
		}

		const userId = params.userId ? sanitizeLogText(params.userId, 120) : null;
		const time = Date.now();

		const insertRes = await p.query(
			`INSERT INTO system_logs (timestamp, level, service, message, details, user_id, ip)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 RETURNING id`,
			[time, level, service, message, detailJson, userId, ip]
		);

		const logId = Number(insertRes.rows[0]?.id ?? time);
		const broadcastObj: SystemLog = {
			id: logId,
			time,
			level,
			service,
			message,
			detail: safeDetail ?? null,
			userId,
			ip,
		};

		dispatchLog(broadcastObj);

		try {
			const notifyPayload = JSON.stringify({
				id: logId,
				time,
				level,
				service,
				message: message.slice(0, 500),
				detail: safeDetail ? (typeof safeDetail === 'object' ? safeDetail : String(safeDetail)) : null,
				userId,
				ip,
			});
			if (notifyPayload.length < 7500) {
				await p.query(`SELECT pg_notify('soc_live_logs', $1)`, [notifyPayload]);
			}
		} catch {
			// Non-fatal if NOTIFY channel fails or is unsupported
		}
	} catch (err) {
		console.error('[logSystemEvent Error]:', err);
	}
}
