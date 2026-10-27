// Single database layer: PostgreSQL.
import { Pool, types } from 'pg';
import type { PoolClient } from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { ensureRoleSchema } from './roles';
import { ensureMailSchema } from './posta';
import { ensureOAuthSchema } from './oauth';
import { startAuditMaintenance, ensureAuditSchema } from './audit';
import { ADMIN_ROL_ID } from '@/core/permissions';
import { runSchemaMigrations } from '@/server/db/schema.init';
import { CONFIG } from '@/lib/server/config';
import { updateConfigIniSync } from '@/lib/server/iniWriter';

// Parse PostgreSQL INT8 (BIGINT) as Javascript Number (safe up to 9 quadrillion)
types.setTypeParser(types.builtins.INT8, (val: string) => parseInt(val, 10));

const globalForPg = globalThis as unknown as { __pgPool?: Pool };
let isInitialized = false;
let initPromise: Promise<void> | null = null;

const CAMEL_CASE_COLUMNS = [
	'aktarimId', 'appId', 'backedUp', 'ikiAdimZorunlu', 'roleId',
	'aktifOturumToken', 'aktorId', 'basvuruNotu', 'atananUyeId', 'belgeTuru',
	'copteMi', 'deviceType', 'verificationCode', 'envanterId', 'etkinlikId',
	'fisFotoUrl', 'gorevId', 'guncelleyenId', 'herkeseAcik', 'iadeTarihi',
	'kamuyaAcikMi', 'kararNo', 'katilimTarihi', 'katilimTuru', 'katilimZamani',
	'kaydedenId', 'kilitliMi', 'klasorId', 'userId', 'liderId',
	'oduncAlanId', 'oduncTarihi', 'oneCikan', 'ogrenciNo', 'olusturanId',
	'onemliMi', 'oturumBitis', 'pdfUrl', 'projeId', 'profilFoto',
	'publicKey', 'repoUrl', 'resimUrl', 'sabitliMi', 'seriNo',
	'passwordHash', 'sonGirisTarihi', 'sonKullanma', 'teamId', 'takimRolu',
	'tamamMi', 'tamamlanma', 'teslimTarihi', 'totpConfirmedAt', 'totpEnabled',
	'totpRecoveryCodes', 'totpSecret', 'totpSonAdim', 'tutarKurus', 'verilisTarihi',
	'xpVerildi', 'canliUrl', 'publishStatus', 'yayinTarihi', 'yazarAdSoyad',
	'yazarId', 'yoklamaAcik', 'yukleyenId', 'yapanId', 'yapanAd',
	'hedefTur', 'hedefId', 'hedefAd', 'konuId', 'mesajId',
	'gonderenId', 'gonderenAd', 'gonderenFoto', 'odaId', 'sonOkuma',
	'peerUserId', 'memberCount', 'okunmamisSayisi', 'sonMesaj', 'postaEposta',
	'silinmeTarihi', 'duzenlenmeTarihi',
	'pollId', 'secenekId', 'olusturanId', 'cokluSecim', 'endsAt', 'userAvatar',
	'clientId', 'secretHash', 'redirectUris', 'allowedScopes', 'codeChallenge', 'codeChallengeMethod', 'onayTarihi',
	'sonGirisIp', 'sonGirisUserAgent', 'sonAktifIp', 'sonAktifTarihi', 'tehditPuani', 'expiresAt',
];

const LOWER_TO_CAMEL = new Map(CAMEL_CASE_COLUMNS.map((name) => [name.toLowerCase(), name]));
const KEY_MAP_CACHE = new Map<string, string>();

function normalizeColumnKey(key: string): string {
	const legacy = LOWER_TO_CAMEL.get(key.toLowerCase());
	if (legacy) return legacy;
	const cached = KEY_MAP_CACHE.get(key);
	if (cached) return cached;
	if (key.includes('_')) {
		const camel = key.toLowerCase().replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
		KEY_MAP_CACHE.set(key, camel);
		return camel;
	}
	return key;
}

