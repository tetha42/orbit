import assert from 'node:assert/strict';
import { consumeRateLimit } from '../../src/lib/rateLimit.ts';
import { clientAddress, parseIpCandidate } from '../../src/lib/http.ts';
import { evaluateSecurityRules, isIpInCidr as isIpInCidrPure, isSafeRegex, matchPathPattern } from '../../src/lib/securityRules.ts';
import {
	computeDocumentDigestWasm,
	initWasmEngine,
	isWasmEngineActive,
	timingSafeEqualWasm,
	verifyCertificateFormatWasm,
} from '../../src/lib/wasm/securityEngine.ts';
import { check, checkAsync } from './runner.mjs';

export function runSecurityAndSseChecks() {
	check('rate limit: fixed window, request frequency does not extend window, keys isolated', () => {
		const real = Date.now;
		let now = 1_000_000;
		Date.now = () => now;
		try {
			for (let i = 0; i < 5; i++) assert.equal(consumeRateLimit('t:a', 5, 60_000).allowed, true);
			// Rejected calls must not push the window forward.
			for (let t = 0; t < 59; t += 10) {
				now = 1_000_000 + t * 1000;
				assert.equal(consumeRateLimit('t:a', 5, 60_000).allowed, false);
			}
			assert.equal(consumeRateLimit('t:b', 5, 60_000).allowed, true);
			now = 1_000_000 + 60_000;
			assert.equal(consumeRateLimit('t:a', 5, 60_000).allowed, true);
		} finally {
			Date.now = real;
		}
	});

	check('clientAddress: prioritizes CF-Connecting-IP over proxy X-Forwarded-For and validates IPs', () => {
		assert.equal(parseIpCandidate('203.0.113.42'), '203.0.113.42');
		assert.equal(parseIpCandidate('203.0.113.42:54321'), '203.0.113.42');
		assert.equal(parseIpCandidate('[2001:db8::1]:443'), '2001:db8::1');
		assert.equal(parseIpCandidate('[2001:DB8:ABCD::1]:443'), '2001:db8:abcd::1');
		assert.equal(parseIpCandidate('2001:db8::1%eth0'), '2001:db8::1');
		assert.equal(parseIpCandidate('unknown'), null);
		assert.equal(parseIpCandidate('not-an-ip'), null);

		const cfReq = new Request('https://beuteknoloji.org/api/auth/login', {
			headers: {
				'cf-connecting-ip': '85.105.44.12',
				'x-real-ip': '172.64.100.5',
				'x-forwarded-for': '172.64.100.5',
			},
		});
		assert.equal(clientAddress(cfReq), '85.105.44.12');

		const trueClientReq = new Request('https://beuteknoloji.org/api/auth/login', {
			headers: {
				'true-client-ip': '2A02:4E0:2D10::1',
				'x-forwarded-for': '104.16.1.1',
			},
		});
		assert.equal(clientAddress(trueClientReq), '2a02:4e0:2d10::1');

		const xffReq = new Request('https://beuteknoloji.org/api/auth/login', {
			headers: {
				'cf-connecting-ip': 'invalid-header',
				'x-forwarded-for': 'unknown, 198.51.100.77:8080, 10.0.0.1',
			},
		});
		assert.equal(clientAddress(xffReq), '198.51.100.77');

		const emptyReq = new Request('https://beuteknoloji.org/api/auth/login');
		assert.equal(clientAddress(emptyReq), 'unknown');
	});

	check('security rules: pure evaluator matches CIDRs, path patterns, methods, headers and ReDoS protection', () => {
		assert.ok(isIpInCidrPure('198.51.100.5', '198.51.100.0/24'));
		assert.ok(!isIpInCidrPure('198.51.101.5', '198.51.100.0/24'));
		assert.ok(isIpInCidrPure('2001:db8:abcd::1', '2001:db8:abcd::/48'));
		assert.ok(!isIpInCidrPure('2001:db8:beef::1', '2001:db8:abcd::/48'));

		assert.ok(matchPathPattern('/api/admin/users', '/api/admin/**'));
		assert.ok(matchPathPattern('/internal/status', '/internal/*'));
		assert.ok(!matchPathPattern('/internal/sub/status', '/internal/*'));

		assert.ok(isSafeRegex('^[a-zA-Z0-9_-]+$'));
		assert.ok(!isSafeRegex('(a+)+'));

		const testRules = [
			{
				id: 'rule_1',
				name: 'Block Bad Subnet',
				enabled: true,
				priority: 10,
				matchMode: 'all',
				conditions: [
					{ type: 'ip_cidr', value: '198.51.100.0/24' },
					{ type: 'path_pattern', value: '/api/admin/**' },
				],
				action: 'block',
			},
		];

		const resMatch = evaluateSecurityRules(testRules, {
			ip: '198.51.100.42',
			pathname: '/api/admin/system',
			method: 'POST',
		});
		assert.strictEqual(resMatch.matched, true);
		assert.strictEqual(resMatch.action, 'block');

		const resNoMatch = evaluateSecurityRules(testRules, {
			ip: '203.0.113.10',
			pathname: '/api/admin/system',
			method: 'POST',
		});
		assert.strictEqual(resNoMatch.matched, false);
	});

	checkAsync('wasm security engine: compiles, loads, verifies credentials and timing-safe checks', async () => {
		const loaded = await initWasmEngine();
		assert.ok(loaded, 'WASM engine should initialize cleanly');
		assert.ok(isWasmEngineActive(), 'isWasmEngineActive should report true');

		const digest = computeDocumentDigestWasm(123, 'Test Title', 2026, 'Content');
		assert.strictEqual(digest, '8EBE-5439-EF46-A157');

		const validDoc = verifyCertificateFormatWasm('ORBIT-DOC-123456');
		assert.strictEqual(validDoc.valid, true);
		assert.strictEqual(validDoc.kind, 'official_doc');

		const validOrbitCert = verifyCertificateFormatWasm('ORB-2026-X442-9988');
		assert.strictEqual(validOrbitCert.valid, true);
		assert.strictEqual(validOrbitCert.kind, 'certificate');

		const validCert = verifyCertificateFormatWasm('ABCD-1234-WXYZ');
		assert.strictEqual(validCert.valid, true);
		assert.strictEqual(validCert.kind, 'certificate');

		const invalidCode = verifyCertificateFormatWasm('not-a-valid-cert');
		assert.strictEqual(invalidCode.valid, false);
		assert.strictEqual(invalidCode.kind, 'unknown');

		assert.ok(timingSafeEqualWasm('secret_token_123', 'secret_token_123'));
		assert.ok(!timingSafeEqualWasm('secret_token_123', 'wrong_token_456'));
	});
}
