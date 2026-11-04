import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from './helper.mjs';

const PROTECTED_ROUTES = [
	{ path: '/api/auth/me', method: 'GET' },
	{ path: '/api/members', method: 'GET' },
	{ path: '/api/members', method: 'POST', body: {} },
	{ path: '/api/roles', method: 'GET' },
	{ path: '/api/roles', method: 'POST', body: {} },
	{ path: '/api/budget', method: 'GET' },
	{ path: '/api/budget', method: 'POST', body: {} },
	{ path: '/api/events', method: 'POST', body: {} },
	{ path: '/api/notes', method: 'GET' },
	{ path: '/api/notes', method: 'POST', body: {} },
	{ path: '/api/decisions', method: 'GET' },
	{ path: '/api/decisions', method: 'POST', body: {} },
	{ path: '/api/inventory', method: 'GET' },
	{ path: '/api/inventory', method: 'POST', body: {} },
	{ path: '/api/mail', method: 'GET' },
	{ path: '/api/messages', method: 'GET' },
	{ path: '/api/certificates', method: 'GET' },
	{ path: '/api/database/tables', method: 'GET' },
	{ path: '/api/soc', method: 'GET' },
	{ path: '/api/profile/workspace', method: 'GET' },
	{ path: '/api/profile/workspace', method: 'PUT', body: {} },
];

for (const endpoint of PROTECTED_ROUTES) {
	test(`contract: unauthenticated ${endpoint.method} ${endpoint.path} returns 401 or 403, never 500`, async (t) => {
		try {
			const res = await request(endpoint.path, {
				method: endpoint.method,
				body: endpoint.body,
			});
			assert.notStrictEqual(res.status, 500, `Endpoint ${endpoint.path} failed with 500 Internal Server Error`);
			assert.ok(
				res.status === 401 || res.status === 403,
				`Expected 401 or 403 for ${endpoint.method} ${endpoint.path}, got ${res.status}`
			);
		} catch (err) {
			if (err.cause?.code === 'ECONNREFUSED') {
				t.skip('Server not booted; skipped offline contract test');
				return;
			}
			throw err;
		}
	});
}
