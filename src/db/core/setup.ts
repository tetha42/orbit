import type { PoolClient } from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { ADMIN_ROLE_ID } from '@/core/permissions';
import { CONFIG } from '@/server/config';
import { checkDatabaseStatus, getPgPool } from './pool';

export function bootstrapAdminEnv():
	| { email: string; password: string; firstName: string; lastName: string; preferredLanguage: 'tr' | 'en'; error?: undefined }
	| { error: string; email?: undefined; password?: undefined; firstName?: undefined; lastName?: undefined } {
	const email = (process.env.BOOTSTRAP_ADMIN_EMAIL?.trim() || CONFIG.bootstrapAdmin.email || '').trim().toLowerCase();
	const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? CONFIG.bootstrapAdmin.password ?? '';
	if (!email || !password) return { error: 'Bootstrap admin credentials not defined.' };
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Bootstrap admin email is not a valid email address.' };
	if (password.length < 12) return { error: 'Bootstrap admin password must be at least 12 characters.' };
	const firstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME?.trim() || CONFIG.bootstrapAdmin.firstName || 'Orbit';
	const lastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME?.trim() || CONFIG.bootstrapAdmin.lastName || 'Admin';
	const preferredLanguage: 'tr' | 'en' = process.env.BOOTSTRAP_ADMIN_LANGUAGE === 'tr' ? 'tr' : 'en';
	return { email, password, firstName, lastName, preferredLanguage };
}

export async function bootstrapFirstAdmin(client: PoolClient): Promise<void> {
	const env = bootstrapAdminEnv();
	if (env.error !== undefined) {
		console.warn(`[PostgreSQL] Database empty; initial admin generation skipped: ${env.error}`);
		return;
	}
	const { email, password, firstName, lastName, preferredLanguage } = env;
	await client.query(
		`INSERT INTO users (id, first_name, last_name, email, password_hash, handle, department, grade, role_id, avatar_url, bio, xp, status, created_at, preferred_language)
		 VALUES ($1, $2, $3, $4, $5, NULL, 'Management', 1, $6, NULL, '', 0, 'active', $7, $8)
		 ON CONFLICT (email) DO NOTHING`,
		[randomUUID(), firstName, lastName, email, await bcrypt.hash(password, 12), ADMIN_ROLE_ID, Date.now(), preferredLanguage]
	);
	console.log(`[PostgreSQL] Initial bootstrap administrator created: ${email}`);
}

export async function getSetupStatusWithInit(ensureInit: () => Promise<void>): Promise<{
	ready: boolean;
	firstRun?: boolean;
	step?: 'database' | 'identity' | 'admin' | 'ready';
	reason?: string;
	dbStatus?: { connected: boolean; configured: boolean; databaseName?: string; error?: string };
}> {
	const dbStatus = await checkDatabaseStatus();
	if (!dbStatus.connected) {
		return {
			ready: false,
			firstRun: true,
			step: 'database',
			reason: dbStatus.error ?? 'Database is unreachable or not configured.',
			dbStatus,
		};
	}

	try {
		await ensureInit();
		const r = await getPgPool().query(`SELECT COUNT(*)::int AS n FROM users WHERE role_id = $1`, [ADMIN_ROLE_ID]);
		if (Number(r.rows[0].n) > 0) return { ready: true, step: 'ready', dbStatus };
		return {
			ready: false,
			firstRun: true,
			step: 'admin',
			reason: 'No root administrator account found. Initial setup required.',
			dbStatus,
		};
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return {
			ready: false,
			firstRun: true,
			step: 'database',
			reason: msg,
			dbStatus: { connected: false, configured: true, error: msg },
		};
	}
}

export async function setupFirstAdminWithInit(
	ensureInit: () => Promise<void>,
	params: {
		name?: string;
		surname?: string;
		firstName?: string;
		lastName?: string;
		email: string;
		password: string;
	}
): Promise<{ ok: boolean; error?: string; user?: Record<string, unknown> }> {
	await ensureInit();
	const p = getPgPool();
	const client = await p.connect();
	try {
		await client.query('BEGIN');
		await client.query("SELECT pg_advisory_xact_lock(hashtext('setup.first_admin'))");
		const r = await client.query(`SELECT COUNT(*)::int AS n FROM users WHERE role_id = $1`, [ADMIN_ROLE_ID]);
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
		const fName = (params.firstName ?? params.name ?? '').trim();
		const lName = (params.lastName ?? params.surname ?? '').trim();
		await client.query(
			`INSERT INTO users (id, first_name, last_name, email, password_hash, handle, department, grade, role_id, avatar_url, bio, xp, status, created_at)
			 VALUES ($1, $2, $3, $4, $5, NULL, 'Management', 1, $6, NULL, '', 0, 'active', $7)`,
			[id, fName, lName, email, passwordHash, ADMIN_ROLE_ID, now]
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
