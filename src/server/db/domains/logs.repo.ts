import { Client } from 'pg';
import { getPgPool, ensurePostgresInit } from '@/db';
import { temizIp } from '@/lib/audit';

export interface SystemLog {
	id: number;
	zaman: number;
	seviye: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
	servis: string;
	mesaj: string;
	detay: Record<string, unknown> | null;
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

export type FilterColumn = 'all' | 'mesaj' | 'ip' | 'servis' | 'userId' | 'detay';

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
	servis?: string;
	servisOp?: 'eq' | 'neq';
	seviye?: string;
	seviyeOp?: 'eq' | 'neq';
	ip?: string;
	ipOp?: 'eq' | 'neq' | 'contains' | 'not_contains';
	arama?: string;
	aramaOp?: FilterOperator;
	aramaAlani?: FilterColumn;
	timeRange?: TimeRangePreset;
	startTime?: number;
	endTime?: number;
	page?: number;
	limit?: number;
}

const SENSITIVE_LOG_KEY_RE =
	/password|password|secret|pass_?hash|sifre_?hash|totp_?secret|recovery|cookie|authorization|private_?key|plain_?secret/i;

const MAX_MESAJ_LEN = 1000;
const MAX_SERVIS_LEN = 40;
const MAX_DETAY_JSON_LEN = 8192;
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

export function sanitizeLogDetay(
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
			out[cleanKey] = sanitizeLogDetay(rawVal as Record<string, unknown>, depth + 1);
		}
	}
	return Object.keys(out).length > 0 ? out : null;
}

const likeKacis = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const logBakimState = globalThis as { __sistemLogBakimi?: boolean };

const MAX_SYSTEM_LOG_COUNT = 5_000;

function systemLogRetentionDays(): number {
	const n = Number(process.env.SYSTEM_LOG_RETENTION_DAYS);
	return Number.isInteger(n) && n >= 7 && n <= 3650 ? n : DEFAULT_RETENTION_DAYS;
}

export function startSystemLogMaintenance(): void {
	if (logBakimState.__sistemLogBakimi) return;
	logBakimState.__sistemLogBakimi = true;
	const calistir = async () => {
		try {
			const pool = getPgPool();
			const sinir = Date.now() - systemLogRetentionDays() * 24 * 3600 * 1000;
			// 1. Süreye dayalı genel temizlik
			await pool.query('DELETE FROM sistem_loglari WHERE zaman < $1', [sinir]);
			// 2. Maksimum satır kotası (Yalnızca INFO ve WARN temizlenir; CRITICAL alarmlar ve denetim logları korunur)
			await pool.query(
				`DELETE FROM sistem_loglari
				 WHERE seviye NOT IN ('CRITICAL', 'ERROR')
				   AND id NOT IN (
					 SELECT id FROM sistem_loglari
					 WHERE seviye NOT IN ('CRITICAL', 'ERROR')
					 ORDER BY zaman DESC
					 LIMIT $1
				 )`,
				[MAX_SYSTEM_LOG_COUNT]
			);
			// 3. Süresi dolmuş e-posta doğrulama OTP kayıtlarını temizle (Disk bloat önleme)
			await pool.query('DELETE FROM email_verifications WHERE expires_at < $1', [Date.now()]);
			// 4. Süresi dolmuş webauthn meydan okumalarını temizle (>10 dakika eski)
			await pool.query('DELETE FROM webauthn_challenges WHERE olusturma < $1', [Date.now() - 10 * 60_000]);
		} catch (err) {
			console.error('[SystemLog] Temizlik hatası:', err);
		}
	};
	setTimeout(calistir, 15_000).unref?.();
	setInterval(calistir, 60 * 60 * 1000).unref?.();
}

