import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from './helper.mjs';

test('contract: DB Studio mutate blocked without break-glass flag', async (t) => {
	try {
		const mutateRes = await request('/api/database/mutate', {
			method: 'POST',
			body: { table: 'users', operation: 'insert', data: { email: 'probe@orbit.local' } },
		});
		// Unauthenticated requests should get 401/403; even with auth, without break-glass it returns 403 DB_STUDIO_READ_ONLY
		assert.ok(
			mutateRes.status === 401 || mutateRes.status === 403,
			`Expected 401 or 403 for mutate, got ${mutateRes.status}`
		);

		const importRes = await request('/api/database/import', {
			method: 'POST',
			body: { table: 'users', rows: [{ email: 'probe@orbit.local' }] },
		});
		assert.ok(
			importRes.status === 401 || importRes.status === 403,
			`Expected 401 or 403 for import, got ${importRes.status}`
		);
	} catch (err) {
		if (err.cause?.code === 'ECONNREFUSED') {
			t.skip('Server not booted; skipped offline contract test');
			return;
		}
		throw err;
	}
});

test('contract: DB Studio query enforces read-only guards', async (t) => {
	try {
		const res = await request('/api/database/query', {
			method: 'POST',
			body: { sql: 'DROP TABLE users;' },
		});
		assert.ok(
			res.status === 400 || res.status === 401 || res.status === 403,
			`Expected 400, 401 or 403 for destructive query, got ${res.status}`
		);
	} catch (err) {
		if (err.cause?.code === 'ECONNREFUSED') {
			t.skip('Server not booted; skipped offline contract test');
			return;
		}
		throw err;
	}
});
