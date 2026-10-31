import os from 'node:os';
import { ensurePostgresInit, getPgPool } from '@/db';
import type { User } from '@/db/schema';
import { temizIp } from '@/lib/audit';
import { publishEventQuiet } from '@/db/olaylar';
import { closeUserTerminalSessions } from '@/lib/server/terminalManager';
import { getActiveRateLimits, type ActiveRateLimit } from '@/lib/rateLimit';
import { addKernelBlackhole, removeKernelBlackhole } from '@/lib/server/kernelFirewall';
import { isInfrastructureIp } from '@/lib/server/proxyDiagnostics';
import { classifyThreatIntel, type ThreatIntelligence } from '@/lib/server/threatIntelligence';
import { getWebhookConfig, sendSecurityAlert, type WebhookConfig } from '@/lib/server/securityWebhook';
import { logSystemEvent } from './logs.repo';

export interface HostAndPoolTelemetry {
	pgPool: {
		totalCount: number;
		idleCount: number;
		waitingCount: number;
		max: number;
	};
	memory: {
		processRss: number;
		processHeapUsed: number;
		processHeapTotal: number;
		osTotal: number;
		osFree: number;
		osUsed: number;
	};
	cpu: {
		loadAvg: number[];
		uptime: number;
	};
}

export interface SecurityBlock {
	ip: string;
	status: 'ban' | 'whitelist';
	neden: string;
	tehditPuani: number;
	ihlaller: number;
	olusturanId: string | null;
	expiresAt: number | null;
	olusturma: number;
	guncellenme: number;
	threatIntel?: ThreatIntelligence;
}

export type SocIncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type SocIncidentStatus = 'new' | 'triaged' | 'investigating' | 'contained' | 'resolved' | 'false_positive';

export interface SocIncident {
	id: string;
	title: string;
	severity: SocIncidentSeverity;
	status: SocIncidentStatus;
	sourceIp: string | null;
	service: string | null;
	details: Record<string, unknown> | null;
	analystNotes: string | null;
	assignedTo: string | null;
	createdAt: number;
	updatedAt: number;
}

export interface ActiveSessionInfo {
	id: string;
	ad: string;
	soyad: string;
	email: string;
	roleId: string | null;
	rolAd: string;
	admin: boolean;
	status: string;
	totpEnabled: boolean;
	sonGirisTarihi: number | null;
	oturumBitis: number | null;
	sonGirisIp: string | null;
	sonAktifIp: string | null;
	sonAktifTarihi: number | null;
	sonGirisUserAgent: string | null;
	ipDegisti: boolean;
	impossibleTravel?: {
		detected: boolean;
		speedKmh?: number;
		deltaMinutes?: number;
		fromIp?: string;
		toIp?: string;
		reason?: string;
	};
}

export interface TopAttackerItem {
	ip: string;
	eventCount: number;
	tehditPuani: number;
	sonGorulme: number;
	sonMesaj: string;
	status: 'ban' | 'whitelist' | 'izleniyor';
	threatIntel?: ThreatIntelligence;
}

export interface LockdownState {
	active: boolean;
	reason: string;
	updatedAt: number | null;
}

export interface EmergencyKillSwitches {
	disableRegistrations: boolean;
	disableUploads: boolean;
	passkeyOnly: boolean;
}

export interface HourlyAttackPoint {
	hourLabel: string;
	timestamp: number;
	blockedCount: number;
	warningCount: number;
	totalCount: number;
}

export interface SocOverviewData {
	defcon: 1 | 2 | 3 | 4 | 5;
	lockdown: LockdownState;
	emergencySwitches: EmergencyKillSwitches;
	webhookConfig: WebhookConfig;
	metrics: {
		activeBansCount: number;
		whitelistedCount: number;
		securityEvents24h: number;
		authFailures24h: number;
		csrfAndIdor24h: number;
		sessionAnomalies24h: number;
		activeSessionsCount: number;
		activeRateLimits: ActiveRateLimit[];
		activeRateLimitsCount: number;
	};
	hourlyTimeline: Array<{
		hourLabel: string;
		timestamp: number;
		warnCount: number;
		errorCount: number;
	}>;
	hourlyDistribution: HourlyAttackPoint[];
	topAttackers: TopAttackerItem[];
	systemTelemetry: HostAndPoolTelemetry;
	defconResetAt: number;
}

interface ThreatStrikeBucket {
	points: number;
	reasons: string[];
	resetAt: number;
	lastStrikeAt: number;
}

const STRIKE_WINDOW_MS = 15 * 60_000; // 15 minutes
const AUTO_BAN_THRESHOLD = 100;
const MAX_STRIKE_BUCKETS = 10_000;

const strikeBuckets = new Map<string, ThreatStrikeBucket>();

function pruneStrikeBucketsIfNeeded(): void {
	if (strikeBuckets.size < MAX_STRIKE_BUCKETS) return;
	const now = Date.now();
	for (const [k, b] of strikeBuckets.entries()) {
		if (b.resetAt <= now) {
			strikeBuckets.delete(k);
		}
	}
	if (strikeBuckets.size >= MAX_STRIKE_BUCKETS) {
		let evicted = 0;
		for (const k of strikeBuckets.keys()) {
			strikeBuckets.delete(k);
			evicted++;
			if (evicted >= 1000) break;
		}
	}
}

// In-memory cache for IP ban/whitelist table (refreshed every 8s or immediately on mutation)
let firewallCache: Map<string, SecurityBlock> | null = null;
let firewallCacheExpiresAt = 0;

// In-memory cache for Lockdown state
let lockdownCache: LockdownState | null = null;
let lockdownCacheExpiresAt = 0;

// In-memory cache for Emergency Kill Switches
const DEFAULT_KILL_SWITCHES: EmergencyKillSwitches = {
	disableRegistrations: false,
	disableUploads: false,
	passkeyOnly: false,
};
let killSwitchesCache: EmergencyKillSwitches | null = null;
let killSwitchesCacheExpiresAt = 0;

export async function getEmergencyKillSwitches(): Promise<EmergencyKillSwitches> {
	const now = Date.now();
	if (killSwitchesCache && killSwitchesCacheExpiresAt > now) {
		return killSwitchesCache;
	}
	try {
		await ensurePostgresInit();
		const p = getPgPool();
		const res = await p.query(
			`SELECT value AS deger FROM system_settings WHERE key = 'soc_emergency_switches' LIMIT 1`
		);
		if (res.rows.length > 0 && res.rows[0].deger) {
			const parsed = JSON.parse(res.rows[0].deger) as Partial<EmergencyKillSwitches>;
			killSwitchesCache = { ...DEFAULT_KILL_SWITCHES, ...parsed };
		} else {
			killSwitchesCache = { ...DEFAULT_KILL_SWITCHES };
		}
	} catch {
		killSwitchesCache = { ...DEFAULT_KILL_SWITCHES };
	}
	killSwitchesCacheExpiresAt = now + 100;
	return killSwitchesCache;
}

