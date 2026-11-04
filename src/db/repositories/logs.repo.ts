import { Client } from 'pg';
import { getPgPool, ensurePostgresInit } from '@/db';
import { cleanIp } from '@/lib/audit';

export interface SystemLog {
	id: number;
	time: number;
	level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
	service: string;
	message: string;
	detail: Record<string, unknown> | null;
	userId: string | null;
	ip: string;
}

export type FilterOperator =
	| 'contains'
	| 'not_contains'
	| 'equals'
	| 'not_equals'
	| 'starts_with'
	| 'ends_with';

export type FilterColumn = 'all' | 'message' | 'ip' | 'service' | 'userId' | 'detail';

export type TimeRangePreset = '15m' | '1h' | '6h' | '24h' | '7d' | 'custom' | 'all';

export interface HistogramBucket {
	bucket: number;
	start: number;
	end: number;
	label: string;
	count: number;
	critical: number;
	error: number;
	warn: number;
	info: number;
}

export interface SiemLogsResponse {
	logs: SystemLog[];
	totalCount: number;
	page: number;
	limit: number;
	totalPages: number;
	histogram: HistogramBucket[];
}

export interface SystemLogFilter {
	service?: string;
	serviceOp?: 'eq' | 'neq';
	level?: string;
	levelOp?: 'eq' | 'neq';
	ip?: string;
	ipOp?: 'eq' | 'neq' | 'contains' | 'not_contains';
	search?: string;
	searchOp?: FilterOperator;
	searchField?: FilterColumn;
	timeRange?: TimeRangePreset;
	startTime?: number;
	endTime?: number;
	page?: number;
	limit?: number;
}

const SENSITIVE_LOG_KEY_RE =
	/password|password|secret|pass_?hash|sifre_?hash|totp_?secret|recovery|cookie|authorization|private_?key|plain_?secret/i;

const MAX_MESSAGE_LENGTH = 1000;
const MAX_SERVICE_LEN = 40;
const MAX_DETAIL_JSON_LEN = 8192;
const DEFAULT_RETENTION_DAYS = 90;

/**
 * Strips ANSI escape sequences and control characters (\r, \n, \0, etc.) to
 * prevent log injection / terminal escape attacks when logs are inspected.
 */
export function sanitizeLogText(value: unknown, maxLen: number): string {
	return String(value ?? '')
		.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
		.replace(/[\r\n\0]+/g, ' ')
		.replace(/\p{Cc}/gu, '')
		.trim()
		.slice(0, maxLen);
}

export function sanitizeLogDetail(
	input: Record<string, unknown> | null | undefined,
	depth = 0
): Record<string, unknown> | null {
	if (!input || typeof input !== 'object' || Array.isArray(input) || depth > 3) {
		return null;
	}
	const out: Record<string, unknown> = {};
	for (const [key, rawVal] of Object.entries(input)) {
		const cleanKey = sanitizeLogText(key, 64);
		if (!cleanKey) continue;
		if (SENSITIVE_LOG_KEY_RE.test(cleanKey)) {
			out[cleanKey] = '[REDACTED]';
			continue;
		}
		if (rawVal === null || typeof rawVal === 'boolean' || typeof rawVal === 'number') {
			out[cleanKey] = rawVal;
		} else if (typeof rawVal === 'string') {
			out[cleanKey] = sanitizeLogText(rawVal, 500);
		} else if (Array.isArray(rawVal)) {
			out[cleanKey] = rawVal.slice(0, 25).map((item) =>
				typeof item === 'string'
					? sanitizeLogText(item, 200)
					: typeof item === 'number' || typeof item === 'boolean'
						? item
						: String(item ?? '').slice(0, 100)
			);
		} else if (typeof rawVal === 'object') {
			out[cleanKey] = sanitizeLogDetail(rawVal as Record<string, unknown>, depth + 1);
		}
	}
	return Object.keys(out).length > 0 ? out : null;
}

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

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
			// 1. Süreye dayalı genel temizlik
			await pool.query('DELETE FROM system_logs WHERE timestamp < $1', [limit]);
			// 2. Maksimum satır kotası (Yalnızca INFO ve WARN temizlenir; CRITICAL alarmlar ve denetim logları korunur)
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
			// 3. Süresi dolmuş e-posta doğrulama OTP kayıtlarını temizle (Disk bloat önleme)
			await pool.query('DELETE FROM verification_tokens WHERE expires_at < $1', [Date.now()]);
		} catch (err) {
			console.error('[SystemLog] Temizlik hatası:', err);
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
			message: message,
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
		console.error('[logSystemEvent Hatası]:', err);
	}
}

type LogListener = (log: SystemLog) => void;
const liveLogListeners = new Set<LogListener>();
const recentlyDispatchedLogIds = new Set<number>();

