import type { QueryResultRow } from 'pg';
import { ensurePostgresInit, getPgPool } from '@/db';
import { publishEventQuiet, registerEventHandler, startListener } from '@/db/events';
import { cleanIp } from '@/lib/audit';
import { addKernelBlackhole, removeKernelBlackhole } from '@/server/security/kernelFirewall';
import { classifyThreatIntel } from '@/server/security/threatIntelligence';
import { isIpInCidr, isLocalOrUnknownIp } from './ipUtils';
import { clearStrikeBucket } from './strikes';
import type { SecurityBlock } from './types';

type QueryPool = { query(text: string, values?: unknown[]): Promise<{ rows: QueryResultRow[] }> };

interface FirewallCacheEntry {
	map: Map<string, SecurityBlock>;
	expiresAt: number;
}

// In-memory cache for IP ban/whitelist table (refreshed every 1s or immediately on mutation)
const gFw = globalThis as typeof globalThis & {
	__orbitFwCache?: FirewallCacheEntry | null;
	__orbitFwInFlight?: Promise<Map<string, SecurityBlock>> | null;
};

export function invalidateFirewallCache(): void {
	gFw.__orbitFwCache = null;
	gFw.__orbitFwInFlight = null;
}

registerEventHandler('firewall-cache', (event) => {
	if (event.k === 'soc_updated' || event.k === 'refresh') {
		invalidateFirewallCache();
	}
});

export async function loadFirewallMap(pool?: QueryPool): Promise<Map<string, SecurityBlock>> {
	const now = Date.now();
	if (!pool) void startListener();
	if (!pool && gFw.__orbitFwCache && gFw.__orbitFwCache.expiresAt > now) {
		return gFw.__orbitFwCache.map;
	}
	if (!pool && gFw.__orbitFwInFlight) {
		return gFw.__orbitFwInFlight;
	}

	if (pool) return loadFirewallFromDb(pool, now);
	const ref: { promise?: Promise<Map<string, SecurityBlock>> } = {};
	ref.promise = loadFirewallFromDb(undefined, now)
		.then((map) => {
			if (gFw.__orbitFwInFlight === ref.promise) gFw.__orbitFwCache = { map, expiresAt: Date.now() + 1_000 };
			return map;
		})
		.finally(() => {
			if (gFw.__orbitFwInFlight === ref.promise) gFw.__orbitFwInFlight = null;
		});
	gFw.__orbitFwInFlight = ref.promise;
	return ref.promise;
}

async function loadFirewallFromDb(pool: QueryPool | undefined, now: number): Promise<Map<string, SecurityBlock>> {
	if (!pool) await ensurePostgresInit();
	const res = await (pool ?? getPgPool()).query(
		`SELECT ip, status AS status, reason AS reason, threat_score AS "threatScore",
		        violations AS violations, creator_id AS "creatorId", expires_at AS "expiresAt",
		        created_at AS creation, updated_at AS update
		 FROM security_blocks`
	);

	const map = new Map<string, SecurityBlock>();
	for (const r of res.rows) {
		const endTime = r.endDate ?? r.expiresAt;
		const endTimestamp = endTime !== null && endTime !== undefined ? Number(endTime) : null;
		const status = (r.status === 'whitelist' ? 'whitelist' : 'ban') as 'ban' | 'whitelist';
		if (status === 'ban' && endTimestamp !== null && endTimestamp <= now) {
			continue;
		}
		const ipKey = String(r.ip);
		map.set(ipKey, {
			ip: ipKey,
			status,
			reason: String(r.reason || ''),
			threatScore: Number(r.threatScore ?? 100),
			violations: Number(r.violations ?? 1),
			creatorId: r.creatorId ? String(r.creatorId) : null,
			expiresAt: endTimestamp,
			creation: Number(r.creation ?? now),
			update: Number(r.update ?? now),
		});
	}
	return map;
}