export async function setEmergencyKillSwitch(
	key: keyof EmergencyKillSwitches,
	value: boolean,
	actorId?: string | null
): Promise<EmergencyKillSwitches> {
	await ensurePostgresInit();
	const current = await getEmergencyKillSwitches();
	const updated: EmergencyKillSwitches = { ...current, [key]: value };
	const p = getPgPool();
	await p.query(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ('soc_emergency_switches', $1, $2)
		 ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = $2`,
		[JSON.stringify(updated), Date.now()]
	);
	killSwitchesCache = updated;
	killSwitchesCacheExpiresAt = Date.now() + 100;

	await logSystemEvent({
		servis: 'security',
		seviye: value ? 'WARN' : 'INFO',
		mesaj: `🚨 [EMERGENCY SWITCH] '${key}' anahtarı ${value ? 'DEVREYE ALINDI (AÇIK)' : 'DEVREDEN ÇIKARILDI (KAPALI)'}.`,
		userId: actorId,
		detay: { switch: key, value },
	}).catch(() => {});

	return updated;
}

// Throttle session activity DB updates & anomaly warnings per user
const sessionActivityThrottle = new Map<string, { lastIp: string; updatedAt: number; anomalyLoggedAt: number }>();

function isLocalOrUnknownIp(ip: string): boolean {
	let clean = ip.trim().toLowerCase();
	if (clean.startsWith('::ffff:') && clean.slice(7).includes('.')) {
		clean = clean.slice(7);
	}
	return (
		!clean ||
		clean === 'unknown' ||
		clean === '127.0.0.1' ||
		clean === '::1' ||
		clean === 'localhost' ||
		clean.startsWith('127.') ||
		clean === '0.0.0.0'
	);
}

export function invalidateFirewallCache(): void {
	firewallCache = null;
	firewallCacheExpiresAt = 0;
}

async function loadFirewallMap(): Promise<Map<string, SecurityBlock>> {
	const now = Date.now();
	if (firewallCache && firewallCacheExpiresAt > now) {
		return firewallCache;
	}

	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT ip, status AS status, reason AS neden, threat_score AS "tehditPuani",
		        violations AS ihlaller, creator_id AS "olusturanId", expires_at AS "expiresAt",
		        created_at AS olusturma, updated_at AS guncellenme
		 FROM security_blocks`
	);

	const map = new Map<string, SecurityBlock>();
	for (const r of res.rows) {
		const endTime = r.bitistarihi ?? r.expiresAt;
		const endTimestamp = endTime !== null && endTime !== undefined ? Number(endTime) : null;
		const status = (r.status === 'whitelist' ? 'whitelist' : 'ban') as 'ban' | 'whitelist';
		// Skip expired bans
		if (status === 'ban' && endTimestamp !== null && endTimestamp <= now) {
			continue;
		}
		const ipKey = String(r.ip);
		map.set(ipKey, {
			ip: ipKey,
			status,
			neden: String(r.neden || ''),
			tehditPuani: Number(r.tehditpuani ?? r.tehditPuani ?? 100),
			ihlaller: Number(r.ihlaller ?? 1),
			olusturanId: (r.olusturanid ?? r.olusturanId) ? String(r.olusturanid ?? r.olusturanId) : null,
			expiresAt: endTimestamp,
			olusturma: Number(r.olusturma ?? now),
			guncellenme: Number(r.guncellenme ?? now),
		});
	}

	firewallCache = map;
	firewallCacheExpiresAt = now + 1_000;
	return map;
}

function ipv4ToNumber(rawIp: string): number | null {
	let ip = rawIp.trim().toLowerCase();
	if (ip.startsWith('::ffff:')) {
		ip = ip.slice(7);
	}
	const parts = ip.split('.');
	if (parts.length !== 4) return null;
	let num = 0;
	for (let i = 0; i < 4; i++) {
		const part = Number(parts[i]);
		if (!Number.isInteger(part) || part < 0 || part > 255 || parts[i].trim() === '') {
			return null;
		}
		num = (num << 8) | part;
	}
	return num >>> 0;
}

export function ipv6ToBigInt(rawIp: string): bigint | null {
	let ip = rawIp.trim().toLowerCase();
	if (ip.startsWith('[')) {
		const closeIdx = ip.indexOf(']');
		if (closeIdx !== -1) ip = ip.slice(1, closeIdx);
	}
	const zoneIdx = ip.indexOf('%');
	if (zoneIdx !== -1) ip = ip.slice(0, zoneIdx);

	// Handle IPv4-mapped IPv6 (::ffff:192.0.2.1)
	if (ip.startsWith('::ffff:') && ip.includes('.')) {
		const v4 = ipv4ToNumber(ip.slice(7));
		if (v4 === null) return null;
		return (0xffffn << 32n) | BigInt(v4);
	}

	const doubleColonParts = ip.split('::');
	if (doubleColonParts.length > 2) return null;

	let hextets: string[];
	if (doubleColonParts.length === 2) {
		const left = doubleColonParts[0] ? doubleColonParts[0].split(':') : [];
		const right = doubleColonParts[1] ? doubleColonParts[1].split(':') : [];
		const missing = 8 - (left.length + right.length);
		if (missing < 1) return null;
		hextets = [...left, ...Array(missing).fill('0'), ...right];
	} else {
		hextets = ip.split(':');
		if (hextets.length !== 8) return null;
	}

	let result = 0n;
	for (const h of hextets) {
		if (!/^[0-9a-f]{1,4}$/i.test(h)) return null;
		const val = BigInt(parseInt(h, 16));
		result = (result << 16n) | val;
	}
	return result;
}

export function isIpInCidr(ip: string, cidr: string): boolean {
	if (!ip || !cidr) return false;
	const cleanIp = ip.trim().toLowerCase();
	const cleanCidr = cidr.trim().toLowerCase();

	if (!cleanCidr.includes('/')) {
		const ipNum = ipv4ToNumber(cleanIp);
		const cidrNum = ipv4ToNumber(cleanCidr);
		if (ipNum !== null && cidrNum !== null) {
			return ipNum === cidrNum;
		}
		const ip6 = ipv6ToBigInt(cleanIp);
		const cidr6 = ipv6ToBigInt(cleanCidr);
		if (ip6 !== null && cidr6 !== null) {
			return ip6 === cidr6;
		}
		return cleanIp === cleanCidr;
	}

	const slashParts = cleanCidr.split('/');
	if (slashParts.length !== 2) {
		return false;
	}

	const [rangeIp, prefixStr] = slashParts;
	if (!prefixStr || !/^\d+$/.test(prefixStr.trim())) {
		return false;
	}

	const prefix = parseInt(prefixStr.trim(), 10);
	if (!Number.isInteger(prefix) || prefix < 0) {
		return false;
	}

	// Try IPv4 first
	const ip4Num = ipv4ToNumber(cleanIp);
	const range4Num = ipv4ToNumber(rangeIp);
	if (ip4Num !== null && range4Num !== null) {
		if (prefix > 32) return false;
		if (prefix === 0) return true;
		const mask = (0xffffffff << (32 - prefix)) >>> 0;
		return ((ip4Num & mask) >>> 0) === ((range4Num & mask) >>> 0);
	}

	// Try IPv6
	const ip6Big = ipv6ToBigInt(cleanIp);
	const range6Big = ipv6ToBigInt(rangeIp);
	if (ip6Big !== null && range6Big !== null) {
		if (prefix > 128) return false;
		if (prefix === 0) return true;
		const totalBits = 128n;
		const prefixBig = BigInt(prefix);
		const mask = ((1n << totalBits) - 1n) ^ ((1n << (totalBits - prefixBig)) - 1n);
		return (ip6Big & mask) === (range6Big & mask);
	}

	return false;
}