function dispatchLog(log: SystemLog) {
	if (recentlyDispatchedLogIds.has(log.id)) return;
	recentlyDispatchedLogIds.add(log.id);
	if (recentlyDispatchedLogIds.size > 1000) {
		const it = recentlyDispatchedLogIds.values();
		for (let i = 0; i < 500; i++) {
			const val = it.next().value;
			if (val !== undefined) recentlyDispatchedLogIds.delete(val);
		}
	}
	for (const listener of liveLogListeners) {
		try {
			listener(log);
		} catch {
			// ignore
		}
	}
}

interface SocLogGlobal {
	__socPgListening?: boolean;
	__socPgClient?: Client;
}
const globalSocStore = globalThis as typeof globalThis & SocLogGlobal;

function ensureSocPgListener() {
	if (globalSocStore.__socPgListening) return;
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) return;
	globalSocStore.__socPgListening = true;

	const client = new Client({ connectionString });
	globalSocStore.__socPgClient = client;
	let retryScheduled = false;

	const scheduleRetry = (delayMs: number) => {
		if (retryScheduled) return;
		retryScheduled = true;
		globalSocStore.__socPgListening = false;
		if (globalSocStore.__socPgClient === client) globalSocStore.__socPgClient = undefined;
		client.removeAllListeners();
		client.on('error', () => {});
		client.end().catch(() => {});
		const timer = setTimeout(() => {
			void ensureSocPgListener();
		}, delayMs);
		timer.unref?.();
	};

	client.on('notification', (msg) => {
		if (msg.channel !== 'soc_live_logs' || !msg.payload) return;
		try {
			const parsed = JSON.parse(msg.payload) as SystemLog;
			if (parsed && typeof parsed === 'object' && typeof parsed.id === 'number') {
				dispatchLog(parsed);
			}
		} catch {
			// ignore malformed
		}
	});

	client.on('error', () => scheduleRetry(3000));
	client.on('end', () => scheduleRetry(3000));

	client
		.connect()
		.then(() => client.query('LISTEN soc_live_logs'))
		.catch(() => scheduleRetry(5000));
}

export function subscribeToLiveLogs(listener: LogListener): () => void {
	ensureSocPgListener();
	liveLogListeners.add(listener);
	return () => {
		liveLogListeners.delete(listener);
	};
}

