import type { QueryResultRow } from 'pg';
import { ensurePostgresInit, getPgPool } from '@/db';
import { publishEventQuiet, registerEventHandler, startListener } from '@/db/events';
import { sendSecurityAlert } from '@/server/security/securityWebhook';
import { logSystemEvent } from '../logs.repo';
import { revokeAllNonAdminSessions } from './sessionRevocation';
import type { EmergencyKillSwitches, LockdownState } from './types';

export const DEFAULT_KILL_SWITCHES: EmergencyKillSwitches = {
	disableRegistrations: false,
	disableUploads: false,
	passkeyOnly: false,
};

const CACHE_TTL_MS = 250;
type QueryPool = { query(text: string, values?: unknown[]): Promise<{ rows: QueryResultRow[] }> };
interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}
interface LockdownCacheState {
	killSwitches: CacheEntry<EmergencyKillSwitches> | null;
	lockdown: CacheEntry<LockdownState> | null;
	defconReset: CacheEntry<number> | null;
	killSwitchesInFlight: Promise<EmergencyKillSwitches> | null;
	lockdownInFlight: Promise<LockdownState> | null;
	defconResetInFlight: Promise<number> | null;
}

const g = globalThis as typeof globalThis & { __orbitLockdownCache?: LockdownCacheState };

function cache(): LockdownCacheState {
	return (g.__orbitLockdownCache ??= {
		killSwitches: null, lockdown: null, defconReset: null,
		killSwitchesInFlight: null, lockdownInFlight: null, defconResetInFlight: null,
	});
}

export function invalidateLockdownCaches(): void {
	const c = cache();
	c.killSwitches = null; c.lockdown = null; c.defconReset = null;
	c.killSwitchesInFlight = null; c.lockdownInFlight = null; c.defconResetInFlight = null;
}

registerEventHandler('lockdown-cache', (event) => {
	if (event.k === 'soc_updated' || event.k === 'settings_updated' || event.k === 'refresh') {
		invalidateLockdownCaches();
	}
});

type Slot<T> = { get: () => CacheEntry<T> | null; set: (v: CacheEntry<T>) => void; getFly: () => Promise<T> | null; setFly: (p: Promise<T> | null) => void };

async function resolvePool(pool?: QueryPool): Promise<QueryPool> {
	if (pool) return pool;
	void startListener();
	await ensurePostgresInit();
	return getPgPool();
}

async function readCached<T>(pool: QueryPool | undefined, s: Slot<T>, load: (p: QueryPool) => Promise<{ cacheable: boolean; value: T }>): Promise<T> {
	if (!pool) {
		const hit = s.get();
		if (hit && hit.expiresAt > Date.now()) return hit.value;
		const existing = s.getFly();
		if (existing) return existing;
	}
	const ref: { promise?: Promise<T> } = {};
	const run = resolvePool(pool).then(load).then(({ cacheable, value }) => {
		if (!pool && cacheable && s.getFly() === ref.promise) s.set({ value, expiresAt: Date.now() + CACHE_TTL_MS });
		return value;
	});
	if (pool) return run;
	ref.promise = run.finally(() => {
		if (s.getFly() === ref.promise) s.setFly(null);
	});
	s.setFly(ref.promise);
	return ref.promise;
}

export async function getEmergencyKillSwitches(pool?: QueryPool): Promise<EmergencyKillSwitches> {
	const c = cache();
	return readCached(
		pool,
		{ get: () => c.killSwitches, set: (v) => { c.killSwitches = v; }, getFly: () => c.killSwitchesInFlight, setFly: (p) => { c.killSwitchesInFlight = p; } },
		async (p) => {
			try {
				const res = await p.query(`SELECT value AS value FROM system_settings WHERE key = 'soc_emergency_switches' LIMIT 1`);
				const raw = res.rows[0]?.value;
				const parsed = raw ? (JSON.parse(String(raw)) as Partial<EmergencyKillSwitches>) : {};
				return { cacheable: true, value: { ...DEFAULT_KILL_SWITCHES, ...parsed } };
			} catch {
				return { cacheable: false, value: { ...DEFAULT_KILL_SWITCHES } };
			}
		}
	);
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
	const c = cache();
	c.killSwitches = { value: updated, expiresAt: Date.now() + CACHE_TTL_MS };
	c.killSwitchesInFlight = null;

	await logSystemEvent({
		service: 'security',
		level: value ? 'WARN' : 'INFO',
		message: `🚨 [EMERGENCY SWITCH] '${key}' switch ${value ? 'ACTIVATED' : 'DEACTIVATED'}.`,
		userId: actorId,
		detail: { switch: key, value },
	}).catch(() => {});
	await publishEventQuiet(p, { k: 'soc_updated' });
	return updated;
}