export async function isIpBanned(ip: string): Promise<{
	banned: boolean;
	whitelisted: boolean;
	reason?: string;
	expiresAt?: number | null;
}> {
	const clean = temizIp(ip);
	if (isLocalOrUnknownIp(clean)) {
		return { banned: false, whitelisted: true };
	}

	try {
		const map = await loadFirewallMap();
		const entry = map.get(clean);
		if (entry) {
			if (entry.status === 'whitelist') {
				return { banned: false, whitelisted: true, reason: entry.neden };
			}
			if (entry.expiresAt === null || entry.expiresAt > Date.now()) {
				return {
					banned: true,
					whitelisted: false,
					reason: entry.neden,
					expiresAt: entry.expiresAt,
				};
			}
		}

		// Check CIDR / Subnet entries if any
		let bannedCidrMatch: SecurityBlock | null = null;
		for (const fwEntry of map.values()) {
			if (fwEntry.ip.includes('/') && isIpInCidr(clean, fwEntry.ip)) {
				if (fwEntry.status === 'whitelist') {
					return { banned: false, whitelisted: true, reason: fwEntry.neden };
				}
				if ((fwEntry.expiresAt === null || fwEntry.expiresAt > Date.now()) && !bannedCidrMatch) {
					bannedCidrMatch = fwEntry;
				}
			}
		}

		if (bannedCidrMatch) {
			return {
				banned: true,
				whitelisted: false,
				reason: bannedCidrMatch.neden,
				expiresAt: bannedCidrMatch.expiresAt,
			};
		}

		return { banned: false, whitelisted: false };
	} catch {
		return { banned: false, whitelisted: false };
	}
}

export function getLiveThreatScore(ip: string): number {
	const clean = temizIp(ip);
	const bucket = strikeBuckets.get(clean);
	if (!bucket || bucket.resetAt <= Date.now()) return 0;
	return bucket.points;
}

export async function banIp(params: {
	ip: string;
	neden: string;
	durationMs?: number | null;
	tehditPuani?: number;
	olusturanId?: string | null;
}): Promise<void> {
	const clean = temizIp(params.ip);
	if (!clean || clean === 'unknown') return;

	await ensurePostgresInit();
	const now = Date.now();
	const expiresAt =
		params.durationMs && params.durationMs > 0 ? now + params.durationMs : null;
	const puan = Math.max(100, Math.round(params.tehditPuani ?? 100));
	const neden = String(params.neden || 'Güvenlik ihlali').slice(0, 300);

	await getPgPool().query(
		`INSERT INTO security_blocks (ip, status, reason, threat_score, violations, creator_id, expires_at, created_at, updated_at)
		 VALUES ($1, 'ban', $2, $3, 1, $4, $5, $6, $6)
		 ON CONFLICT (ip) DO UPDATE SET
		     status = 'ban',
		     reason = EXCLUDED.reason,
		     threat_score = GREATEST(security_blocks.threat_score, EXCLUDED.threat_score),
		     violations = security_blocks.violations + 1,
		     creator_id = COALESCE(EXCLUDED.creator_id, security_blocks.creator_id),
		     expires_at = EXCLUDED.expires_at,
		     updated_at = EXCLUDED.updated_at`,
		[clean, neden, puan, params.olusturanId ?? null, expiresAt, now]
	);

	strikeBuckets.delete(clean);
	invalidateFirewallCache();
	// Sync with Linux kernel blackhole routing table (graceful fallback if non-root)
	await addKernelBlackhole(clean).catch(() => {});
}

export async function unbanIp(ip: string): Promise<void> {
	const clean = temizIp(ip);
	if (!clean) return;
	await ensurePostgresInit();
	await getPgPool().query(`DELETE FROM security_blocks WHERE ip = $1`, [clean]);
	strikeBuckets.delete(clean);
	invalidateFirewallCache();
	// Remove from Linux kernel blackhole routing table (graceful fallback if non-root)
	await removeKernelBlackhole(clean).catch(() => {});
}

export async function whitelistIp(params: {
	ip: string;
	neden?: string;
	olusturanId?: string | null;
}): Promise<void> {
	const clean = temizIp(params.ip);
	if (!clean || clean === 'unknown') return;

	await ensurePostgresInit();
	const now = Date.now();
	const neden = String(params.neden || 'Güvenilir IP (Whitelist)').slice(0, 300);

	await getPgPool().query(
		`INSERT INTO security_blocks (ip, status, reason, threat_score, violations, creator_id, expires_at, created_at, updated_at)
		 VALUES ($1, 'whitelist', $2, 0, 0, $3, NULL, $4, $4)
		 ON CONFLICT (ip) DO UPDATE SET
		     status = 'whitelist',
		     reason = EXCLUDED.reason,
		     threat_score = 0,
		     expires_at = NULL,
		     creator_id = COALESCE(EXCLUDED.creator_id, security_blocks.creator_id),
		     updated_at = EXCLUDED.updated_at`,
		[clean, neden, params.olusturanId ?? null, now]
	);

	strikeBuckets.delete(clean);
	invalidateFirewallCache();
}

