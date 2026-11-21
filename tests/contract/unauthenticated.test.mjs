import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { invokeRoute, teardownContractTestResources } from './helper.mjs';

after(teardownContractTestResources);

const PROTECTED_ROUTES = [
	{ path: '/api/auth/me', file: 'auth/me/route.ts', method: 'GET' },
	{ path: '/api/members', file: 'members/route.ts', method: 'GET' },
	{ path: '/api/members', file: 'members/route.ts', method: 'POST', body: {} },
	{ path: '/api/roles', file: 'roles/route.ts', method: 'GET' },
	{ path: '/api/roles', file: 'roles/route.ts', method: 'POST', body: {} },
	{ path: '/api/budget', file: 'budget/route.ts', method: 'GET' },
	{ path: '/api/budget', file: 'budget/route.ts', method: 'POST', body: {} },
	{ path: '/api/events', file: 'events/route.ts', method: 'POST', body: {} },
	{ path: '/api/notes', file: 'notes/route.ts', method: 'GET' },
	{ path: '/api/notes', file: 'notes/route.ts', method: 'POST', body: {} },
	{ path: '/api/decisions', file: 'decisions/route.ts', method: 'GET' },
	{ path: '/api/decisions', file: 'decisions/route.ts', method: 'POST', body: {} },
	{ path: '/api/inventory', file: 'inventory/route.ts', method: 'GET' },
	{ path: '/api/inventory', file: 'inventory/route.ts', method: 'POST', body: {} },
	{ path: '/api/mail', file: 'mail/route.ts', method: 'GET' },
	{ path: '/api/messages', file: 'messages/route.ts', method: 'GET' },
	{ path: '/api/certificates', file: 'certificates/route.ts', method: 'GET' },
	{ path: '/api/database/tables', file: 'database/tables/route.ts', method: 'GET' },
	{ path: '/api/soc', file: 'soc/route.ts', method: 'GET' },
	{ path: '/api/profile', file: 'profile/route.ts', method: 'GET' },
	{ path: '/api/profile', file: 'profile/route.ts', method: 'PATCH', body: {} },
	{ path: '/api/profile/photo', file: 'profile/photo/route.ts', method: 'POST', body: {} },
	{ path: '/api/profile/photo', file: 'profile/photo/route.ts', method: 'DELETE' },
	{ path: '/api/profile/password', file: 'profile/password/route.ts', method: 'POST', body: {} },
	{ path: '/api/profile/email', file: 'profile/email/route.ts', method: 'POST', body: {} },
	{ path: '/api/profile/email/confirm', file: 'profile/email/confirm/route.ts', method: 'POST', body: {} },
	{ path: '/api/drive/items', file: 'drive/items/route.ts', method: 'GET' },
	{ path: '/api/drive/folders', file: 'drive/folders/route.ts', method: 'GET' },
	{ path: '/api/chat/messages', file: 'chat/messages/route.ts', method: 'PATCH', body: {} },
	{ path: '/api/upload', file: 'upload/route.ts', method: 'POST', body: {} },
	{ path: '/api/stream', file: 'stream/route.ts', method: 'GET' },
	{ path: '/api/soc/stream', file: 'soc/stream/route.ts', method: 'GET' },
	{ path: '/api/chat/stream', file: 'chat/stream/route.ts', method: 'GET' },
];

for (const endpoint of PROTECTED_ROUTES) {
	test(`contract: unauthenticated ${endpoint.method} ${endpoint.path} returns 401 or 403, never 500`, async () => {
		const mod = await import(`../../src/app/api/${endpoint.file}`);
		const handler = mod[endpoint.method];
		assert.strictEqual(typeof handler, 'function', `Missing ${endpoint.method} handler in ${endpoint.file}`);

		const res = await invokeRoute(handler, endpoint.path, {
			method: endpoint.method,
			body: endpoint.body,
		});
		assert.notStrictEqual(res.status, 500, `Endpoint ${endpoint.method} ${endpoint.path} failed with 500`);
		assert.ok(
			res.status === 401 || res.status === 403,
			`Expected 401 or 403 for ${endpoint.method} ${endpoint.path}, got ${res.status}`
		);
	});
}
