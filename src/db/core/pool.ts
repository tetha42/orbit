import { Pool, types } from 'pg';
import { CONFIG } from '@/server/config';

// Parse PostgreSQL INT8 (BIGINT) as JavaScript Number (safe up to 9 quadrillion)
types.setTypeParser(types.builtins.INT8, (val: string) => parseInt(val, 10));

export const globalForPg = globalThis as unknown as { __pgPool?: Pool };

const KEY_MAP_CACHE = new Map<string, string>();

function normalizeColumnKey(key: string): string {
	const cached = KEY_MAP_CACHE.get(key);
	if (cached) return cached;
	if (key.includes('_')) {
		const camel = key.toLowerCase().replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
		KEY_MAP_CACHE.set(key, camel);
		return camel;
	}
	return key;
}

export function mapRow(row: Record<string, unknown>): Record<string, unknown> {
	const mapped: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(row)) {
		mapped[normalizeColumnKey(key)] = value;
	}
	return mapped;
}

export function isDatabaseConfigured(): boolean {
	return Boolean((process.env.DATABASE_URL || CONFIG.database.url || '').trim());
}

export function getPgPool(): Pool {
	if (!globalForPg.__pgPool) {
		const connectionString = (process.env.DATABASE_URL || CONFIG.database.url || '').trim();
		if (!connectionString) {
			throw new Error('DATABASE_URL is not configured. Please complete the setup wizard at /setup.');
		}

		// 150 concurrent chat users issue far more than the old hard-coded 15
		// connections can absorb. DATABASE_POOL_MAX controls this;
		// keep it below the server's own max_connections, leaving headroom for LISTEN clients and tooling.
		const configuredMax = Number(process.env.DATABASE_POOL_MAX || CONFIG.database.maxConnections || 30);
		const poolMax = Number.isFinite(configuredMax)
			? Math.max(5, Math.min(Math.trunc(configuredMax), 100))
			: 30;

		const p = new Pool({
			connectionString,
			max: poolMax,
			idleTimeoutMillis: 30000,
			connectionTimeoutMillis: 5000,
		});

		const runQuery = p.query.bind(p);
		p.query = ((...args: unknown[]) =>
			Promise.resolve(runQuery(...(args as [string, unknown[]?]))).then((result) => {
				if (result && Array.isArray(result.rows)) {
					result.rows = result.rows.map(mapRow);
				}
				return result;
			})) as typeof p.query;

		p.on('error', (err) => {
			console.error('[PostgreSQL Pool Error]:', err);
		});
		globalForPg.__pgPool = p;
	}
	return globalForPg.__pgPool;
}

export async function checkDatabaseStatus(): Promise<{
	connected: boolean;
	configured: boolean;
	databaseName?: string;
	error?: string;
}> {
	const connectionString = (process.env.DATABASE_URL || CONFIG.database.url || '').trim();
	if (connectionString) {
		let tempPool: Pool | null = null;
		try {
			tempPool = new Pool({
				connectionString,
				max: 1,
				connectionTimeoutMillis: 3000,
				idleTimeoutMillis: 1000,
			});
			const client = await tempPool.connect();
			try {
				const res = await client.query('SELECT current_database() AS db');
				const databaseName = String(res.rows[0]?.db || '');
				return { connected: true, configured: true, databaseName };
			} finally {
				client.release();
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			return { connected: false, configured: true, error: msg };
		} finally {
			if (tempPool) {
				await tempPool.end().catch(() => {});
			}
		}
	}

	return { connected: false, configured: false, error: 'DATABASE_URL is not configured.' };
}

export async function testPostgresConnection(url: string): Promise<{
	ok: boolean;
	error?: string;
	databaseName?: string;
	alreadyInitialized?: boolean;
}> {
	const connectionString = (url || '').trim();
	if (!connectionString) {
		return { ok: false, error: 'Database connection string is required.' };
	}
	let tempPool: Pool | null = null;
	try {
		tempPool = new Pool({
			connectionString,
			max: 1,
			connectionTimeoutMillis: 4000,
			idleTimeoutMillis: 1000,
		});
		const client = await tempPool.connect();
		try {
			const metaRes = await client.query<{ db?: string; users_tbl?: string | null }>(
				"SELECT current_database() AS db, to_regclass('public.users') AS users_tbl"
			);
			const databaseName = metaRes.rows[0]?.db || undefined;
			let alreadyInitialized = false;
			if (metaRes.rows[0]?.users_tbl) {
				const countRes = await client
					.query<{ n?: number }>('SELECT COUNT(*)::int AS n FROM users')
					.catch(() => ({ rows: [] as Array<{ n?: number }> }));
				alreadyInitialized = Number(countRes.rows[0]?.n || 0) > 0;
			}
			return { ok: true, databaseName, alreadyInitialized };
		} finally {
			client.release();
		}
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return { ok: false, error: msg };
	} finally {
		if (tempPool) {
			await tempPool.end().catch(() => {});
		}
	}
}