export async function getSecurityBlocks(): Promise<SecurityBlock[]> {
	await ensurePostgresInit();
	const now = Date.now();
	const res = await getPgPool().query(
		`SELECT ip, status AS status, reason AS neden, threat_score AS "tehditPuani",
		        violations AS ihlaller, creator_id AS "olusturanId", expires_at AS "expiresAt",
		        created_at AS olusturma, updated_at AS guncellenme
		 FROM security_blocks
		 WHERE status = 'whitelist' OR expires_at IS NULL OR expires_at > $1
		 ORDER BY updated_at DESC`,
		[now]
	);
	return res.rows.map((r) => {
		const endTime = r.bitistarihi ?? r.expiresAt;
		const ip = String(r.ip);
		return {
			ip,
			status: (r.status === 'whitelist' ? 'whitelist' : 'ban') as 'ban' | 'whitelist',
			neden: String(r.neden || ''),
			tehditPuani: Number(r.tehditpuani ?? r.tehditPuani ?? 100),
			ihlaller: Number(r.ihlaller ?? 1),
			olusturanId: (r.olusturanid ?? r.olusturanId) ? String(r.olusturanid ?? r.olusturanId) : null,
			expiresAt: endTime !== null && endTime !== undefined ? Number(endTime) : null,
			olusturma: Number(r.olusturma ?? now),
			guncellenme: Number(r.guncellenme ?? now),
			threatIntel: classifyThreatIntel(ip),
		};
	});
}

/**
 * Records a threat strike against an IP address. When the cumulative threat score
 * reaches 100 within the 15-minute window, the IP is automatically quarantined
 * in `guvenlik_engelleri` with progressive ban duration (15m -> 2h -> 24h).
 */
export async function recordSecurityStrike(params: {
	ip: string;
	points: number;
	reason: string;
	path?: string;
	userId?: string | null;
}): Promise<{ autoBanned: boolean; totalPoints: number }> {
	const clean = temizIp(params.ip);
	if (isLocalOrUnknownIp(clean) || isInfrastructureIp(clean)) {
		return { autoBanned: false, totalPoints: 0 };
	}

	const status = await isIpBanned(clean);
	if (status.whitelisted || status.banned) {
		return { autoBanned: status.banned, totalPoints: status.banned ? 100 : 0 };
	}

	pruneStrikeBucketsIfNeeded();

	const lockdown = await getLockdownState();
	const effectivePoints = Math.max(1, Math.round(params.points * (lockdown.active ? 2 : 1)));

	const now = Date.now();
	let bucket = strikeBuckets.get(clean);
	if (!bucket || bucket.resetAt <= now) {
		bucket = {
			points: effectivePoints,
			reasons: [params.reason],
			resetAt: now + STRIKE_WINDOW_MS,
			lastStrikeAt: now,
		};
		strikeBuckets.set(clean, bucket);
	} else {
		bucket.points += effectivePoints;
		if (!bucket.reasons.includes(params.reason) && bucket.reasons.length < 5) {
			bucket.reasons.push(params.reason);
		}
		bucket.lastStrikeAt = now;
	}

	if (bucket.points >= AUTO_BAN_THRESHOLD) {
		// Determine progressive ban duration based on prior history
		let priorViolations = 0;
		try {
			await ensurePostgresInit();
			const prev = await getPgPool().query(
				`SELECT violations FROM security_blocks WHERE ip = $1`,
				[clean]
			);
			priorViolations = Number(prev.rows[0]?.violations ?? 0);
		} catch {
			// ignore
		}

		const durationMs =
			priorViolations >= 2
				? 24 * 60 * 60_000 // 24 hours
				: priorViolations === 1
					? 2 * 60 * 60_000 // 2 hours
					: 15 * 60_000; // 15 minutes

		const combinedReason = `[IPS Auto-Quarantine] ${bucket.reasons.join(' + ')}`.slice(0, 280);
		await banIp({
			ip: clean,
			neden: combinedReason,
			durationMs,
			tehditPuani: bucket.points,
		});

		void createSocIncident({
			title: `IPS Auto-Quarantine: ${clean}`,
			severity: bucket.points >= 100 ? 'CRITICAL' : 'HIGH',
			sourceIp: clean,
			service: 'ips',
			details: {
				reasons: bucket.reasons,
				points: bucket.points,
				path: params.path,
			},
			analystNotes: `IPS Auto-Quarantine triggered due to strike score of ${bucket.points}. Violations: ${bucket.reasons.join(', ')}.`,
		}).catch(() => {});

		void logSystemEvent({
			servis: 'security',
			seviye: 'ERROR',
			mesaj: `[IPS AUTO-BAN] Hostile IP auto-quarantined: ${clean} (Threat Score: ${bucket.points})`,
			detay: {
				ip: clean,
				tehditPuani: bucket.points,
				nedenler: bucket.reasons,
				sureDakika: Math.round(durationMs / 60_000),
				hedefYol: params.path,
			},
			userId: params.userId ?? null,
			ip: clean,
		});

		void sendSecurityAlert({
			type: 'IP_AUTOBANNED',
			title: '🛡️ Otomatik IP Karantinası (IPS Auto-Ban)',
			description: `Saldırgan IP ${clean} eşik puanını aşarak (${bucket.points} puan) karantinaya alındı.\nNeden: ${combinedReason}`,
			severity: 'CRITICAL',
			ip: clean,
			details: {
				tehditPuani: bucket.points,
				sure: `${Math.round(durationMs / 60_000)} dakika`,
				hedefYol: params.path || '-',
			},
		});

		return { autoBanned: true, totalPoints: bucket.points };
	}

	return { autoBanned: false, totalPoints: bucket.points };
}

export async function getLockdownState(): Promise<LockdownState> {
	const now = Date.now();
	if (lockdownCache && lockdownCacheExpiresAt > now) {
		return lockdownCache;
	}

	try {
		await ensurePostgresInit();
		const res = await getPgPool().query(
			`SELECT key, value, updated_at FROM system_settings WHERE key IN ('soc_lockdown_mode', 'soc_lockdown_reason')`
		);
		let active = false;
		let reason = 'Aktif siber saldırı önlemi (Defcon Lockdown)';
		let updatedAt: number | null = null;
		for (const row of res.rows) {
			if (row.key === 'soc_lockdown_mode') {
				active = row.value === '1' || row.value === 'true';
				updatedAt = row.updated_at ? Number(row.updated_at) : null;
			} else if (row.key === 'soc_lockdown_reason' && row.value) {
				reason = String(row.value);
			}
		}
		lockdownCache = { active, reason, updatedAt };
		lockdownCacheExpiresAt = now + 5_000;
		return lockdownCache;
	} catch {
		return { active: false, reason: '', updatedAt: null };
	}
}

