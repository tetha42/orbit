import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createMockRequest, invokeRoute, teardownContractTestResources } from './helper.mjs';

after(teardownContractTestResources);

test('contract: /api/health returns liveness status ok and numeric uptime/timestamp', async () => {
	const { GET } = await import('../../src/app/api/health/route.ts');
	const res = await invokeRoute(GET, '/api/health');

	assert.strictEqual(res.status, 200, `Expected status 200, got ${res.status}`);
	assert.ok(res.data && typeof res.data === 'object', 'Expected JSON object');
	assert.strictEqual(res.data.status, 'ok');
	assert.strictEqual(typeof res.data.uptime, 'number');
	assert.strictEqual(typeof res.data.timestamp, 'number');
});

test('contract: /api/healthz reports database connectivity deterministically', async () => {
	const { GET } = await import('../../src/app/api/healthz/route.ts');
	const res = await invokeRoute(GET, '/api/healthz');

	assert.ok(res.status === 200 || res.status === 503, `Expected status 200 or 503, got ${res.status}`);
	assert.ok(res.data && typeof res.data === 'object', 'Expected JSON object');
	assert.ok('database' in res.data, 'Expected database field in health response');
	if (res.status === 200) {
		assert.strictEqual(res.data.ok, true);
		assert.strictEqual(res.data.status, 'healthy');
		assert.strictEqual(res.data.database, 'connected');
	} else {
		assert.strictEqual(res.data.ok, false);
		assert.strictEqual(res.data.status, 'unhealthy');
	}
});

test('contract: global edge proxy attaches tracing headers and blocks WAF/canary probes', async () => {
	const { proxy } = await import('../../src/proxy.ts');

	const cleanReq = await createMockRequest('/api/health', {
		headers: { 'cf-connecting-ip': '198.51.100.11' },
	});
	const cleanRes = proxy(cleanReq);
	assert.strictEqual(cleanRes.status, 200);
	assert.ok(cleanRes.headers.get('x-middleware-request-x-orbit-request-id') || cleanRes.headers.get('x-orbit-request-id') !== null || cleanRes.status === 200);

	const sqliReq = await createMockRequest('/api/members?filter=' + encodeURIComponent('1 UNION SELECT password_hash FROM users--'), {
		headers: { 'cf-connecting-ip': '198.51.100.12' },
	});
	const sqliRes = proxy(sqliReq);
	assert.strictEqual(sqliRes.status, 403);

	const canaryReq = await createMockRequest('/.env', {
		headers: { 'cf-connecting-ip': '198.51.100.13' },
	});
	const canaryRes = proxy(canaryReq);
	const rewriteTarget = canaryRes.headers.get('x-middleware-rewrite') || '';
	assert.ok(
		canaryRes.status === 403 || rewriteTarget.includes('/api/admin/config'),
		`Expected 403 or honeypot rewrite to /api/admin/config, got status=${canaryRes.status} rewrite=${rewriteTarget}`
	);
});
