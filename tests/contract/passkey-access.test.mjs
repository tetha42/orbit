import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { invokeRoute, teardownContractTestResources } from './helper.mjs';

after(teardownContractTestResources);

test('passkey session model: toSessionUser and twoStepPending bypass 2FA setup gate for passkey sessions', async () => {
	const { toSessionUser, establishSession } = await import('../../src/lib/auth/session.ts');
	const { twoStepPending } = await import('../../src/lib/auth/access.ts');
	const { ensurePostgresInit, getPgPool } = await import('../../src/db/index.ts');
	const { hashSessionToken } = await import('../../src/db/repositories/members/normalize.ts');

	const permission = {
		role: { id: 'role_admin', name: 'Admin', color: '#ef4444' },
		permissions: { database: 'manage', terminal: 'manage' },
		admin: true,
		require2fa: true,
		twoStepRequired: true,
	};
	const baseUser = {
		id: 'usr_unit_passkey',
		firstName: 'Pass',
		lastName: 'User',
		name: 'Pass',
		surname: 'User',
		email: 'pass@orbit.local',
		roleId: 'role_admin',
		department: 'Security',
		grade: 1,
		xp: 0,
		bio: '',
		status: 'active',
		totpEnabled: 0,
		createdAt: Date.now(),
	};

	const passkeyUser = { ...baseUser, authMethod: 'passkey' };
	const passwordUser = { ...baseUser, authMethod: 'password' };

	const passkeySessionUser = toSessionUser(passkeyUser, permission);
	assert.equal(passkeySessionUser.authMethod, 'passkey');
	assert.equal(passkeySessionUser.mustSetup2fa, false);
	assert.equal(twoStepPending({ ...passkeyUser, permission }), false);

	const passwordSessionUser = toSessionUser(passwordUser, permission);
	assert.equal(passwordSessionUser.mustSetup2fa, true);
	assert.equal(twoStepPending({ ...passwordUser, permission }), true);

	await ensurePostgresInit();
	const pool = getPgPool();
	const userId = `usr_pk_sess_${process.pid}_${Date.now()}`;
	await pool.query(
		`INSERT INTO users (
			id, first_name, last_name, email, password_hash, department, status, role_id, totp_enabled, auth_method, created_at
		) VALUES ($1, 'Pass', 'Est', $2, 'unused', 'Security', 'active', 'role_admin', 1, 'password', $3)`,
		[userId, `${userId}@orbit.local`, Date.now()]
	);
	try {
		const row = { ...baseUser, id: userId, email: `${userId}@orbit.local`, totpEnabled: 1, authMethod: 'password' };
		const token = await establishSession(row, undefined, 'passkey');
		assert.equal(row.authMethod, 'passkey');
		const dbRes = await pool.query('SELECT session_token, auth_method FROM users WHERE id = $1', [userId]);
		assert.equal(dbRes.rows[0]?.sessionToken, hashSessionToken(token));
		assert.equal(dbRes.rows[0]?.authMethod, 'passkey');
	} finally {
		await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {
			/* Ignore cleanup failure for temporary test user */
		});
	}
});

test('passkey login verify route: never emits a 2FA challenge for TOTP-enabled roles', () => {
	const routePath = join(process.cwd(), 'src', 'app', 'api', 'auth', 'passkey', 'login', 'verify', 'route.ts');
	const source = readFileSync(routePath, 'utf8');
	assert.equal(source.includes('createLoginChallenge'), false);
	assert.equal(source.includes('require2fa'), false);
	assert.ok(source.includes("establishSession(user, request, 'passkey')"));
});