export async function setLockdownState(params: {
	active: boolean;
	reason?: string;
	actorId: string;
	ip: string;
}): Promise<LockdownState> {
	await ensurePostgresInit();
	const now = Date.now();
	const reason = String(params.reason || 'Yönetici tarafından Defcon Lockdown etkinleştirildi').slice(0, 240);
	const pool = getPgPool();

	await pool.query(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ('soc_lockdown_mode', $1, $2)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
		[params.active ? '1' : '0', now]
	);
	await pool.query(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ('soc_lockdown_reason', $1, $2)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
		[reason, now]
	);

	lockdownCache = { active: params.active, reason, updatedAt: now };
	lockdownCacheExpiresAt = now + 5_000;

	if (params.active) {
		await revokeAllNonAdminSessions({
			actorId: params.actorId,
			ip: params.ip,
		});
	}

	await logSystemEvent({
		servis: 'security',
		seviye: params.active ? 'ERROR' : 'WARN',
		mesaj: params.active
			? `🚨 [DEFCON LOCKDOWN] Saldırı Altındayız Kalkanı ETKİNLEŞTİRİLDİ: ${reason}`
			: `🛡️ [DEFCON LOCKDOWN] Saldırı Altındayız Kalkanı devre dışı bırakıldı`,
		detay: { active: params.active, reason },
		userId: params.actorId,
		ip: params.ip,
	});

	void sendSecurityAlert({
		type: params.active ? 'LOCKDOWN_DEFCON1' : 'SECURITY_ALERT',
		title: params.active ? '🚨 DEFCON 1 - Saldırı Altındayız Kalkanı Devrede!' : '🛡️ DEFCON Kalkanı Devre Dışı',
		description: params.active
			? `Sistem tam karantina moduna alındı.\nNeden: ${reason}`
			: 'Karantina modu kaldırıldı, sistem normal çalışma düzenine döndü.',
		severity: params.active ? 'CRITICAL' : 'INFO',
		ip: params.ip,
		details: { actorId: params.actorId, reason },
	});

	return lockdownCache;
}

function isSameSubnet(ipA: string, ipB: string): boolean {
	if (ipA === ipB) return true;
	const isLoopbackA = ipA === '127.0.0.1' || ipA === '::1' || ipA === '::ffff:127.0.0.1';
	const isLoopbackB = ipB === '127.0.0.1' || ipB === '::1' || ipB === '::ffff:127.0.0.1';
	if (isLoopbackA && isLoopbackB) return true;

	if (ipA.includes('.') && ipB.includes('.')) {
		const partsA = ipA.split('.');
		const partsB = ipB.split('.');
		if (partsA.length === 4 && partsB.length === 4) {
			return partsA[0] === partsB[0] && partsA[1] === partsB[1] && partsA[2] === partsB[2];
		}
	}
	if (ipA.includes(':') && ipB.includes(':')) {
		const pA = ipA.split(':');
		const pB = ipB.split(':');
		return pA.slice(0, 3).join(':') === pB.slice(0, 3).join(':');
	}
	return false;
}

/**
 * Tracks active session IP & User-Agent and emits a security anomaly log if
 * the session IP changes mid-session (potential Session Hijacking indicator).
 */
export function recordSessionActivity(
	user: User,
	currentIp: string
): { suspiciousJump: boolean } {
	const cleanIp = temizIp(currentIp);
	if (!cleanIp || cleanIp === 'unknown') return { suspiciousJump: false };

	const now = Date.now();
	const prev = sessionActivityThrottle.get(user.id);

	// Check if login IP differs from current request IP
	const loginIp = user.sonGirisIp ? temizIp(user.sonGirisIp) : (prev?.lastIp ?? null);
	if (loginIp && loginIp !== 'unknown' && loginIp !== cleanIp) {
		const isSubnetMatch = isSameSubnet(loginIp, cleanIp);
		const lastAnomaly = prev?.anomalyLoggedAt ?? 0;
		if (now - lastAnomaly > 5 * 60_000) {
			sessionActivityThrottle.set(user.id, {
				lastIp: cleanIp,
				updatedAt: now,
				anomalyLoggedAt: now,
			});
			void logSystemEvent({
				servis: 'security',
				seviye: 'WARN',
				mesaj: `Oturum IP değişimi (Session Hijack şüphesi): ${user.email} (${loginIp} -> ${cleanIp})`,
				detay: {
					email: user.email,
					girisIp: loginIp,
					yeniIp: cleanIp,
					girisCihazi: user.sonGirisUserAgent ?? null,
					subnetFarkli: !isSubnetMatch,
				},
				userId: user.id,
				ip: cleanIp,
			});
			void getPgPool()
				.query(`UPDATE users SET last_active_ip = $1, last_active_at = $2 WHERE id = $3`, [
					cleanIp,
					now,
					user.id,
				])
				.catch(() => {});
		}

		// If jumping across completely different /24 subnets, flag as suspicious jump
		if (!isSubnetMatch) {
			return { suspiciousJump: true };
		}
	}

	// Update last active IP/timestamp at most once every 60 seconds per user
	if (!prev || prev.lastIp !== cleanIp || now - prev.updatedAt > 60_000) {
		sessionActivityThrottle.set(user.id, {
			lastIp: cleanIp,
			updatedAt: now,
			anomalyLoggedAt: prev?.anomalyLoggedAt ?? 0,
		});
		void getPgPool()
			.query(
				`UPDATE users
				 SET last_active_ip = $1,
				     last_active_at = $2,
				     last_login_ip = COALESCE(last_login_ip, $1)
				 WHERE id = $3`,
				[cleanIp, now, user.id]
			)
			.catch(() => {});
	}

	return { suspiciousJump: false };
}

