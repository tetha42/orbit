import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createMockRequest, invokeRoute, teardownContractTestResources } from './helper.mjs';

after(teardownContractTestResources);

test('contract: auth login rate limiter enforces 429 + Retry-After upon burst traffic', async () => {
	const loginRoute = await import('../../src/app/api/auth/login/route.ts');
	const pidLo = (process.pid & 254) || 1;
	const pidHi = (process.pid >> 8) & 255;

	// 1. Account burst limiter triggers 429 after 10 requests across distributed IPs without triggering IP ban
	const targetEmail = `burst-acct-${process.pid}@orbit.local`;
	let account429 = false;
	for (let i = 1; i <= 15; i++) {
		const ip = `198.18.${(pidHi + i) & 255}.${pidLo}`;
		const res = await invokeRoute(loginRoute.POST, '/api/auth/login', {
			method: 'POST',
			headers: { 'x-forwarded-for': ip, 'cf-connecting-ip': ip },
			body: { email: targetEmail, password: 'Random123456!' },
		});
		if (res.status === 429) {
			account429 = true;
			const retryAfter = res.headers.get('retry-after');
			assert.ok(retryAfter !== null && Number(retryAfter) >= 1, `Expected positive Retry-After header, got ${retryAfter}`);
			break;
		}
	}
	assert.ok(account429, 'Expected 429 Too Many Requests from per-account burst limiter');

	// 2. Per-IP burst limiter enforces 429 + Retry-After after 30 requests
	const burstIp = `198.18.${(pidHi + 100) & 255}.${pidLo}`;
	let ip429 = false;
	for (let i = 0; i < 35; i++) {
		const res = await invokeRoute(loginRoute.POST, '/api/auth/login', {
			method: 'POST',
			headers: { 'x-forwarded-for': burstIp, 'cf-connecting-ip': burstIp },
			body: { email: `ip-burst-${i}@orbit.local` },
		});
		if (res.status === 429) {
			ip429 = true;
			const retryAfter = res.headers.get('retry-after');
			assert.ok(retryAfter !== null && Number(retryAfter) >= 1, `Expected positive Retry-After header, got ${retryAfter}`);
			break;
		}
	}
	assert.ok(ip429, 'Expected 429 Too Many Requests from per-IP burst limiter');
});

test('contract: proxy auth flood limiter and primitive rate-limit bucket semantics', async () => {
	const { consumeRateLimit } = await import('../../src/lib/rateLimit.ts');
	const { proxy } = await import('../../src/proxy.ts');

	const key = `test:bucket:${Date.now()}`;
	assert.strictEqual(consumeRateLimit(key, 2, 10_000).allowed, true);
	assert.strictEqual(consumeRateLimit(key, 2, 10_000).allowed, true);
	const blocked = consumeRateLimit(key, 2, 10_000);
	assert.strictEqual(blocked.allowed, false);
	assert.ok(blocked.retryAfter >= 1);

	let proxyBlocked = false;
	for (let i = 0; i < 45; i++) {
		const req = await createMockRequest('/api/auth/login', {
			method: 'POST',
			headers: { 'cf-connecting-ip': '198.51.100.199' },
		});
		const res = proxy(req);
		if (res.status === 429) {
			proxyBlocked = true;
			assert.ok(res.headers.get('retry-after') !== null);
			break;
		}
	}
	assert.ok(proxyBlocked, 'Proxy should rate limit excessive /api/auth/* requests');
});