function mapRow(row: Record<string, unknown>): Record<string, unknown> {
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

const AUTO_DISCOVERY_CANDIDATES = [
	'postgresql://orbit:orbit_secret_2026@localhost:5432/orbit',
	'postgresql://orbit:orbit_secret_2026@orbit-db:5432/orbit',
	'postgresql://postgres:postgres@localhost:5432/orbit_db',
	'postgresql://postgres:postgres@localhost:5432/postgres',
	'postgresql://kulup:kulup_secret_2026@localhost:5432/kulup',
];

async function probeDatabaseCandidate(url: string): Promise<{
	ok: boolean;
	url: string;
	databaseName?: string;
	hasAdmin?: boolean;
}> {
	let tempPool: Pool | null = null;
	try {
		tempPool = new Pool({
			connectionString: url,
			max: 1,
			connectionTimeoutMillis: 1500,
			idleTimeoutMillis: 1000,
		});
		const client = await tempPool.connect();
		try {
			const res = await client.query('SELECT current_database() AS db');
			const databaseName = String(res.rows[0]?.db || '');
			let hasAdmin = false;
			try {
				const adminCheck = await client.query(
					`SELECT COUNT(*)::int AS n FROM users WHERE role_id = $1`,
					[ADMIN_ROL_ID]
				);
				hasAdmin = Number(adminCheck.rows[0]?.n || 0) > 0;
			} catch {
				// Table may not exist yet or still use legacy name
				try {
					const legacyCheck = await client.query(
						`SELECT COUNT(*)::int AS n FROM kullanicilar WHERE rolId = $1`,
						[ADMIN_ROL_ID]
					);
					hasAdmin = Number(legacyCheck.rows[0]?.n || 0) > 0;
				} catch {
					hasAdmin = false;
				}
			}
			return { ok: true, url, databaseName, hasAdmin };
		} finally {
			client.release();
		}
	} catch {
		return { ok: false, url };
	} finally {
		if (tempPool) {
			await tempPool.end().catch(() => {});
		}
	}
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
			// If explicitly configured via env and unreachable, report error unless auto-discovery finds an active DB
			const discovered = await Promise.all(AUTO_DISCOVERY_CANDIDATES.map(probeDatabaseCandidate));
			const best = discovered.find((d) => d.ok && d.hasAdmin) || discovered.find((d) => d.ok);
			if (best) {
				updateConfigIniSync({ database: { url: best.url } });
				return { connected: true, configured: true, databaseName: best.databaseName };
			}
			return { connected: false, configured: true, error: msg };
		} finally {
			if (tempPool) {
				await tempPool.end().catch(() => {});
			}
		}
	}

	// Zero-config auto-discovery when DATABASE_URL is not set on startup
	const discovered = await Promise.all(AUTO_DISCOVERY_CANDIDATES.map(probeDatabaseCandidate));
	const best = discovered.find((d) => d.ok && d.hasAdmin) || discovered.find((d) => d.ok);
	if (best) {
		updateConfigIniSync({ database: { url: best.url } });
		return { connected: true, configured: true, databaseName: best.databaseName };
	}

	return { connected: false, configured: false, error: 'DATABASE_URL is not configured.' };
}