export async function getSystemLogsPaginated(filter: SystemLogFilter = {}): Promise<SiemLogsResponse> {
	await ensurePostgresInit();
	const p = getPgPool();
	const conditions: string[] = [];
	const values: unknown[] = [];
	let idx = 1;

	// 1. Time range conditions
	const now = Date.now();
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
	} else if (filter.timeRange === 'custom') {
		if (filter.startTime && Number.isFinite(Number(filter.startTime))) {
			effectiveStart = Number(filter.startTime);
		}
		if (filter.endTime && Number.isFinite(Number(filter.endTime))) {
			effectiveEnd = Number(filter.endTime);
		}
	} else {
		// Fallbacks if directly passed
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

	// 2. Service condition
	if (filter.service && filter.service !== 'all') {
		const srv = sanitizeLogText(filter.service, MAX_SERVICE_LEN).toLowerCase();
		if (filter.serviceOp === 'neq') {
			conditions.push(`service != $${idx++}`);
		} else {
			conditions.push(`service = $${idx++}`);
		}
		values.push(srv);
	}

	// 3. Severity condition
	if (filter.level && filter.level !== 'all') {
		const sev = sanitizeLogText(filter.level, 16).toUpperCase();
		if (filter.levelOp === 'neq') {
			conditions.push(`level != $${idx++}`);
		} else {
			conditions.push(`level = $${idx++}`);
		}
		values.push(sev);
	}

	// 4. IP condition
	if (filter.ip && filter.ip.trim()) {
		const cleanIp = sanitizeLogText(filter.ip.trim(), 45);
		if (cleanIp) {
			if (filter.ipOp === 'neq') {
				conditions.push(`ip != $${idx++}`);
				values.push(cleanIp);
			} else if (filter.ipOp === 'not_contains') {
				conditions.push(`ip NOT ILIKE $${idx++} ESCAPE '\\'`);
				values.push(`%${likeEscape(cleanIp)}%`);
			} else if (filter.ipOp === 'contains') {
				conditions.push(`ip ILIKE $${idx++} ESCAPE '\\'`);
				values.push(`%${likeEscape(cleanIp)}%`);
			} else {
				conditions.push(`ip = $${idx++}`);
				values.push(cleanIp);
			}
		}
	}

	// 5. Search condition
	if (filter.search && filter.search.trim()) {
		const rawQuery = filter.search.trim().slice(0, 160);
		const op = filter.searchOp || 'contains';
		const field = filter.searchField || 'all';

		const getColumnExpr = (f: FilterColumn): string | null => {
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
		};

		const colExpr = getColumnExpr(field);

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
		} else {
			if (op === 'equals') {
				conditions.push(
					`(message = $${idx} OR ip = $${idx} OR service = $${idx} OR COALESCE(user_id, '') = $${idx})`
				);
				values.push(rawQuery);
				idx++;
			} else if (op === 'not_equals') {
				conditions.push(
					`(message != $${idx} AND ip != $${idx} AND service != $${idx} AND COALESCE(user_id, '') != $${idx})`
				);
				values.push(rawQuery);
				idx++;
			} else if (op === 'not_contains') {
				const esc = likeEscape(rawQuery);
				conditions.push(
					`(message NOT ILIKE $${idx} ESCAPE '\\' AND ip NOT ILIKE $${idx} ESCAPE '\\' AND service NOT ILIKE $${idx} ESCAPE '\\' AND COALESCE(user_id, '') NOT ILIKE $${idx} ESCAPE '\\' AND COALESCE(details::text, '') NOT ILIKE $${idx} ESCAPE '\\')`
				);
				values.push(`%${esc}%`);
				idx++;
			} else {
				const tokens = rawQuery.split(/\s+/).filter(Boolean);
				for (const token of tokens) {
					const kqlMatch = token.match(/^(service|level|ip|user|msg):(!?)(.+)$/i);
					if (kqlMatch) {
						const key = kqlMatch[1].toLowerCase();
						const isNeg = kqlMatch[2] === '!';
						const val = kqlMatch[3].trim();
						if (key === 'service') {
							const srv = sanitizeLogText(val, MAX_SERVICE_LEN).toLowerCase();
							conditions.push(isNeg ? `service != $${idx++}` : `service = $${idx++}`);
							values.push(srv);
						} else if (key === 'level') {
							const lvl = sanitizeLogText(val, 16).toUpperCase();
							conditions.push(isNeg ? `level != $${idx++}` : `level = $${idx++}`);
							values.push(lvl);
						} else if (key === 'ip') {
							const cleanIp = sanitizeLogText(val, 45);
							conditions.push(isNeg ? `ip != $${idx++}` : `ip = $${idx++}`);
							values.push(cleanIp);
						} else if (key === 'user') {
							const uId = sanitizeLogText(val, 120);
							conditions.push(isNeg ? `COALESCE(user_id, '') != $${idx++}` : `COALESCE(user_id, '') = $${idx++}`);
							values.push(uId);
						} else if (key === 'msg') {
							const esc = likeEscape(val);
							conditions.push(isNeg ? `message NOT ILIKE $${idx++} ESCAPE '\\'` : `message ILIKE $${idx++} ESCAPE '\\'`);
							values.push(`%${esc}%`);
						}
					} else if ((token.startsWith('-') || token.startsWith('!')) && token.length > 1) {
						const negEsc = likeEscape(token.slice(1));
						conditions.push(
							`(message NOT ILIKE $${idx} ESCAPE '\\' AND ip NOT ILIKE $${idx} ESCAPE '\\' AND service NOT ILIKE $${idx} ESCAPE '\\' AND COALESCE(user_id, '') NOT ILIKE $${idx} ESCAPE '\\' AND COALESCE(details::text, '') NOT ILIKE $${idx} ESCAPE '\\')`
						);
						values.push(`%${negEsc}%`);
						idx++;
					} else {
						const posEsc = likeEscape(token);
						conditions.push(
							`(message ILIKE $${idx} ESCAPE '\\' OR service ILIKE $${idx} ESCAPE '\\' OR ip ILIKE $${idx} ESCAPE '\\' OR COALESCE(user_id, '') ILIKE $${idx} ESCAPE '\\' OR COALESCE(details::text, '') ILIKE $${idx} ESCAPE '\\')`
						);
						values.push(`%${posEsc}%`);
						idx++;
					}
				}
			}
		}
	}

	const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
	const page = Math.max(1, Number(filter.page) || 1);
	const limit = Math.max(1, Math.min(Number(filter.limit) || 100, 5000));
	const offset = (page - 1) * limit;

	// 6. Query Total Count
	const countRes = await p.query(
		`SELECT COUNT(*)::int AS n FROM system_logs ${whereClause}`,
		values
	);
	const totalCount = Number(countRes.rows[0]?.n || 0);
	const totalPages = Math.max(1, Math.ceil(totalCount / limit));

	// 7. Query Histogram Distribution
	let histogram: HistogramBucket[] = [];
	try {
		const histStart = effectiveStart ?? (now - 24 * 60 * 60_000);
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

		const histRes = await p.query(
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
		);

		histogram = histRes.rows.map((r) => {
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
		});
	} catch (histErr) {
		console.error('[getSystemLogsPaginated] Histogram query failed:', histErr);
	}

	// 8. Query Paginated Log Rows
	const paginatedValues = [...values, limit, offset];
	const rowsRes = await p.query(
		`SELECT id, timestamp AS time, level AS level, service AS service, message AS message, details AS detail, user_id AS "userId", ip
		 FROM system_logs
		 ${whereClause}
		 ORDER BY timestamp DESC NULLS LAST, id DESC
		 LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
		paginatedValues
	);

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
		page,
		limit,
		totalPages,
		histogram,
	};
}

export async function getSystemLogs(filter: SystemLogFilter = {}): Promise<SystemLog[]> {
	const res = await getSystemLogsPaginated(filter);
	return res.logs;
}