export async function getActiveSessions(): Promise<ActiveSessionInfo[]> {
	await ensurePostgresInit();
	const now = Date.now();
	const res = await getPgPool().query(
		`SELECT u.id, u.first_name AS ad, u.last_name AS soyad, u.email AS email, u.role_id AS "roleId", u.status AS status, u.totp_enabled AS "totpEnabled",
		        u.last_login_at AS "sonGirisTarihi", u.session_expires_at AS "oturumBitis", u.last_login_ip AS "sonGirisIp", u.last_active_ip AS "sonAktifIp", u.last_active_at AS "sonAktifTarihi", u.last_login_user_agent AS "sonGirisUserAgent",
		        r.ad AS "rolAd", r.sistem AS "rolSistem"
		 FROM users u
		 LEFT JOIN roles r ON r.id = u.role_id
		 WHERE u.session_token IS NOT NULL
		   AND (u.session_expires_at IS NULL OR u.session_expires_at > $1)
		 ORDER BY COALESCE(u.last_active_at, u.last_login_at, 0) DESC`,
		[now]
	);

	return res.rows.map((r) => {
		const girisIp = (r.songirisip ?? r.sonGirisIp) ? String(r.songirisip ?? r.sonGirisIp) : null;
		const aktifIp = (r.sonaktifip ?? r.sonAktifIp) ? String(r.sonaktifip ?? r.sonAktifIp) : girisIp;
		const roleId = (r.rolid ?? r.roleId) ? String(r.rolid ?? r.roleId) : null;
		const ipDegisti = Boolean(girisIp && aktifIp && girisIp !== aktifIp);
		let impossibleTravel: ActiveSessionInfo['impossibleTravel'] = undefined;

		if (ipDegisti && girisIp && aktifIp) {
			const girisTime = r.songiristarihi || r.sonGirisTarihi ? Number(r.songiristarihi ?? r.sonGirisTarihi) : now;
			const aktifTime = r.sonaktiftarihi || r.sonAktifTarihi ? Number(r.sonaktiftarihi ?? r.sonAktifTarihi) : now;
			const deltaMs = Math.abs(aktifTime - girisTime);
			const deltaMinutes = Math.max(1, Math.round(deltaMs / 60_000));

			const intelGiris = classifyThreatIntel(girisIp);
			const intelAktif = classifyThreatIntel(aktifIp);

			const p1 = girisIp.split('.').slice(0, 2).join('.');
			const p2 = aktifIp.split('.').slice(0, 2).join('.');
			const isDiffSubnet = p1 !== p2;

			if (isDiffSubnet && deltaMinutes < 45) {
				const estDistKm = intelGiris.provider !== intelAktif.provider ? 1500 : 800;
				const speedKmh = Math.round(estDistKm / (deltaMinutes / 60));
				if (speedKmh > 800) {
					impossibleTravel = {
						detected: true,
						speedKmh,
						deltaMinutes,
						fromIp: girisIp,
						toIp: aktifIp,
						reason: `${deltaMinutes}m delta between distinct prefixes (${intelGiris.provider} ➔ ${intelAktif.provider}), calculated velocity ~${speedKmh} km/h`,
					};
				}
			}
		}

		return {
			id: String(r.id),
			ad: String(r.ad),
			soyad: String(r.soyad),
			email: String(r.email),
			roleId,
			rolAd: r.rolAd ? String(r.rolAd) : 'Member',
			admin: roleId === 'rol_admin',
			status: String(r.status || 'aktif'),
			totpEnabled: Number(r.totpenabled ?? r.totpEnabled ?? 0) === 1,
			sonGirisTarihi: r.songiristarihi || r.sonGirisTarihi ? Number(r.songiristarihi ?? r.sonGirisTarihi) : null,
			oturumBitis: r.oturumbitis || r.oturumBitis ? Number(r.oturumbitis ?? r.oturumBitis) : null,
			sonGirisIp: girisIp,
			sonAktifIp: aktifIp,
			sonAktifTarihi: r.sonaktiftarihi || r.sonAktifTarihi ? Number(r.sonaktiftarihi ?? r.sonAktifTarihi) : null,
			sonGirisUserAgent: (r.songirisuseragent ?? r.sonGirisUserAgent)
				? String(r.songirisuseragent ?? r.sonGirisUserAgent)
				: null,
			ipDegisti,
			impossibleTravel,
		};
	});
}

export async function revokeUserSession(params: {
	targetUserId: string;
	actorId: string;
	ip: string;
}): Promise<boolean> {
	if (params.targetUserId === params.actorId) return false;
	await ensurePostgresInit();
	const pool = getPgPool();
	const res = await pool.query(
		`UPDATE users
		 SET session_token = NULL, session_expires_at = NULL
		 WHERE id = $1
		 RETURNING email AS email, first_name AS ad, last_name AS soyad`,
		[params.targetUserId]
	);
	if ((res.rowCount ?? 0) === 0) return false;
	const u = res.rows[0];
	closeUserTerminalSessions(params.targetUserId);
	await publishEventQuiet(pool, { k: 'oturum', userId: params.targetUserId });
	await logSystemEvent({
		servis: 'security',
		seviye: 'WARN',
		mesaj: `SoC tarafından kullanıcı oturumu zorla sonlandırıldı: ${u.email}`,
		detay: { hedefKullaniciId: params.targetUserId, email: u.email },
		userId: params.actorId,
		ip: params.ip,
	});
	return true;
}

export async function revokeAllNonAdminSessions(params: {
	actorId: string;
	ip: string;
}): Promise<number> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const res = await pool.query(
		`UPDATE users
		 SET session_token = NULL, session_expires_at = NULL
		 WHERE session_token IS NOT NULL AND id <> $1
		 RETURNING id`,
		[params.actorId]
	);
	for (const row of res.rows) {
		const uid = String(row.id);
		closeUserTerminalSessions(uid);
		await publishEventQuiet(pool, { k: 'oturum', userId: uid });
	}
	const count = res.rowCount ?? 0;
	await logSystemEvent({
		servis: 'security',
		seviye: 'ERROR',
		mesaj: `🚨 SoC Acil Durum Kill-Switch: ${count} aktif kullanıcı oturumu sıfırlandı`,
		detay: { dusurulenOturumSayisi: count },
		userId: params.actorId,
		ip: params.ip,
	});
	return count;
}

export async function revokeAnomalousSessions(
	paramsOrActorId: { actorId: string; ip: string } | string,
	optionalIp?: string
): Promise<number> {
	const actorId = typeof paramsOrActorId === 'object' ? paramsOrActorId.actorId : paramsOrActorId;
	const ip = typeof paramsOrActorId === 'object' ? paramsOrActorId.ip : (optionalIp || '');

	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();

	const res = await pool.query(
		`UPDATE users
		 SET session_token = NULL, session_expires_at = NULL
		 WHERE session_token IS NOT NULL
		   AND (session_expires_at IS NULL OR session_expires_at > $1)
		   AND id <> $2
		   AND last_login_ip IS NOT NULL
		   AND last_active_ip IS NOT NULL
		   AND last_login_ip <> last_active_ip
		 RETURNING id`,
		[now, actorId]
	);

	for (const row of res.rows) {
		const uid = String(row.id);
		closeUserTerminalSessions(uid);
		await publishEventQuiet(pool, { k: 'oturum', userId: uid });
	}

	const count = res.rowCount ?? 0;
	await logSystemEvent({
		servis: 'security',
		seviye: 'WARN',
		mesaj: `🚨 SoC Toplu Oturum Feshi: IP anomalisi tespit edilen ${count} oturum sonlandırıldı`,
		detay: { dusurulenOturumSayisi: count },
		userId: actorId,
		ip,
	});

	return count;
}

