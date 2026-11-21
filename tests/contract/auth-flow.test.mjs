import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { invokeRoute, teardownContractTestResources } from './helper.mjs';

after(teardownContractTestResources);

test('contract: auth flow validates me/login/logout deterministically without 500s', async () => {
	const meRoute = await import('../../src/app/api/auth/me/route.ts');
	const loginRoute = await import('../../src/app/api/auth/login/route.ts');
	const logoutRoute = await import('../../src/app/api/auth/logout/route.ts');

	// 1. Unauthenticated /api/auth/me must reject with 401/403
	const meRes = await invokeRoute(meRoute.GET, '/api/auth/me');
	assert.ok(meRes.status === 401 || meRes.status === 403, `Expected 401/403, got ${meRes.status}`);

	// 2. Malformed login payload returns 400
	const badBodyRes = await invokeRoute(loginRoute.POST, '/api/auth/login', {
		method: 'POST',
		body: { email: 'incomplete@orbit.local' },
	});
	assert.strictEqual(badBodyRes.status, 400);

	// 3. Invalid credentials return 401 (never 500)
	const loginRes = await invokeRoute(loginRoute.POST, '/api/auth/login', {
		method: 'POST',
		headers: { 'cf-connecting-ip': '198.51.100.21' },
		body: { email: 'nonexistent@orbit.local', password: 'WrongPassword123!' },
	});
	assert.notStrictEqual(loginRes.status, 500, 'Login must not throw 500');
	assert.ok(
		loginRes.status === 400 || loginRes.status === 401,
		`Expected 400 or 401 for invalid credentials, got ${loginRes.status}`
	);

	// 4. Logout clears cookie and returns 200
	const logoutRes = await invokeRoute(logoutRoute.POST, '/api/auth/logout', { method: 'POST' });
	assert.strictEqual(logoutRes.status, 200);
	assert.strictEqual(logoutRes.data?.success, true);
	const setCookie = logoutRes.headers.get('set-cookie') || '';
	assert.ok(setCookie.length > 0, 'Logout response must emit Set-Cookie deletion header');
});

test('contract: WebAuthn repositories and /api/auth/passkey return createdAt and lastUsage aliases', async () => {
	const {
		ensurePostgresInit,
		getPgPool,
		saveWebauthnCredential,
		updateWebauthnCounter,
		getWebauthnCredentials,
		getWebauthnCredentialById,
		listUserWebauthnCredentials,
	} = await import('../../src/db/index.ts');
	const { SESSION_COOKIE } = await import('../../src/lib/auth/session.ts');
	const passkeyRoute = await import('../../src/app/api/auth/passkey/route.ts');

	await ensurePostgresInit();
	const pool = getPgPool();
	const userId = `usr_webauthn_${process.pid}_${Date.now()}`;
	const credId = `cred_${process.pid}_${Date.now()}`;
	const sessionToken = crypto.randomBytes(32).toString('base64url');

	await pool.query(
		`INSERT INTO users (
			id, first_name, last_name, email, password_hash, department, status, role_id,
			session_token, session_expires_at, auth_method, totp_enabled, created_at
		) VALUES ($1, 'Passkey', 'Contract', $2, 'unused', 'Security', 'active', 'role_member', $3, $4, 'passkey', 0, $5)`,
		[userId, `${userId}@orbit.local`, sessionToken, Date.now() + 600_000, Date.now()]
	);

	try {
		await saveWebauthnCredential({
			id: credId,
			userId,
			publicKey: 'cHVibGljLWtleQ',
			counter: 0,
			transports: 'internal',
			deviceType: 'singleDevice',
			backedUp: true,
			nickname: 'Contract Key',
		});
		await updateWebauthnCounter(credId, 1);

		const byId = await getWebauthnCredentialById(credId);
		assert.ok(byId);
		assert.strictEqual(typeof byId.createdAt, 'number');
		assert.ok(Number(byId.lastUsage) > 0, `Expected lastUsage > 0, got ${byId.lastUsage}`);
		assert.strictEqual('lastUsed' in byId, false);

		const fromSettings = await getWebauthnCredentials(userId);
		assert.strictEqual(fromSettings.length, 1);
		assert.strictEqual(typeof fromSettings[0].createdAt, 'number');
		assert.ok(Number(fromSettings[0].lastUsage) > 0);
		assert.strictEqual('lastUsed' in fromSettings[0], false);

		const fromAuth = await listUserWebauthnCredentials(userId);
		assert.strictEqual(fromAuth.length, 1);
		assert.strictEqual(typeof fromAuth[0].createdAt, 'number');
		assert.ok(Number(fromAuth[0].lastUsage) > 0);
		assert.strictEqual('creation' in fromAuth[0], false);

		const apiRes = await invokeRoute(passkeyRoute.GET, '/api/auth/passkey', {
			headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` },
		});
		assert.strictEqual(apiRes.status, 200);
		assert.strictEqual(apiRes.data?.passkeys?.length, 1);
		assert.strictEqual(typeof apiRes.data.passkeys[0].createdAt, 'number');
		assert.ok(Number(apiRes.data.passkeys[0].lastUsage) > 0);
	} finally {
		await pool.query('DELETE FROM webauthn_credentials WHERE id = $1', [credId]).catch(() => {});
		await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {});
	}
});