export async function getLockdownState(pool?: QueryPool): Promise<LockdownState> {
	const c = cache();
	return readCached(
		pool,
		{ get: () => c.lockdown, set: (v) => { c.lockdown = v; }, getFly: () => c.lockdownInFlight, setFly: (p) => { c.lockdownInFlight = p; } },
		async (p) => {
			try {
				const res = await p.query(`SELECT key, value, updated_at FROM system_settings WHERE key IN ('soc_lockdown_mode', 'soc_lockdown_reason')`);
				let active = false;
				let reason = 'Active cyber defense lockdown';
				let updatedAt: number | null = null;
				for (const row of res.rows) {
					if (row.key === 'soc_lockdown_mode') {
						active = row.value === '1' || row.value === 'true';
						const rawTs = row.updatedAt ?? row.updated_at;
						updatedAt = rawTs ? Number(rawTs) : null;
					} else if (row.key === 'soc_lockdown_reason' && row.value) {
						reason = String(row.value);
					}
				}
				return { cacheable: true, value: { active, reason, updatedAt } };
			} catch {
				return { cacheable: false, value: { active: false, reason: '', updatedAt: null } };
			}
		}
	);
}

export async function setLockdownState(params: {
	active: boolean;
	reason?: string;
	actorId: string;
	ip: string;
}): Promise<LockdownState> {
	await ensurePostgresInit();
	const now = Date.now();
	const reason = String(params.reason || 'Lockdown enabled by administrator').slice(0, 240);
	const pool = getPgPool();

	await pool.query(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ('soc_lockdown_mode', $1, $3), ('soc_lockdown_reason', $2, $3)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
		[params.active ? '1' : '0', reason, now]
	);

	const nextState: LockdownState = { active: params.active, reason, updatedAt: now };
	const c = cache();
	c.lockdown = { value: nextState, expiresAt: Date.now() + CACHE_TTL_MS };
	c.lockdownInFlight = null;

	if (params.active) await revokeAllNonAdminSessions({ actorId: params.actorId, ip: params.ip });

	await logSystemEvent({
		service: 'security',
		level: params.active ? 'ERROR' : 'WARN',
		message: params.active
			? `🚨 [DEFCON LOCKDOWN] Active defense lockdown ENGAGED: ${reason}`
			: `🛡️ [DEFCON LOCKDOWN] Active defense lockdown disengaged`,
		detail: { active: params.active, reason },
		userId: params.actorId,
		ip: params.ip,
	});
	void sendSecurityAlert({
		type: params.active ? 'LOCKDOWN_DEFCON1' : 'SECURITY_ALERT',
		title: params.active ? '🚨 DEFCON 1 - Defense Lockdown Active!' : '🛡️ DEFCON Shield Disengaged',
		description: params.active ? `System placed into full quarantine mode.\nReason: ${reason}` : 'Quarantine mode cleared, system returned to normal operation.',
		severity: params.active ? 'CRITICAL' : 'INFO',
		ip: params.ip,
		details: { actorId: params.actorId, reason },
	});
	await publishEventQuiet(pool, { k: 'soc_updated' });
	return nextState;
}

export async function getDefconResetAt(pool?: QueryPool): Promise<number> {
	const c = cache();
	return readCached(
		pool,
		{ get: () => c.defconReset, set: (v) => { c.defconReset = v; }, getFly: () => c.defconResetInFlight, setFly: (p) => { c.defconResetInFlight = p; } },
		async (p) => {
			try {
				const res = await p.query(`SELECT value AS value FROM system_settings WHERE key = 'soc_defcon_reset_at' LIMIT 1`);
				const n = res.rows[0]?.value ? Number(res.rows[0].value) : 0;
				return { cacheable: true, value: Number.isFinite(n) ? n : 0 };
			} catch {
				return { cacheable: false, value: 0 };
			}
		}
	);
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
	const c = cache();
	c.defconReset = { value: now, expiresAt: Date.now() + CACHE_TTL_MS };
	c.defconResetInFlight = null;
	await logSystemEvent({
		service: 'security',
		level: 'INFO',
		message: '🛡️ [DEFCON RESET] Security alarms acknowledged and DEFCON baseline reset by administrator.',
		detail: { actorId: params.actorId || null, resetAt: now },
		userId: params.actorId ?? undefined,
		ip: params.actorIp,
	});
	await publishEventQuiet(p, { k: 'soc_updated' });
	return { ok: true, resetAt: now };
}
