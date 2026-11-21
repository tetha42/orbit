import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { invokeRoute, teardownContractTestResources } from './helper.mjs';

after(teardownContractTestResources);

test('contract: /api/soc/rules and /api/soc/rules/test require authentication', async () => {
	const rulesRoute = await import('../../src/app/api/soc/rules/route.ts');
	const testRoute = await import('../../src/app/api/soc/rules/test/route.ts');

	const getRes = await invokeRoute(rulesRoute.GET, '/api/soc/rules');
	assert.ok(getRes.status === 401 || getRes.status === 403, `Expected 401/403, got ${getRes.status}`);

	const postRes = await invokeRoute(rulesRoute.POST, '/api/soc/rules', {
		method: 'POST',
		body: { name: 'Test Rule', action: 'block', conditions: [{ type: 'path_pattern', value: '/api/test' }] },
	});
	assert.ok(postRes.status === 401 || postRes.status === 403, `Expected 401/403, got ${postRes.status}`);

	const deleteRes = await invokeRoute(rulesRoute.DELETE, '/api/soc/rules?id=rule_probe', {
		method: 'DELETE',
	});
	assert.ok(deleteRes.status === 401 || deleteRes.status === 403, `Expected 401/403, got ${deleteRes.status}`);

	const simRes = await invokeRoute(testRoute.POST, '/api/soc/rules/test', {
		method: 'POST',
		body: { mockRequest: { ip: '198.51.100.5', pathname: '/api/admin', method: 'GET' } },
	});
	assert.ok(simRes.status === 401 || simRes.status === 403, `Expected 401/403, got ${simRes.status}`);
});

test('contract: security rule engine evaluates priority, CIDRs, wildcards, and ReDoS rejection', async () => {
	const {
		evaluateSecurityRules,
		isSafeRegex,
		matchPathPattern,
		isIpInCidr,
	} = await import('../../src/lib/securityRules.ts');

	assert.strictEqual(isSafeRegex('(a+)+$'), false);
	assert.strictEqual(isSafeRegex('a'.repeat(260)), false);
	assert.strictEqual(isSafeRegex('^/api/admin/[a-z0-9-]+$'), true);

	assert.strictEqual(matchPathPattern('/api/members/export', '/api/*/export'), true);
	assert.strictEqual(matchPathPattern('/api/members/export', '/api/soc/*'), false);
	assert.strictEqual(isIpInCidr('10.20.30.40', '10.20.0.0/16'), true);
	assert.strictEqual(isIpInCidr('192.168.1.5', '10.20.0.0/16'), false);

	const rules = [
		{
			id: 'r-block',
			name: 'Block Export CIDR',
			enabled: true,
			priority: 20,
			matchMode: 'all',
			action: 'block',
			conditions: [
				{ type: 'ip_cidr', value: '203.0.113.0/24' },
				{ type: 'path_pattern', value: '/api/**/export' },
			],
		},
		{
			id: 'r-allow-admin',
			name: 'Allow Health Monitor',
			enabled: true,
			priority: 5,
			matchMode: 'all',
			action: 'allow',
			conditions: [
				{ type: 'ip_cidr', value: '203.0.113.10/32' },
				{ type: 'header', field: 'x-monitor-key', operator: 'exists', value: '' },
			],
		},
	];

	const allowed = evaluateSecurityRules(rules, {
		ip: '203.0.113.10',
		pathname: '/api/soc/export',
		method: 'GET',
		headers: { 'x-monitor-key': 'ok' },
	});
	assert.strictEqual(allowed.matched, true);
	assert.strictEqual(allowed.action, 'allow');
	assert.strictEqual(allowed.rule?.id, 'r-allow-admin');

	const blocked = evaluateSecurityRules(rules, {
		ip: '203.0.113.42',
		pathname: '/api/soc/export',
		method: 'GET',
	});
	assert.strictEqual(blocked.matched, true);
	assert.strictEqual(blocked.action, 'block');
	assert.strictEqual(blocked.rule?.id, 'r-block');
});