export async function logSystemEvent(params: {
	servis: string;
	seviye?: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
	mesaj: string;
	detay?: Record<string, unknown> | null;
	userId?: string | null;
	ip?: string;
}): Promise<void> {
	try {
		await ensurePostgresInit();
		startSystemLogMaintenance();
		const p = getPgPool();

		let seviye: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' =
			params.seviye === 'CRITICAL' || params.seviye === 'WARN' || params.seviye === 'ERROR'
				? params.seviye
				: 'INFO';
		const servis = sanitizeLogText(params.servis || 'system', MAX_SERVIS_LEN).toLowerCase() || 'system';
		const mesaj = sanitizeLogText(params.mesaj, MAX_MESAJ_LEN);
		if (!mesaj) return;

		const ip = temizIp(params.ip || '');
		// Localhost test isolation: Do not write CRITICAL for localhost traffic in development/test
		const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
		if (seviye === 'CRITICAL' && isLocalhost && process.env.NODE_ENV !== 'production') {
			seviye = 'WARN';
		}

		const safeDetay = sanitizeLogDetay(params.detay);
		let detayJson = safeDetay ? JSON.stringify(safeDetay) : null;
		if (detayJson && detayJson.length > MAX_DETAY_JSON_LEN) {
			detayJson = JSON.stringify({ _truncated: true, preview: detayJson.slice(0, 1024) });
		}

		const userId = params.userId ? sanitizeLogText(params.userId, 120) : null;
		const zaman = Date.now();

		const insertRes = await p.query(
			`INSERT INTO sistem_loglari (zaman, seviye, servis, mesaj, detay, userId, ip)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 RETURNING id`,
			[zaman, seviye, servis, mesaj, detayJson, userId, ip]
		);

		const logId = Number(insertRes.rows[0]?.id ?? zaman);
		const broadcastObj: SystemLog = {
			id: logId,
			zaman,
			seviye,
			servis,
			mesaj,
			detay: safeDetay ?? null,
			userId,
			ip,
		};

		dispatchLog(broadcastObj);

		try {
			const notifyPayload = JSON.stringify({
				id: logId,
				zaman,
				seviye,
				servis,
				mesaj: mesaj.slice(0, 500),
				detay: safeDetay ? (typeof safeDetay === 'object' ? safeDetay : String(safeDetay)) : null,
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

export async function getSystemLogsPaginated(filtre: SystemLogFilter = {}): Promise<SiemLogsResponse> {
	await ensurePostgresInit();
	const p = getPgPool();
	const conditions: string[] = [];
	const values: unknown[] = [];
	let idx = 1;

	// 1. Time range conditions
	const now = Date.now();
	let effectiveStart: number | undefined;
	let effectiveEnd: number | undefined;

	if (filtre.timeRange === '15m') {
		effectiveStart = now - 15 * 60_000;
		effectiveEnd = now;
	} else if (filtre.timeRange === '1h') {
		effectiveStart = now - 60 * 60_000;
		effectiveEnd = now;
	} else if (filtre.timeRange === '6h') {
		effectiveStart = now - 6 * 60 * 60_000;
		effectiveEnd = now;
	} else if (filtre.timeRange === '24h') {
		effectiveStart = now - 24 * 60 * 60_000;
		effectiveEnd = now;
	} else if (filtre.timeRange === '7d') {
		effectiveStart = now - 7 * 24 * 60 * 60_000;
		effectiveEnd = now;
	} else if (filtre.timeRange === 'custom') {
		if (filtre.startTime && Number.isFinite(Number(filtre.startTime))) {
			effectiveStart = Number(filtre.startTime);
		}
		if (filtre.endTime && Number.isFinite(Number(filtre.endTime))) {
			effectiveEnd = Number(filtre.endTime);
		}
	} else {
		// Fallbacks if directly passed
		if (filtre.startTime && Number.isFinite(Number(filtre.startTime))) {
			effectiveStart = Number(filtre.startTime);
		}
		if (filtre.endTime && Number.isFinite(Number(filtre.endTime))) {
			effectiveEnd = Number(filtre.endTime);
		}
	}

	if (effectiveStart !== undefined && Number.isFinite(effectiveStart)) {
		conditions.push(`zaman >= $${idx++}`);
		values.push(effectiveStart);
	}
	if (effectiveEnd !== undefined && Number.isFinite(effectiveEnd)) {
		conditions.push(`zaman <= $${idx++}`);
		values.push(effectiveEnd);
	}

	// 2. Service condition
	if (filtre.servis && filtre.servis !== 'all') {
		const srv = sanitizeLogText(filtre.servis, MAX_SERVIS_LEN).toLowerCase();
		if (filtre.servisOp === 'neq') {
			conditions.push(`servis != $${idx++}`);
		} else {
			conditions.push(`servis = $${idx++}`);
		}
		values.push(srv);
	}

	// 3. Severity condition
	if (filtre.seviye && filtre.seviye !== 'all') {
		const sev = sanitizeLogText(filtre.seviye, 16).toUpperCase();
		if (filtre.seviyeOp === 'neq') {
			conditions.push(`seviye != $${idx++}`);
		} else {
			conditions.push(`seviye = $${idx++}`);
		}
		values.push(sev);
	}

	// 4. IP condition
	if (filtre.ip && filtre.ip.trim()) {
		const cleanIp = sanitizeLogText(filtre.ip.trim(), 45);
		if (cleanIp) {
			if (filtre.ipOp === 'neq') {
				conditions.push(`ip != $${idx++}`);
				values.push(cleanIp);
			} else if (filtre.ipOp === 'not_contains') {
				conditions.push(`ip NOT ILIKE $${idx++} ESCAPE '\\'`);
				values.push(`%${likeKacis(cleanIp)}%`);
			} else if (filtre.ipOp === 'contains') {
				conditions.push(`ip ILIKE $${idx++} ESCAPE '\\'`);
				values.push(`%${likeKacis(cleanIp)}%`);
			} else {
				conditions.push(`ip = $${idx++}`);
				values.push(cleanIp);
			}
		}
	}

	// 5. Search condition
	if (filtre.arama && filtre.arama.trim()) {
		const rawQuery = filtre.arama.trim().slice(0, 160);
		const op = filtre.aramaOp || 'contains';
		const field = filtre.aramaAlani || 'all';

		const getColumnExpr = (f: FilterColumn): string | null => {
			switch (f) {
				case 'mesaj':
					return 'mesaj';
				case 'ip':
					return 'ip';
				case 'servis':
					return 'servis';
				case 'userId':
					return "COALESCE(userId, '')";
				case 'detay':
					return "COALESCE(detay::text, '')";
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
				values.push(`%${likeKacis(rawQuery)}%`);
			} else if (op === 'starts_with') {
				conditions.push(`${colExpr} ILIKE $${idx++} ESCAPE '\\'`);
				values.push(`${likeKacis(rawQuery)}%`);
			} else if (op === 'ends_with') {
				conditions.push(`${colExpr} ILIKE $${idx++} ESCAPE '\\'`);
				values.push(`%${likeKacis(rawQuery)}`);
			} else {
				conditions.push(`${colExpr} ILIKE $${idx++} ESCAPE '\\'`);
				values.push(`%${likeKacis(rawQuery)}%`);
			}
		} else {
			if (op === 'equals') {
				conditions.push(
					`(mesaj = $${idx} OR ip = $${idx} OR servis = $${idx} OR COALESCE(userId, '') = $${idx})`
				);
				values.push(rawQuery);
				idx++;
			} else if (op === 'not_equals') {
				conditions.push(
					`(mesaj != $${idx} AND ip != $${idx} AND servis != $${idx} AND COALESCE(userId, '') != $${idx})`
				);
				values.push(rawQuery);
				idx++;
			} else if (op === 'not_contains') {
				const esc = likeKacis(rawQuery);
				conditions.push(
					`(mesaj NOT ILIKE $${idx} ESCAPE '\\' AND ip NOT ILIKE $${idx} ESCAPE '\\' AND servis NOT ILIKE $${idx} ESCAPE '\\' AND COALESCE(userId, '') NOT ILIKE $${idx} ESCAPE '\\' AND COALESCE(detay::text, '') NOT ILIKE $${idx} ESCAPE '\\')`
				);
				values.push(`%${esc}%`);
				idx++;
			} else {
				const tokens = rawQuery.split(/\s+/).filter(Boolean);
				for (const token of tokens) {
					const kqlMatch = token.match(/^(service|servis|level|seviye|ip|user|kullanici|msg|mesaj):(!?)(.+)$/i);
					if (kqlMatch) {
						const key = kqlMatch[1].toLowerCase();
						const isNeg = kqlMatch[2] === '!';
						const val = kqlMatch[3].trim();
						if (key === 'service' || key === 'servis') {
							const srv = sanitizeLogText(val, MAX_SERVIS_LEN).toLowerCase();
							conditions.push(isNeg ? `servis != $${idx++}` : `servis = $${idx++}`);
							values.push(srv);
						} else if (key === 'level' || key === 'seviye') {
							const lvl = sanitizeLogText(val, 16).toUpperCase();
							conditions.push(isNeg ? `seviye != $${idx++}` : `seviye = $${idx++}`);
							values.push(lvl);
						} else if (key === 'ip') {
							const cleanIp = sanitizeLogText(val, 45);
							conditions.push(isNeg ? `ip != $${idx++}` : `ip = $${idx++}`);
							values.push(cleanIp);
						} else if (key === 'user' || key === 'kullanici') {
							const uId = sanitizeLogText(val, 120);
							conditions.push(isNeg ? `COALESCE(userId, '') != $${idx++}` : `COALESCE(userId, '') = $${idx++}`);
							values.push(uId);
						} else if (key === 'msg' || key === 'mesaj') {
							const esc = likeKacis(val);
							conditions.push(isNeg ? `mesaj NOT ILIKE $${idx++} ESCAPE '\\'` : `mesaj ILIKE $${idx++} ESCAPE '\\'`);
							values.push(`%${esc}%`);
						}
					} else if ((token.startsWith('-') || token.startsWith('!')) && token.length > 1) {
						const negEsc = likeKacis(token.slice(1));
						conditions.push(
							`(mesaj NOT ILIKE $${idx} ESCAPE '\\' AND ip NOT ILIKE $${idx} ESCAPE '\\' AND servis NOT ILIKE $${idx} ESCAPE '\\' AND COALESCE(userId, '') NOT ILIKE $${idx} ESCAPE '\\' AND COALESCE(detay::text, '') NOT ILIKE $${idx} ESCAPE '\\')`
						);
						values.push(`%${negEsc}%`);
						idx++;
					} else {
						const posEsc = likeKacis(token);
						conditions.push(
							`(mesaj ILIKE $${idx} ESCAPE '\\' OR servis ILIKE $${idx} ESCAPE '\\' OR ip ILIKE $${idx} ESCAPE '\\' OR COALESCE(userId, '') ILIKE $${idx} ESCAPE '\\' OR COALESCE(detay::text, '') ILIKE $${idx} ESCAPE '\\')`
						);
						values.push(`%${posEsc}%`);
						idx++;
					}
				}
			}
		}
	}

	const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
	const page = Math.max(1, Number(filtre.page) || 1);
	const limit = Math.max(1, Math.min(Number(filtre.limit) || 100, 5000));
	const offset = (page - 1) * limit;

	// 6. Query Total Count
	const countRes = await p.query(
		`SELECT COUNT(*)::int AS n FROM sistem_loglari ${whereClause}`,
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
				(zaman / ${bucketSize}) * ${bucketSize} AS bucket,
				COUNT(*)::int AS count,
				COUNT(*) FILTER (WHERE seviye = 'CRITICAL')::int AS critical,
				COUNT(*) FILTER (WHERE seviye = 'ERROR')::int AS error,
				COUNT(*) FILTER (WHERE seviye = 'WARN')::int AS warn,
				COUNT(*) FILTER (WHERE seviye = 'INFO')::int AS info
			 FROM sistem_loglari
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
		`SELECT id, zaman, seviye, servis, mesaj, detay, userId, ip
		 FROM sistem_loglari
		 ${whereClause}
		 ORDER BY zaman DESC, id DESC
		 LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
		paginatedValues
	);

	const logs = rowsRes.rows.map((row) => {
		let parsedDetay: Record<string, unknown> | null = null;
		if (row.detay) {
			try {
				parsedDetay = typeof row.detay === 'string' ? JSON.parse(row.detay) : row.detay;
			} catch {
				parsedDetay = null;
			}
		}
		return {
			id: Number(row.id),
			zaman: Number(row.zaman),
			seviye: row.seviye,
			servis: row.servis,
			mesaj: row.mesaj,
			detay: parsedDetay,
			userId: row.userId ?? row.kullaniciid ?? null,
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

export async function getSystemLogs(filtre: SystemLogFilter = {}): Promise<SystemLog[]> {
	const res = await getSystemLogsPaginated(filtre);
	return res.logs;
}
