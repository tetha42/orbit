import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from './helper.mjs';

test('contract: auth flow (invalid login, logout, me unauthenticated)', async (t) => {
	try {
		// 1. Unauthenticated /api/auth/me should return 401
		const meRes = await request('/api/auth/me');
		assert.ok(meRes.status === 401 || meRes.status === 403, `Expected 401/403, got ${meRes.status}`);

		// 2. Invalid credentials login should return 401 or 400, never 500
		const loginRes = await request('/api/auth/login', {
			method: 'POST',
			body: { eposta: 'nonexistent@orbit.local', sifre: 'WrongPassword123!' },
		});
		assert.notStrictEqual(loginRes.status, 500, 'Login failed with 500');
		assert.ok(
			loginRes.status === 400 || loginRes.status === 401,
			`Expected 400 or 401 for invalid credentials, got ${loginRes.status}`
		);

		// 3. Logout should succeed or return clean 200
		const logoutRes = await request('/api/auth/logout', { method: 'POST' });
		assert.notStrictEqual(logoutRes.status, 500, 'Logout failed with 500');
		assert.strictEqual(logoutRes.status, 200, 'Expected 200 for logout');
	} catch (err) {
		if (err.cause?.code === 'ECONNREFUSED') {
			t.skip('Server not booted; skipped offline contract test');
			return;
		}
		throw err;
	}
});
