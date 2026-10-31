import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from './helper.mjs';

test('contract: auth rate limiter triggers 429 upon excessive requests', async (t) => {
	try {
		let got429 = false;
		// Send 35 requests to /api/auth/login with a dedicated test IP header
		const testHeaders = { 'x-forwarded-for': '198.51.100.99', 'cf-connecting-ip': '198.51.100.99' };

		for (let i = 0; i < 35; i++) {
			const res = await request('/api/auth/login', {
				method: 'POST',
				headers: testHeaders,
				body: { eposta: `rate-${i}@orbit.local`, sifre: 'Random123456!' },
			});
			if (res.status === 429) {
				got429 = true;
				assert.ok(res.headers.get('retry-after') !== null, '429 response must include Retry-After header');
				break;
			}
		}

		assert.ok(got429, 'Expected at least one 429 Too Many Requests response within 35 requests');
	} catch (err) {
		if (err.cause?.code === 'ECONNREFUSED') {
			t.skip('Server not booted; skipped offline contract test');
			return;
		}
		throw err;
	}
});
