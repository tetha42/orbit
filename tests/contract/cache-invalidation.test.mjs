import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { createMockRequest, teardownContractTestResources } from './helper.mjs';

after(teardownContractTestResources);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForCondition(predicate, timeoutMs = 1500, stepMs = 15) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (predicate()) return true;
		await sleep(stepMs);
	}
	return predicate();
}

test('singleflight: lockdown, firewall blocks, and role caches coalesce concurrent reads and invalidate on local events', async () => {
	const { ensurePostgresInit, getPgPool } = await import('../../src/db/index.ts');
	const { ADMIN_ROLE_ID } = await import('../../src/core/permissions/index.ts');
	const { dispatchLocalEvent } = await import('../../src/db/events.ts');
	const { getCached, setCached } = await import('../../src/server/cache.ts');
	const lockdown = await import('../../src/db/repositories/security/lockdown.ts');
	const blocks = await import('../../src/db/repositories/security/blocks.ts');
	const roles = await import('../../src/db/roles/queries.ts');

	await ensurePostgresInit();
	const pool = getPgPool();
	const origQuery = pool.query.bind(pool);

	const counts = { lockdown: 0, switches: 0, defcon: 0, blocks: 0, roles: 0 };
	pool.query = (async (sql, params) => {
		const text = typeof sql === 'string' ? sql : '';
		if (text.includes("'soc_lockdown_mode'")) {
			counts.lockdown += 1;
			await sleep(20);
		} else if (text.includes("'soc_emergency_switches'")) {
			counts.switches += 1;
			await sleep(20);
		} else if (text.includes("'soc_defcon_reset_at'")) {
			counts.defcon += 1;
			await sleep(20);
		} else if (text.includes('FROM security_blocks')) {
			counts.blocks += 1;
			await sleep(20);
		} else if (text.includes('FROM roles WHERE id = $1')) {
			counts.roles += 1;
			await sleep(20);
		}
		return origQuery(sql, params);
	});

	try {
		lockdown.invalidateLockdownCaches();
		blocks.invalidateFirewallCache();
		roles.dropRoleCache();

		// 1. Concurrent reads coalesce into 1 query per cache slot
		const [lStates, kStates, dStates, fwMaps, rPerms] = await Promise.all([
			Promise.all(Array.from({ length: 8 }, () => lockdown.getLockdownState())),
			Promise.all(Array.from({ length: 8 }, () => lockdown.getEmergencyKillSwitches())),
			Promise.all(Array.from({ length: 8 }, () => lockdown.getDefconResetAt())),
			Promise.all(Array.from({ length: 8 }, () => blocks.loadFirewallMap())),
			Promise.all(Array.from({ length: 8 }, () => roles.getRolePermission(ADMIN_ROLE_ID))),
		]);

		assert.strictEqual(counts.lockdown, 1, 'Expected 1 DB query for 8 concurrent getLockdownState calls');
		assert.strictEqual(counts.switches, 1, 'Expected 1 DB query for 8 concurrent getEmergencyKillSwitches calls');
		assert.strictEqual(counts.defcon, 1, 'Expected 1 DB query for 8 concurrent getDefconResetAt calls');
		assert.strictEqual(counts.blocks, 1, 'Expected 1 DB query for 8 concurrent loadFirewallMap calls');
		assert.strictEqual(counts.roles, 1, 'Expected 1 DB query for 8 concurrent getRolePermission calls');
		assert.ok(lStates.every((v) => v.active === lStates[0].active));
		assert.ok(kStates.every((v) => v.disableUploads === kStates[0].disableUploads));
		assert.ok(dStates.every((v) => v === dStates[0]));
		assert.ok(fwMaps.every((m) => m === fwMaps[0]));
		assert.ok(rPerms.every((p) => p.admin === true));

		// 2. Subsequent reads within TTL hit cache (0 new queries)
		await Promise.all([
			lockdown.getLockdownState(),
			lockdown.getEmergencyKillSwitches(),
			lockdown.getDefconResetAt(),
			blocks.loadFirewallMap(),
			roles.getRolePermission(ADMIN_ROLE_ID),
		]);
		assert.deepStrictEqual(counts, { lockdown: 1, switches: 1, defcon: 1, blocks: 1, roles: 1 });

		// 3. soc_updated clears lockdown + firewall caches, leaves role cache untouched
		dispatchLocalEvent({ k: 'soc_updated' });
		const g = globalThis;
		assert.strictEqual(g.__orbitLockdownCache?.lockdown, null);
		assert.strictEqual(g.__orbitLockdownCache?.killSwitches, null);
		assert.strictEqual(g.__orbitLockdownCache?.defconReset, null);
		assert.strictEqual(g.__orbitFwCache, null);
		assert.ok(g.__beuRoleCache?.has(ADMIN_ROLE_ID), 'soc_updated should not unnecessarily flush role cache');

		// 4. settings_updated clears lockdown, role, roles_raw, and club_info caches
		await Promise.all([lockdown.getLockdownState(), blocks.loadFirewallMap()]);
		setCached('roles_raw', { roles: [], defaultRoleId: null }, 60_000);
		setCached('club_info', { clubName: 'Cached' }, 60_000);
		dispatchLocalEvent({ k: 'settings_updated', key: 'club_name' });
		assert.strictEqual(g.__orbitLockdownCache?.lockdown, null);
		assert.strictEqual(g.__beuRoleCache?.size, 0);
		assert.strictEqual(getCached('roles_raw'), null);
		assert.strictEqual(getCached('club_info'), null);

		// 5. permission clears role cache + roles_raw
		await roles.getRolePermission(ADMIN_ROLE_ID);
		setCached('roles_raw', { roles: [], defaultRoleId: null }, 60_000);
		assert.ok(g.__beuRoleCache?.has(ADMIN_ROLE_ID));
		dispatchLocalEvent({ k: 'permission', roleId: ADMIN_ROLE_ID });
		assert.strictEqual(g.__beuRoleCache?.size, 0);
		assert.strictEqual(getCached('roles_raw'), null);
	} finally {
		pool.query = origQuery;
		lockdown.invalidateLockdownCaches();
		blocks.invalidateFirewallCache();
		roles.dropRoleCache();
	}
});