export async function suspendUserAccount(params: {
	targetUserId: string;
	actorId: string;
	ip: string;
}): Promise<{ ok: boolean; error?: string }> {
	if (params.targetUserId === params.actorId) {
		return { ok: false, error: 'Kendi yönetici hesabınızı askıya alamazsınız.' };
	}
	await ensurePostgresInit();
	const pool = getPgPool();
	const check = await pool.query(`SELECT id, email AS email, role_id AS "roleId" FROM users WHERE id = $1`, [
		params.targetUserId,
	]);
	if ((check.rowCount ?? 0) === 0) {
		return { ok: false, error: 'Kullanıcı bulunamadı.' };
	}
	const target = check.rows[0];
	if ((target.rolid ?? target.roleId) === 'rol_admin') {
		return { ok: false, error: 'Tam yetkili yönetici hesabı askıya alınamaz.' };
	}

	await pool.query(
		`UPDATE users
		 SET status = 'beklemede', session_token = NULL, session_expires_at = NULL
		 WHERE id = $1`,
		[params.targetUserId]
	);
	closeUserTerminalSessions(params.targetUserId);
	await publishEventQuiet(pool, { k: 'oturum', userId: params.targetUserId });

	await logSystemEvent({
		servis: 'security',
		seviye: 'ERROR',
		mesaj: `SoC tarafından şüpheli kullanıcı hesabı askıya alındı ve oturumu kapatıldı: ${target.email}`,
		detay: { hedefKullaniciId: params.targetUserId, email: target.email },
		userId: params.actorId,
		ip: params.ip,
	});

	return { ok: true };
}

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
				(zaman / 3600000) * 3600000 AS "hourBucket",
				COUNT(*) FILTER (WHERE seviye IN ('ERROR', 'CRITICAL'))::int AS "blockedCount",
				COUNT(*) FILTER (WHERE seviye = 'WARN')::int AS "warningCount",
				COUNT(*)::int AS "totalCount"
			 FROM system_logs
			 WHERE zaman >= $1 AND servis IN ('security', 'auth') AND seviye IN ('WARN', 'ERROR', 'CRITICAL')
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

export async function getDefconResetAt(): Promise<number> {
	try {
		await ensurePostgresInit();
		const p = getPgPool();
		const res = await p.query(
			`SELECT value AS deger FROM system_settings WHERE key = 'soc_defcon_reset_at' LIMIT 1`
		);
		if (res.rows.length > 0 && res.rows[0].deger) {
			const n = Number(res.rows[0].deger);
			if (Number.isFinite(n)) return n;
		}
	} catch {
		// ignore
	}
	return 0;
}

export async function resetDefconBaseline(params: { actorId?: string | null; actorIp?: string }): Promise<{ ok: boolean; resetAt: number }> {
	await ensurePostgresInit();
	const p = getPgPool();
	const now = Date.now();
	await p.query(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ('soc_defcon_reset_at', $1, $2)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
		[String(now), now]
	);
	await logSystemEvent({
		servis: 'security',
		seviye: 'INFO',
		mesaj: '🛡️ [DEFCON RESET] Güvenlik alarmları yönetici tarafından teyit edildi ve DEFCON temel metriği sıfırlandı.',
		detay: { actorId: params.actorId || null, resetAt: now },
		userId: params.actorId || null,
		ip: params.actorIp || '127.0.0.1',
	});
	return { ok: true, resetAt: now };
}

export async function getSocOverview(): Promise<SocOverviewData> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();
	const since24h = now - 24 * 60 * 60_000;
	const since12h = now - 12 * 60 * 60_000;
	const defconResetAt = await getDefconResetAt();
	const effectiveSince = Math.max(since24h, defconResetAt);

	const [
		lockdown,
		engeller,
		statsRes,
		attackersRes,
		hourlyRes,
		sessionsRes,
		emergencySwitches,
		webhookConfig,
		hourlyDistribution,
	] = await Promise.all([
		getLockdownState(),
		getSecurityBlocks(),
		pool.query(
			`SELECT
				COUNT(*) FILTER (WHERE servis = 'security' AND seviye IN ('WARN', 'ERROR', 'CRITICAL'))::int AS "secEvents",
				COUNT(*) FILTER (WHERE servis = 'auth' AND seviye IN ('WARN', 'ERROR', 'CRITICAL'))::int AS "authFailures",
				COUNT(*) FILTER (WHERE servis = 'security' AND (mesaj ILIKE '%CSRF%' OR mesaj ILIKE '%IDOR%' OR mesaj ILIKE '%Yetkisiz%' OR mesaj ILIKE '%Unauthorized%' OR mesaj ILIKE '%WAF%' OR mesaj ILIKE '%Honeypot%' OR mesaj ILIKE '%FIM%'))::int AS "csrfIdor",
				COUNT(*) FILTER (WHERE servis = 'security' AND (mesaj ILIKE '%Oturum IP%' OR mesaj ILIKE '%Session IP%'))::int AS "sessionAnomalies",
				COUNT(*) FILTER (WHERE seviye = 'CRITICAL')::int AS "criticalEvents"
			 FROM system_logs
			 WHERE zaman >= $1
			   AND ip NOT IN ('127.0.0.1', '::1', 'localhost', 'unknown')`,
			[effectiveSince]
		),
		pool.query(
			`SELECT
				ip,
				COUNT(*)::int AS "eventCount",
				MAX(zaman) AS "sonGorulme",
				(ARRAY_AGG(mesaj ORDER BY zaman DESC))[1] AS "sonMesaj"
			 FROM system_logs
			 WHERE zaman >= $1
			   AND seviye IN ('WARN', 'ERROR', 'CRITICAL')
			   AND ip IS NOT NULL
			   AND ip <> ''
			   AND ip <> 'unknown'
			 GROUP BY ip
			 ORDER BY COUNT(*) DESC, MAX(zaman) DESC
			 LIMIT 12`,
			[since24h]
		),
		pool.query(
			`SELECT
				(zaman / 3600000) * 3600000 AS "hourBucket",
				COUNT(*) FILTER (WHERE seviye = 'WARN')::int AS "warnCount",
				COUNT(*) FILTER (WHERE seviye IN ('ERROR', 'CRITICAL'))::int AS "errorCount"
			 FROM system_logs
			 WHERE zaman >= $1 AND seviye IN ('WARN', 'ERROR', 'CRITICAL')
			 GROUP BY 1
			 ORDER BY 1 ASC`,
			[since12h]
		),
		pool.query(
			`SELECT COUNT(*)::int AS n FROM users WHERE session_token IS NOT NULL AND (session_expires_at IS NULL OR session_expires_at > $1)`,
			[now]
		),
		getEmergencyKillSwitches(),
		getWebhookConfig(),
		getHourlyStrikeDistribution(),
	]);

	const activeBansCount = engeller.filter((e) => e.status === 'ban').length;
	const whitelistedCount = engeller.filter((e) => e.status === 'whitelist').length;

	// Active unacknowledged bans created after DEFCON reset baseline (excluding localhost in tests)
	const newActiveBansCount = engeller.filter(
		(e) =>
			e.status === 'ban' &&
			(!defconResetAt || e.olusturma >= defconResetAt) &&
			e.ip !== '127.0.0.1' &&
			e.ip !== '::1' &&
			e.ip !== 'localhost'
	).length;

	const st = statsRes.rows[0] || {};
	const securityEvents24h = Number(st.secEvents ?? 0);
	const authFailures24h = Number(st.authFailures ?? 0);
	const csrfAndIdor24h = Number(st.csrfIdor ?? 0);
	const sessionAnomalies24h = Number(st.sessionAnomalies ?? 0);
	const criticalEvents24h = Number(st.criticalEvents ?? 0);
	const activeSessionsCount = Number(sessionsRes.rows[0]?.n ?? 0);

	const blockMap = new Map(engeller.map((e) => [e.ip, e]));

	const topAttackers: TopAttackerItem[] = attackersRes.rows.map((r) => {
		const ip = String(r.ip);
		const block = blockMap.get(ip);
		const liveScore = getLiveThreatScore(ip);
		const eventCount = Number(r.eventCount ?? 1);
		const computedScore = block
			? block.tehditPuani
			: Math.min(99, Math.max(liveScore, eventCount * 15));
		return {
			ip,
			eventCount,
			tehditPuani: computedScore,
			sonGorulme: Number(r.sonGorulme ?? now),
			sonMesaj: String(r.sonMesaj ?? ''),
			status: block ? block.status : 'izleniyor',
			threatIntel: classifyThreatIntel(ip),
		};
	});

	// Build 12-hour timeline
	const currentHourBucket = Math.floor(now / 3600_000) * 3600_000;
	const bucketMap = new Map<number, { warnCount: number; errorCount: number }>();
	for (const row of hourlyRes.rows) {
		bucketMap.set(Number(row.hourBucket), {
			warnCount: Number(row.warnCount ?? 0),
			errorCount: Number(row.errorCount ?? 0),
		});
	}

	const hourlyTimeline: SocOverviewData['hourlyTimeline'] = [];
	for (let i = 11; i >= 0; i--) {
		const ts = currentHourBucket - i * 3600_000;
		const d = new Date(ts);
		const hourLabel = `${String(d.getHours()).padStart(2, '0')}:00`;
		const counts = bucketMap.get(ts) ?? { warnCount: 0, errorCount: 0 };
		hourlyTimeline.push({
			hourLabel,
			timestamp: ts,
			warnCount: counts.warnCount,
			errorCount: counts.errorCount,
		});
	}

	// Calculate DEFCON level (1 = Maximum Alert, 5 = Normal Peace Time)
	let defcon: 1 | 2 | 3 | 4 | 5 = 5;
	if (lockdown.active) {
		defcon = 1;
	} else if (criticalEvents24h >= 1 || newActiveBansCount >= 3 || securityEvents24h >= 40) {
		defcon = 2;
	} else if (newActiveBansCount >= 1 || securityEvents24h >= 15 || sessionAnomalies24h >= 1) {
		defcon = 3;
	} else if (authFailures24h >= 5 || securityEvents24h >= 3) {
		defcon = 4;
	}

	const activeRateLimits = getActiveRateLimits();

	return {
		defcon,
		lockdown,
		emergencySwitches,
		webhookConfig,
		metrics: {
			activeBansCount,
			whitelistedCount,
			securityEvents24h,
			authFailures24h,
			csrfAndIdor24h,
			sessionAnomalies24h,
			activeSessionsCount,
			activeRateLimits,
			activeRateLimitsCount: activeRateLimits.length,
		},
		hourlyTimeline,
		hourlyDistribution,
		topAttackers,
		systemTelemetry: getHostAndPoolTelemetry(),
		defconResetAt,
	};
}