export async function isIpBanned(ip: string): Promise<{
	banned: boolean;
	whitelisted: boolean;
	reason?: string;
	expiresAt?: number | null;
}> {
	const clean = cleanIp(ip);
	if (isLocalOrUnknownIp(clean)) {
		return { banned: false, whitelisted: true };
	}

	try {
		const map = await loadFirewallMap();
		const entry = map.get(clean);
		if (entry) {
			if (entry.status === 'whitelist') {
				return { banned: false, whitelisted: true, reason: entry.reason };
			}
			if (entry.expiresAt === null || entry.expiresAt > Date.now()) {
				return { banned: true, whitelisted: false, reason: entry.reason, expiresAt: entry.expiresAt };
			}
		}

		let bannedCidrMatch: SecurityBlock | null = null;
		for (const fwEntry of map.values()) {
			if (fwEntry.ip.includes('/') && isIpInCidr(clean, fwEntry.ip)) {
				if (fwEntry.status === 'whitelist') {
					return { banned: false, whitelisted: true, reason: fwEntry.reason };
				}
				if ((fwEntry.expiresAt === null || fwEntry.expiresAt > Date.now()) && !bannedCidrMatch) {
					bannedCidrMatch = fwEntry;
				}
			}
		}

		if (bannedCidrMatch) {
			return { banned: true, whitelisted: false, reason: bannedCidrMatch.reason, expiresAt: bannedCidrMatch.expiresAt };
		}

		return { banned: false, whitelisted: false };
	} catch {
		return { banned: false, whitelisted: false };
	}
}

export async function banIp(params: {
	ip: string;
	reason: string;
	durationMs?: number | null;
	threatScore?: number;
	creatorId?: string | null;
}): Promise<void> {
	const clean = cleanIp(params.ip);
	if (!clean || clean === 'unknown') return;

	await ensurePostgresInit();
	const now = Date.now();
	const expiresAt =
		params.durationMs && params.durationMs > 0 ? now + params.durationMs : null;
	const points = Math.max(100, Math.round(params.threatScore ?? 100));
	const reason = String(params.reason || 'Security violation').slice(0, 300);

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
		[clean, reason, points, params.creatorId ?? null, expiresAt, now]
	);

	clearStrikeBucket(clean);
	invalidateFirewallCache();
	await addKernelBlackhole(clean).catch(() => {});
	await publishEventQuiet(getPgPool(), { k: 'soc_updated' });
}

export async function unbanIp(ip: string): Promise<void> {
	const clean = cleanIp(ip);
	if (!clean) return;
	await ensurePostgresInit();
	await getPgPool().query(`DELETE FROM security_blocks WHERE ip = $1`, [clean]);
	clearStrikeBucket(clean);
	invalidateFirewallCache();
	await removeKernelBlackhole(clean).catch(() => {});
	await publishEventQuiet(getPgPool(), { k: 'soc_updated' });
}

export async function whitelistIp(params: {
	ip: string;
	reason?: string;
	creatorId?: string | null;
}): Promise<void> {
	const clean = cleanIp(params.ip);
	if (!clean || clean === 'unknown') return;

	await ensurePostgresInit();
	const now = Date.now();
	const reason = String(params.reason || 'Trusted IP (Whitelist)').slice(0, 300);

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
		[clean, reason, params.creatorId ?? null, now]
	);

	clearStrikeBucket(clean);
	invalidateFirewallCache();
	await publishEventQuiet(getPgPool(), { k: 'soc_updated' });
}

export async function getSecurityBlocks(): Promise<SecurityBlock[]> {
	await ensurePostgresInit();
	const now = Date.now();
	const res = await getPgPool().query(
		`SELECT ip, status AS status, reason AS reason, threat_score AS "threatScore",
		        violations AS violations, creator_id AS "creatorId", expires_at AS "expiresAt",
		        created_at AS creation, updated_at AS update
		 FROM security_blocks
		 WHERE status = 'whitelist' OR expires_at IS NULL OR expires_at > $1
		 ORDER BY updated_at DESC`,
		[now]
	);
	return res.rows.map((r) => {
		const endTime = r.endDate ?? r.expiresAt;
		const ip = String(r.ip);
		return {
			ip,
			status: (r.status === 'whitelist' ? 'whitelist' : 'ban') as 'ban' | 'whitelist',
			reason: String(r.reason || ''),
			threatScore: Number(r.threatScore ?? 100),
			violations: Number(r.violations ?? 1),
			creatorId: r.creatorId ? String(r.creatorId) : null,
			expiresAt: endTime !== null && endTime !== undefined ? Number(endTime) : null,
			creation: Number(r.creation ?? now),
			update: Number(r.update ?? now),
			threatIntel: classifyThreatIntel(ip),
		};
	});
}
