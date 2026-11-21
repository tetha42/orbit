import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { teardownContractTestResources } from './helper.mjs';

after(teardownContractTestResources);

test('CRIT-05: clientAddress ignores x-orbit-connecting-ip spoofing and respects TRUSTED_PROXY_MODE=none', async () => {
	const { clientAddress } = await import('../../src/lib/http.ts');

	const spoofedReq = new Request('https://orbit.example.com/api/auth/login', {
		headers: {
			'x-orbit-connecting-ip': '203.0.113.99',
			'cf-connecting-ip': '198.51.100.42',
		},
	});
	// Must not return the spoofed x-orbit-connecting-ip (203.0.113.99)
	assert.notEqual(clientAddress(spoofedReq), '203.0.113.99');
	assert.equal(clientAddress(spoofedReq), '198.51.100.42');

	const prevMode = process.env.TRUSTED_PROXY_MODE;
	try {
		process.env.TRUSTED_PROXY_MODE = 'none';
		assert.equal(clientAddress(spoofedReq), '127.0.0.1');
	} finally {
		if (prevMode === undefined) delete process.env.TRUSTED_PROXY_MODE;
		else process.env.TRUSTED_PROXY_MODE = prevMode;
	}
});

test('CRIT-06 & CRIT-07: sqlGuard lexer blocks quoted comment smuggling, multi-statement, and JSON row exfiltration', async () => {
	const { inspectDatabaseSql, maskDatabaseRow } = await import('../../src/lib/waf/sqlGuard.ts');

	// Quoted comment smuggling: SELECT '/*'; COMMIT; UPDATE users ... ; SELECT '*/'
	const smuggled = `SELECT '/*'; COMMIT; UPDATE users SET role_id = 'admin'; SELECT '*/'`;
	const resSmuggled = inspectDatabaseSql(smuggled);
	assert.equal(resSmuggled.allowed, false);

	// Multi-statement stacked query
	const stacked = `SELECT 1; SELECT 2`;
	assert.equal(inspectDatabaseSql(stacked).allowed, false);

	// Transaction control breakout in non-explain query
	assert.equal(inspectDatabaseSql(`COMMIT`).allowed, false);
	assert.equal(inspectDatabaseSql(`SET SESSION AUTHORIZATION DEFAULT`).allowed, false);

	// Whole-row JSON exfiltration on users and system_settings
	assert.equal(inspectDatabaseSql(`SELECT row_to_json(u) FROM users u`).allowed, false);
	assert.equal(inspectDatabaseSql(`SELECT to_jsonb(s) FROM system_settings s`).allowed, false);

	// Direct reference to auth_secret or soc_webhook_config on system_settings
	assert.equal(
		inspectDatabaseSql(`SELECT value FROM system_settings WHERE key = 'auth_secret'`).allowed,
		false
	);

	// Legitimate read-only query remains allowed
	assert.equal(inspectDatabaseSql(`SELECT id, email, role_id FROM users LIMIT 10`).allowed, true);

	// maskDatabaseRow masks auth_secret, smtp_pass, and soc_webhook_config
	assert.equal(maskDatabaseRow({ key: 'auth_secret', value: 'raw-secret' }).value, '••••••••');
	assert.equal(maskDatabaseRow({ key: 'soc_webhook_config', value: '{"botToken":"123"}' }).value, '••••••••');
});

test('HIGH-01 & MED-03: AppSec probe HMAC validation and strict OAuth redirect_uri query matching', async () => {
	const { createAppSecProbeToken, isValidAppSecProbe } = await import(
		'../../src/lib/auth/guard/probeAuth.ts'
	);
	const { isRedirectUriRegistered } = await import(
		'../../src/app/api/oauth/authorize/authorizeHelpers.ts'
	);

	const spoofProbe = new Request('http://127.0.0.1:3000/api/admin/config', {
		headers: { 'x-appsec-probe': '1' },
	});
	assert.equal(isValidAppSecProbe(spoofProbe), false);

	const validProbe = new Request('http://127.0.0.1:3000/api/admin/config', {
		headers: { 'x-appsec-probe': createAppSecProbeToken() },
	});
	assert.equal(isValidAppSecProbe(validProbe), true);

	// OAuth redirect_uri must reject unapproved query parameters or hash fragments
	const registered = ['https://client.example.com/oauth/callback'];
	assert.equal(
		isRedirectUriRegistered(registered, 'https://client.example.com/oauth/callback'),
		true
	);
	assert.equal(
		isRedirectUriRegistered(registered, 'https://client.example.com/oauth/callback?next=https://evil.test'),
		false
	);
});