test('cache-invalidation: mid-flight invalidation prevents stale DB reads from poisoning globalThis caches', async () => {
	const { ensurePostgresInit, getPgPool } = await import('../../src/db/index.ts');
	const { ADMIN_ROLE_ID } = await import('../../src/core/permissions/index.ts');
	const { dispatchLocalEvent } = await import('../../src/db/events.ts');
	const lockdown = await import('../../src/db/repositories/security/lockdown.ts');
	const blocks = await import('../../src/db/repositories/security/blocks.ts');
	const roles = await import('../../src/db/roles/queries.ts');

	await ensurePostgresInit();
	const pool = getPgPool();
	const origQuery = pool.query.bind(pool);

	pool.query = (async (sql, params) => {
		const text = typeof sql === 'string' ? sql : '';
		if (
			text.includes("'soc_lockdown_mode'")
			|| text.includes('FROM security_blocks')
			|| text.includes('FROM roles WHERE id = $1')
		) {
			await sleep(60);
		}
		return origQuery(sql, params);
	});

	try {
		lockdown.invalidateLockdownCaches();
		blocks.invalidateFirewallCache();
		roles.dropRoleCache();

		const pending = Promise.all([
			lockdown.getLockdownState(),
			blocks.loadFirewallMap(),
			roles.getRolePermission(ADMIN_ROLE_ID),
		]);

		await sleep(15);
		dispatchLocalEvent({ k: 'refresh' });
		await pending;

		const g = globalThis;
		assert.strictEqual(g.__orbitLockdownCache?.lockdown, null, 'Stale in-flight lockdown read must not populate cache');
		assert.strictEqual(g.__orbitFwCache, null, 'Stale in-flight firewall read must not populate cache');
		assert.strictEqual(g.__beuRoleCache?.has(ADMIN_ROLE_ID), false, 'Stale in-flight role read must not populate cache');
	} finally {
		pool.query = origQuery;
		lockdown.invalidateLockdownCaches();
		blocks.invalidateFirewallCache();
		roles.dropRoleCache();
	}
});

