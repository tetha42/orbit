import type { PoolClient } from 'pg';
import { CONFIG } from '@/server/config';
import { updateConfigIniSync } from '@/server/iniWriter';
import { ensureRoleSchema } from '../roles/schema';
import { ensureMailSchema } from '../messages/recipients';
import { ensureOAuthSchema } from '../oauth/types';
import { ensureAuditSchema } from '../audit/writer';
import { startAuditMaintenance } from '../audit/reader';
import { runSchemaMigrations } from '../schema.init';
import { createDeviceSessionTables } from '../schema/init/deviceSessionTables';
import { createDriveTables } from '../schema/init/driveTables';
import { createChatCallTables } from '../schema/init/chatCallTables';
import {
	checkDatabaseStatus,
	getPgPool,
	globalForPg,
	isDatabaseConfigured,
	mapRow,
	testPostgresConnection,
} from './pool';
import {
	bootstrapFirstAdmin,
	getSetupStatusWithInit,
	setupFirstAdminWithInit,
} from './setup';

const globalForInit = globalThis as unknown as {
	__orbitDbInitState?: {
		isInitialized: boolean;
		initPromise: Promise<void> | null;
	};
};

const initState = (globalForInit.__orbitDbInitState ??= {
	isInitialized: false,
	initPromise: null,
});

const INIT_LOCK_TIMEOUT_MS = 120_000;
const INIT_LOCK_POLL_MS = 50;

async function acquireSchemaInitLock(client: PoolClient): Promise<void> {
	const deadline = Date.now() + INIT_LOCK_TIMEOUT_MS;
	for (;;) {
		// Poll with pg_try_advisory_lock so waiting callers release their virtualxid
		// immediately instead of deadlocking with CREATE INDEX CONCURRENTLY (40P01).
		const res = await client.query<{ locked?: boolean }>(
			"SELECT pg_try_advisory_lock(hashtext('orbit.schema.init')) AS locked"
		);
		if (res.rows[0]?.locked === true) return;
		if (Date.now() >= deadline) {
			throw new Error('Timed out waiting for PostgreSQL schema initialization lock.');
		}
		await new Promise((resolve) => setTimeout(resolve, INIT_LOCK_POLL_MS));
	}
}

export async function reconfigurePgPool(url: string): Promise<{ ok: boolean; error?: string }> {
	const test = await testPostgresConnection(url);
	if (!test.ok) return test;

	try {
		if (globalForPg.__pgPool) {
			await globalForPg.__pgPool.end().catch(() => {});
			globalForPg.__pgPool = undefined;
		}
		const cleanUrl = url.trim();
		updateConfigIniSync({ database: { url: cleanUrl } });
		initState.isInitialized = false;
		initState.initPromise = null;
		await ensurePostgresInit();
		return { ok: true };
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return { ok: false, error: msg };
	}
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
	await ensurePostgresInit();
	const client = await getPgPool().connect();
	const runQuery = client.query.bind(client);
	client.query = ((...args: unknown[]) =>
		Promise.resolve(runQuery(...(args as [string, unknown[]?]))).then((result) => {
			if (result && Array.isArray(result.rows)) {
				result.rows = result.rows.map(mapRow);
			}
			return result;
		})) as typeof client.query;

	try {
		await client.query('BEGIN');
		const result = await fn(client);
		await client.query('COMMIT');
		return result;
	} catch (err) {
		await client.query('ROLLBACK').catch(() => {});
		throw err;
	} finally {
		client.release();
	}
}

export async function ensurePostgresInit(): Promise<void> {
	if (initState.isInitialized) return;
	if (!isDatabaseConfigured()) {
		await checkDatabaseStatus();
		if (!isDatabaseConfigured()) return;
	}
	if (initState.initPromise) return initState.initPromise;

	initState.initPromise = (async () => {
		const p = getPgPool();
		const client = await p.connect();
		let hasInitLock = false;
		try {
			await acquireSchemaInitLock(client);
			hasInitLock = true;
			await runSchemaMigrations(client);
			await createDeviceSessionTables(client);
			await createChatCallTables(client);

			await client.query('BEGIN');
			await client.query("SELECT pg_advisory_xact_lock(hashtext('roles.schema'))");
			await ensureRoleSchema(client);
			await ensureAuditSchema(client);
			await ensureMailSchema(client);
			await ensureOAuthSchema(client);
			const countRes = await client.query('SELECT count(*)::int AS count FROM users');
			if (countRes.rows[0].count === 0) await bootstrapFirstAdmin(client);
			await client.query('COMMIT');

			await createDriveTables(client);

			try {
				const identityRes = await client.query(
					"SELECT key, value FROM system_settings WHERE key IN ('club_name', 'club_domain')"
				);
				const identity = Object.fromEntries(
					identityRes.rows.map((row) => [String(row.key), String(row.value ?? '').trim()])
				);
				const name = identity.club_name || CONFIG.clubPreset.name;
				const domain = identity.club_domain || CONFIG.clubPreset.domain;
				if (name !== CONFIG.clubPreset.name || domain !== CONFIG.clubPreset.domain) {
					CONFIG.clubPreset.name = name;
					CONFIG.clubPreset.domain = domain;
					process.env.CLUB_NAME = name;
					process.env.CLUB_DOMAIN = domain;
					updateConfigIniSync({ club_preset: { name, domain } });
				}
			} catch (identityError) {
				console.warn('[config] Could not reconcile community identity from system_settings:', identityError);
			}

			initState.isInitialized = true;
			startAuditMaintenance();
		} catch (err) {
			await client.query('ROLLBACK').catch(() => {});
			console.error('[PostgreSQL Init Error]:', err);
			throw err;
		} finally {
			if (hasInitLock) {
				await client.query("SELECT pg_advisory_unlock(hashtext('orbit.schema.init'))").catch(() => {});
			}
			client.release();
		}
	})().catch((err) => {
		initState.initPromise = null;
		throw err;
	});

	return initState.initPromise;
}

export function getSetupStatus() {
	return getSetupStatusWithInit(ensurePostgresInit);
}

export function setupFirstAdmin(params: {
	name?: string;
	surname?: string;
	firstName?: string;
	lastName?: string;
	email: string;
	password: string;
}) {
	return setupFirstAdminWithInit(ensurePostgresInit, params);
}