export async function getSocIncidents(limit = 50): Promise<SocIncident[]> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const res = await pool.query(
		`SELECT id, title, severity, status, source_ip AS "sourceIp", service, details,
		        analyst_notes AS "analystNotes", assigned_to AS "assignedTo",
		        created_at AS "createdAt", updated_at AS "updatedAt"
		 FROM soc_incidents
		 ORDER BY created_at DESC
		 LIMIT $1`,
		[limit]
	);
	return res.rows.map((row) => ({
		id: String(row.id),
		title: String(row.title),
		severity: row.severity as SocIncidentSeverity,
		status: row.status as SocIncidentStatus,
		sourceIp: row.sourceIp ? String(row.sourceIp) : null,
		service: row.service ? String(row.service) : null,
		details: (row.details as Record<string, unknown>) ?? null,
		analystNotes: row.analystNotes ? String(row.analystNotes) : null,
		assignedTo: row.assignedTo ? String(row.assignedTo) : null,
		createdAt: Number(row.createdAt),
		updatedAt: Number(row.updatedAt),
	}));
}

export async function createSocIncident(data: {
	title: string;
	severity: SocIncidentSeverity;
	sourceIp?: string | null;
	service?: string | null;
	details?: Record<string, unknown> | null;
	analystNotes?: string | null;
	assignedTo?: string | null;
	status?: SocIncidentStatus;
}): Promise<SocIncident> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();
	const id = `inc_${now}_${Math.random().toString(36).substring(2, 8)}`;
	const status = data.status || 'new';

	await pool.query(
		`INSERT INTO soc_incidents (id, title, severity, status, source_ip, service, details, analyst_notes, assigned_to, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		[
			id,
			data.title,
			data.severity,
			status,
			data.sourceIp || null,
			data.service || 'security',
			data.details ? JSON.stringify(data.details) : null,
			data.analystNotes || null,
			data.assignedTo || null,
			now,
			now,
		]
	);

	return {
		id,
		title: data.title,
		severity: data.severity,
		status,
		sourceIp: data.sourceIp || null,
		service: data.service || 'security',
		details: data.details || null,
		analystNotes: data.analystNotes || null,
		assignedTo: data.assignedTo || null,
		createdAt: now,
		updatedAt: now,
	};
}

export async function updateSocIncident(
	id: string,
	updates: {
		status?: SocIncidentStatus;
		analystNotes?: string;
		assignedTo?: string;
	}
): Promise<boolean> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const sets: string[] = ['updated_at = $1'];
	const values: unknown[] = [Date.now()];
	let idx = 2;

	if (updates.status !== undefined) {
		sets.push(`status = $${idx++}`);
		values.push(updates.status);
	}
	if (updates.analystNotes !== undefined) {
		sets.push(`analyst_notes = $${idx++}`);
		values.push(updates.analystNotes);
	}
	if (updates.assignedTo !== undefined) {
		sets.push(`assigned_to = $${idx++}`);
		values.push(updates.assignedTo);
	}

	values.push(id);
	const res = await pool.query(
		`UPDATE soc_incidents SET ${sets.join(', ')} WHERE id = $${idx}`,
		values
	);

	// State-backed automated containment: when marked 'contained', isolate source IP if present
	if (updates.status === 'contained') {
		try {
			const incRes = await pool.query<{ source_ip: string | null }>(
				'SELECT source_ip FROM soc_incidents WHERE id = $1',
				[id]
			);
			const sourceIp = incRes.rows[0]?.source_ip;
			if (sourceIp) {
				await banIp({
					ip: sourceIp,
					neden: `Stateful Incident Containment [Incident #${id}]`,
					durationMs: 24 * 60 * 60 * 1000,
					tehditPuani: 100,
					olusturanId: updates.assignedTo || null,
				});
			}
		} catch (containErr) {
			console.error('[SoC] State-backed containment trigger error:', containErr);
		}
	}

	return (res.rowCount ?? 0) > 0;
}