test('pg_notify: multi-instance PostgreSQL NOTIFY immediately invalidates lockdown, firewall, role, and settings caches', async () => {
	const { ensurePostgresInit, getPgPool } = await import('../../src/db/index.ts');
	const { CHANNEL, eventStatus, startListener } = await import('../../src/db/events.ts');
	const { ADMIN_ROLE_ID } = await import('../../src/core/permissions/index.ts');
	const { getCached, setCached } = await import('../../src/server/cache.ts');
	const lockdown = await import('../../src/db/repositories/security/lockdown.ts');
	const blocks = await import('../../src/db/repositories/security/blocks.ts');
	const roles = await import('../../src/db/roles/queries.ts');
	const settings = await import('../../src/db/repositories/settings.repo.ts');

	await ensurePostgresInit();
	startListener();
	const listening = await waitForCondition(() => eventStatus().listening, 2000);
	assert.strictEqual(listening, true, 'Event bus LISTEN client must connect to PostgreSQL');

	const conn = (process.env.DATABASE_URL || '').trim();
	assert.ok(conn, 'DATABASE_URL must be available');
	const remoteInstanceClient = new Client({ connectionString: conn });
	await remoteInstanceClient.connect();

	const probeIp = '203.0.113.250';
	const probeSettingKey = `__contract_probe_${process.pid}_${Date.now()}`;
	const g = globalThis;

	try {
		// 1. Populate all caches with long-ish TTLs (roles 5s, blocks 1s, server cache 60s, lockdown 250ms)
		await Promise.all([
			lockdown.getLockdownState(),
			blocks.loadFirewallMap(),
			roles.getRolePermission(ADMIN_ROLE_ID),
		]);
		setCached('roles_raw', { roles: [], defaultRoleId: null }, 60_000);
		setCached('club_info', { clubName: 'Stale' }, 60_000);
		assert.ok(g.__orbitLockdownCache?.lockdown !== null);
		assert.ok(g.__orbitFwCache !== null);
		assert.ok(g.__beuRoleCache?.has(ADMIN_ROLE_ID));

		// 2. Remote instance emits soc_updated via pg_notify
		await remoteInstanceClient.query('SELECT pg_notify($1, $2)', [CHANNEL, JSON.stringify({ k: 'soc_updated' })]);
		const socInvalidated = await waitForCondition(
			() => g.__orbitLockdownCache?.lockdown === null && g.__orbitFwCache === null,
			1000,
			10
		);
		assert.strictEqual(socInvalidated, true, 'pg_notify soc_updated must invalidate lockdown & firewall caches');

		// 3. Re-warm and emit settings_updated from remote instance
		await lockdown.getLockdownState();
		setCached('roles_raw', { roles: [], defaultRoleId: null }, 60_000);
		setCached('club_info', { clubName: 'Stale' }, 60_000);
		await remoteInstanceClient.query('SELECT pg_notify($1, $2)', [CHANNEL, JSON.stringify({ k: 'settings_updated' })]);
		const settingsInvalidated = await waitForCondition(
			() =>
				g.__orbitLockdownCache?.lockdown === null
				&& g.__beuRoleCache?.size === 0
				&& getCached('roles_raw') === null
				&& getCached('club_info') === null,
			1000,
			10
		);
		assert.strictEqual(settingsInvalidated, true, 'pg_notify settings_updated must invalidate lockdown, role & club caches');

		// 4. Local DB mutation helpers (whitelistIp, setSystemSetting) broadcast pg_notify across instances
		await blocks.loadFirewallMap();
		await blocks.whitelistIp({ ip: probeIp, reason: 'contract-test-probe' });
		const fwAfterWhitelist = await blocks.isIpBanned(probeIp);
		assert.strictEqual(fwAfterWhitelist.whitelisted, true);

		setCached('club_info', { clubName: 'BeforeSettingWrite' }, 60_000);
		await settings.setSystemSetting(probeSettingKey, 'probe_ok');
		const clubCleared = await waitForCondition(() => getCached('club_info') === null, 1000, 10);
		assert.strictEqual(clubCleared, true, 'setSystemSetting must broadcast settings_updated to clear club_info');
	} finally {
		await getPgPool().query('DELETE FROM security_blocks WHERE ip = $1', [probeIp]).catch(() => {});
		await getPgPool().query('DELETE FROM system_settings WHERE key = $1', [probeSettingKey]).catch(() => {});
		await remoteInstanceClient.end().catch(() => {});
		lockdown.invalidateLockdownCaches();
		blocks.invalidateFirewallCache();
		roles.dropRoleCache();
	}
});