export async function testPostgresConnection(url: string): Promise<{ ok: boolean; error?: string }> {
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
			await client.query('SELECT 1');
			return { ok: true };
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
		isInitialized = false;
		initPromise = null;
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

export function bootstrapAdminEnv():
	| { email: string; password: string; ad: string; soyad: string; error?: undefined }
	| { error: string; email?: undefined; password?: undefined; ad?: undefined; soyad?: undefined } {
	const email = (process.env.BOOTSTRAP_ADMIN_EMAIL?.trim() || CONFIG.bootstrapAdmin.email || '').trim().toLowerCase();
	const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? CONFIG.bootstrapAdmin.password ?? '';
	if (!email || !password) return { error: 'Bootstrap admin credentials not defined.' };
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Bootstrap admin email is not a valid email address.' };
	if (password.length < 12) return { error: 'Bootstrap admin password must be at least 12 characters.' };
	return {
		email,
		password,
		ad: process.env.BOOTSTRAP_ADMIN_AD?.trim() || CONFIG.bootstrapAdmin.firstName || 'Orbit',
		soyad: process.env.BOOTSTRAP_ADMIN_SOYAD?.trim() || CONFIG.bootstrapAdmin.lastName || 'Admin',
	};
}

async function bootstrapFirstAdmin(client: PoolClient): Promise<void> {
	const env = bootstrapAdminEnv();
	if (env.error !== undefined) {
		console.warn(`[PostgreSQL] Database empty; initial admin generation skipped: ${env.error}`);
		return;
	}
	const { email, password, ad, soyad } = env;
	await client.query(
		`INSERT INTO users (id, first_name, last_name, email, password_hash, handle, department, grade, role_id, avatar_url, bio, xp, status, created_at)
		 VALUES ($1, $2, $3, $4, $5, NULL, 'Management', 1, $6, NULL, '', 0, 'aktif', $7)
		 ON CONFLICT (email) DO NOTHING`,
		[randomUUID(), ad, soyad, email, await bcrypt.hash(password, 12), ADMIN_ROL_ID, Date.now()]
	);
	console.log(`[PostgreSQL] Initial bootstrap administrator created: ${email}`);
}

export async function getSetupStatus(): Promise<{
	hazir: boolean;
	firstRun?: boolean;
	step?: 'database' | 'identity' | 'admin' | 'ready';
	sebep?: string;
	dbStatus?: { connected: boolean; configured: boolean; databaseName?: string; error?: string };
}> {
	const dbStatus = await checkDatabaseStatus();
	if (!dbStatus.connected) {
		return {
			hazir: false,
			firstRun: true,
			step: 'database',
			sebep: dbStatus.error ?? 'Database is unreachable or not configured.',
			dbStatus,
		};
	}

	try {
		await ensurePostgresInit();
		const r = await getPgPool().query(`SELECT COUNT(*)::int AS n FROM users WHERE role_id = $1`, [ADMIN_ROL_ID]);
		if (Number(r.rows[0].n) > 0) return { hazir: true, step: 'ready', dbStatus };
		return {
			hazir: false,
			firstRun: true,
			step: 'admin',
			sebep: 'No root administrator account found. Initial setup required.',
			dbStatus,
		};
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return {
			hazir: false,
			firstRun: true,
			step: 'database',
			sebep: msg,
			dbStatus: { connected: false, configured: true, error: msg },
		};
	}
}

export async function setupFirstAdmin(params: {
	ad: string;
	soyad: string;
	email: string;
	password: string;
}): Promise<{ ok: boolean; error?: string; user?: Record<string, unknown> }> {
	await ensurePostgresInit();
	const p = getPgPool();
	const client = await p.connect();
	try {
		await client.query('BEGIN');
		await client.query("SELECT pg_advisory_xact_lock(hashtext('setup.first_admin'))");
		const r = await client.query(`SELECT COUNT(*)::int AS n FROM users WHERE role_id = $1`, [ADMIN_ROL_ID]);
		if (Number(r.rows[0].n) > 0) {
			await client.query('ROLLBACK');
			return { ok: false, error: 'Setup is already complete. An administrator account already exists.' };
		}

		const email = params.email.trim().toLowerCase();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			await client.query('ROLLBACK');
			return { ok: false, error: 'Please enter a valid email address.' };
		}
		if (params.password.length < 12) {
			await client.query('ROLLBACK');
			return { ok: false, error: 'Administrator password must be at least 12 characters.' };
		}

		const passwordHash = await bcrypt.hash(params.password, 12);
		const id = randomUUID();
		const now = Date.now();
		await client.query(
			`INSERT INTO users (id, first_name, last_name, email, password_hash, handle, department, grade, role_id, avatar_url, bio, xp, status, created_at)
			 VALUES ($1, $2, $3, $4, $5, NULL, 'Management', 1, $6, NULL, '', 0, 'aktif', $7)`,
			[id, params.ad.trim(), params.soyad.trim(), email, passwordHash, ADMIN_ROL_ID, now]
		);
		const userRes = await client.query('SELECT * FROM users WHERE id = $1', [id]);
		await client.query('COMMIT');
		console.log(`[Setup] Initial administrator account created: ${email}`);
		return { ok: true, user: userRes.rows[0] };
	} catch (err) {
		await client.query('ROLLBACK').catch(() => {});
		console.error('[Setup Error]:', err);
		return { ok: false, error: 'Failed to create root administrator account.' };
	} finally {
		client.release();
	}
}

export async function ensurePostgresInit(): Promise<void> {
	if (isInitialized) return;
	if (!isDatabaseConfigured()) {
		await checkDatabaseStatus();
		if (!isDatabaseConfigured()) return;
	}
	if (initPromise) return initPromise;

	initPromise = (async () => {
		const p = getPgPool();
		const client = await p.connect();
		try {
			await runSchemaMigrations(client);

			await client.query('BEGIN');
			await client.query("SELECT pg_advisory_xact_lock(hashtext('roller.sema'))");
			await ensureRoleSchema(client);
			await ensureAuditSchema(client);
			await ensureMailSchema(client);
			await ensureOAuthSchema(client);
			const countRes = await client.query('SELECT count(*)::int as count FROM users');
			if (countRes.rows[0].count === 0) await bootstrapFirstAdmin(client);
			await client.query('COMMIT');

			isInitialized = true;
			startAuditMaintenance();
		} catch (err) {
			await client.query('ROLLBACK').catch(() => {});
			console.error('[PostgreSQL Init Error]:', err);
			throw err;
		} finally {
			client.release();
		}
	})().catch((err) => {
		initPromise = null;
		throw err;
	});

	return initPromise;
}

// Re-export schema definitions
export * from './schema';
export * from './oauth';

// Domain Repositories Re-exports
export * from '@/server/db/domains/auth.repo';
export * from '@/server/db/domains/users.repo';
export * from '@/server/db/domains/files.repo';
export * from '@/server/db/domains/notifications.repo';
export * from '@/server/db/domains/members.repo';
export * from '@/server/db/domains/teams.repo';
export * from '@/server/db/domains/kanban.repo';
export * from '@/server/db/domains/budget.repo';
export * from '@/server/db/domains/certificates.repo';
export * from '@/server/db/domains/inventory.repo';
export * from '@/server/db/domains/decisions.repo';
export * from '@/server/db/domains/news.repo';
export * from '@/server/db/domains/notes.repo';
export * from '@/server/db/domains/settings.repo';
export * from '@/server/db/domains/projects.repo';
export * from '@/server/db/domains/events.repo';
export * from '@/server/db/domains/security.repo';

