import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from './helper.mjs';

test('contract: /api/healthz reports database status', async (t) => {
	try {
		const res = await request('/api/healthz');
		assert.ok(
			res.status === 200 || res.status === 503,
			`Expected status 200 or 503, got ${res.status}`
		);
		assert.ok(res.data && typeof res.data === 'object', 'Expected JSON object');
		assert.ok('database' in res.data, 'Expected database field in health response');
		if (res.status === 200) {
			assert.strictEqual(res.data.status, 'healthy');
			assert.strictEqual(res.data.database, 'connected');
		} else {
			assert.strictEqual(res.data.status, 'unhealthy');
		}
	} catch (err) {
		if (err.cause?.code === 'ECONNREFUSED') {
			t.skip('Server not booted; skipped offline contract test');
			return;
		}
		throw err;
	}
});