test('singleflight: verifyAuth memoizes concurrent invocations for the same Request object', async () => {
	const { verifyAuth } = await import('../../src/lib/auth/authGuard.ts');
	const req = await createMockRequest('/api/members');

	const p1 = verifyAuth(req);
	const p2 = verifyAuth(req);
	const p3 = verifyAuth(req);
	assert.strictEqual(p1, p2);
	assert.strictEqual(p2, p3);

	const res = await p1;
	assert.strictEqual(res.authorized, false);
	assert.strictEqual(res.response.status, 401);
});

test('pg_notify: getSystemSettings and getRoles start LISTEN even if DATABASE_URL was unset at registration time', async () => {
	const { ensurePostgresInit } = await import('../../src/db/index.ts');
	const { CHANNEL, eventStatus, stopListener } = await import('../../src/db/events.ts');
	const { getCached, setCached } = await import('../../src/server/cache.ts');
	const { getSystemSettings } = await import('../../src/db/repositories/settings.repo.ts');
	const { getRoles } = await import('../../src/db/roles/queries.ts');
	const { CONFIG } = await import('../../src/server/config.ts');

	await ensurePostgresInit();
	await stopListener();
	assert.strictEqual(eventStatus().listening, false);

	const savedEnvUrl = process.env.DATABASE_URL;
	const savedCfgUrl = CONFIG.database.url;
	const remoteClient = new Client({ connectionString: savedEnvUrl || savedCfgUrl });
	await remoteClient.connect();

	try {
		// Simulate cold start before setup configures DATABASE_URL
		process.env.DATABASE_URL = '';
		CONFIG.database.url = '';
		const { registerEventHandler } = await import('../../src/db/events.ts');
		const unregister = registerEventHandler('late-db-probe', () => {});
		assert.strictEqual(eventStatus().listening, false);
		unregister();

		// Now restore DATABASE_URL (simulating reconfigurePgPool / setup) and read settings + roles
		process.env.DATABASE_URL = savedEnvUrl;
		CONFIG.database.url = savedCfgUrl;

		await getSystemSettings();
		const listeningAfterSettings = await waitForCondition(() => eventStatus().listening, 2000);
		assert.strictEqual(listeningAfterSettings, true, 'getSystemSettings must auto-start LISTEN once DB URL is set');

		await stopListener();
		assert.strictEqual(eventStatus().listening, false);
		await getRoles();
		const listeningAfterRoles = await waitForCondition(() => eventStatus().listening, 2000);
		assert.strictEqual(listeningAfterRoles, true, 'getRoles must auto-start LISTEN once DB URL is set');

		setCached('club_info', { clubName: 'StaleLate' }, 60_000);
		setCached('roles_raw', { roles: [], defaultRoleId: null }, 60_000);
		await remoteClient.query('SELECT pg_notify($1, $2)', [CHANNEL, JSON.stringify({ k: 'settings_updated' })]);
		const cleared = await waitForCondition(
			() => getCached('club_info') === null && getCached('roles_raw') === null,
			1500,
			10
		);
		assert.strictEqual(cleared, true, 'pg_notify after late LISTEN recovery must invalidate club_info & roles_raw');
	} finally {
		process.env.DATABASE_URL = savedEnvUrl;
		CONFIG.database.url = savedCfgUrl;
		await remoteClient.end().catch(() => {});
	}
});