test('database studio & terminal access: passkey sessions unlock automatically while password sessions stay gated', async () => {
	const { ensurePostgresInit, getPgPool } = await import('../../src/db/index.ts');
	const { SESSION_COOKIE } = await import('../../src/lib/auth/session.ts');
	const { hashSessionToken } = await import('../../src/db/repositories/members/normalize.ts');
	const { freezeUserDatabaseAccess, unfreezeUserDatabaseAccess } = await import('../../src/server/databaseAccess.ts');
	const dbAuthRoute = await import('../../src/app/api/database/auth/route.ts');
	const dbTablesRoute = await import('../../src/app/api/database/tables/route.ts');
	const termSessionRoute = await import('../../src/app/api/terminal/session/route.ts');

	await ensurePostgresInit();
	const pool = getPgPool();
	const ts = Date.now();
	const passkeyAdminId = `usr_pk_admin_${process.pid}_${ts}`;
	const passwordAdminId = `usr_pw_admin_${process.pid}_${ts}`;
	const passkeyToken = crypto.randomBytes(32).toString('base64url');
	const passwordToken = crypto.randomBytes(32).toString('base64url');
	const createdSessionIds = [];
	const prevTerminalEnabled = process.env.TERMINAL_ENABLED;

	await pool.query(
		`INSERT INTO users (
			id, first_name, last_name, email, password_hash, department, status, role_id,
			session_token, session_expires_at, auth_method, totp_enabled, created_at
		) VALUES
		($1, 'Passkey', 'Admin', $2, 'unused', 'Security', 'active', 'role_admin', $3, $4, 'passkey', 0, $5),
		($6, 'Password', 'Admin', $7, 'unused', 'Security', 'active', 'role_admin', $8, $4, 'password', 0, $5)`,
		[
			passkeyAdminId,
			`${passkeyAdminId}@orbit.local`,
			hashSessionToken(passkeyToken),
			ts + 600_000,
			ts,
			passwordAdminId,
			`${passwordAdminId}@orbit.local`,
			hashSessionToken(passwordToken),
		]
	);

	try {
		process.env.TERMINAL_ENABLED = '1';

		// 1. Passkey admin opens Database Studio tables directly without x-db-token
		const pkTablesRes = await invokeRoute(dbTablesRoute.GET, '/api/database/tables', {
			headers: { cookie: `${SESSION_COOKIE}=${passkeyToken}` },
		});
		assert.equal(pkTablesRes.status, 200);
		assert.ok(Array.isArray(pkTablesRes.data?.tables));

		// 2. Password admin without x-db-token is still blocked with 401
		const pwTablesRes = await invokeRoute(dbTablesRoute.GET, '/api/database/tables', {
			headers: { cookie: `${SESSION_COOKIE}=${passwordToken}` },
		});
		assert.equal(pwTablesRes.status, 401);

		// 3. Frozen passkey admin is still blocked by SoC containment (403 DATABASE_ACCESS_FROZEN)
		freezeUserDatabaseAccess(passkeyAdminId);
		const frozenRes = await invokeRoute(dbTablesRoute.GET, '/api/database/tables', {
			headers: { cookie: `${SESSION_COOKIE}=${passkeyToken}` },
		});
		assert.equal(frozenRes.status, 403);
		assert.equal(frozenRes.data?.code, 'DATABASE_ACCESS_FROZEN');
		unfreezeUserDatabaseAccess(passkeyAdminId);

		// 4. POST /api/database/auth issues a DB token automatically for passkey sessions (even with empty body)
		const pkDbAuthRes = await invokeRoute(dbAuthRoute.POST, '/api/database/auth', {
			method: 'POST',
			headers: { cookie: `${SESSION_COOKIE}=${passkeyToken}` },
			body: {},
		});
		assert.equal(pkDbAuthRes.status, 200);
		assert.equal(pkDbAuthRes.data?.method, 'passkey');
		assert.ok(typeof pkDbAuthRes.data?.token === 'string' && pkDbAuthRes.data.token.length > 20);

		// 5. Password session requesting method=passkey on /api/database/auth is rejected (403)
		const pwDbAuthRes = await invokeRoute(dbAuthRoute.POST, '/api/database/auth', {
			method: 'POST',
			headers: { cookie: `${SESSION_COOKIE}=${passwordToken}` },
			body: { method: 'passkey' },
		});
		assert.equal(pwDbAuthRes.status, 403);
		assert.equal(pwDbAuthRes.data?.code, 'PASSKEY_SESSION_REQUIRED');

		// 6. Terminal session opens automatically for passkey admin with totp_enabled=0 and no code
		const pkTermRes = await invokeRoute(termSessionRoute.POST, '/api/terminal/session', {
			method: 'POST',
			headers: { cookie: `${SESSION_COOKIE}=${passkeyToken}` },
			body: { cols: 80, rows: 24 },
		});
		assert.equal(pkTermRes.status, 200);
		assert.equal(pkTermRes.data?.authMethod, 'passkey');
		assert.ok(pkTermRes.data?.sessionId);
		createdSessionIds.push(pkTermRes.data.sessionId);

		// 7. Password admin with totp_enabled=0 stays blocked on Terminal (403 2FA_SETUP_REQUIRED)
		const pwTermRes = await invokeRoute(termSessionRoute.POST, '/api/terminal/session', {
			method: 'POST',
			headers: { cookie: `${SESSION_COOKIE}=${passwordToken}` },
			body: { cols: 80, rows: 24 },
		});
		assert.equal(pwTermRes.status, 403);
		assert.equal(pwTermRes.data?.code, '2FA_SETUP_REQUIRED');
	} finally {
		unfreezeUserDatabaseAccess(passkeyAdminId);
		for (const sid of createdSessionIds) {
			await invokeRoute(termSessionRoute.DELETE, `/api/terminal/session?sessionId=${encodeURIComponent(sid)}`, {
				method: 'DELETE',
				headers: { cookie: `${SESSION_COOKIE}=${passkeyToken}` },
			}).catch(() => {
				/* Ignore terminal session teardown errors */
			});
		}
		if (prevTerminalEnabled === undefined) delete process.env.TERMINAL_ENABLED;
		else process.env.TERMINAL_ENABLED = prevTerminalEnabled;
		await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [passkeyAdminId, passwordAdminId]).catch(() => {
			/* Ignore cleanup errors for temporary test admins */
		});
	}
});
