import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { invokeRoute, teardownContractTestResources } from './helper.mjs';

after(teardownContractTestResources);

const ROOT = process.cwd();

test('setupSession: validates HMAC session cookies and enforces strict opt-in dev auto-unlock', async () => {
	const { NextResponse } = await import('next/server');
	const {
		SETUP_SESSION_COOKIE,
		attachSetupSessionCookie,
		createSetupSessionValue,
		hasValidSetupSessionCookie,
		isDevAutoUnlockAllowed,
	} = await import('../../src/lib/setupSession.ts');

	const tokenA = '0123456789abcdef0123456789abcdef';
	const tokenB = 'fedcba9876543210fedcba9876543210';
	const res = attachSetupSessionCookie(
		NextResponse.json({ ok: true }),
		new Request('http://127.0.0.1:3000/api/setup/unlock'),
		tokenA
	);
	const setCookie = res.headers.get('set-cookie') || '';
	assert.ok(setCookie.includes(`${SETUP_SESSION_COOKIE}=`));
	assert.ok(setCookie.includes('HttpOnly'));
	assert.ok(setCookie.toLowerCase().includes('samesite=strict'));

	const validValue = createSetupSessionValue(tokenA);
	const cookieReq = new Request('http://127.0.0.1:3000/api/setup/test-db', {
		headers: { cookie: `other=1; ${SETUP_SESSION_COOKIE}=${validValue}` },
	});
	assert.equal(hasValidSetupSessionCookie(cookieReq, tokenA), true);
	assert.equal(hasValidSetupSessionCookie(cookieReq, tokenB), false);
	assert.equal(hasValidSetupSessionCookie(cookieReq, null), false);

	const tamperedReq = new Request('http://127.0.0.1:3000/api/setup/test-db', {
		headers: { cookie: `${SETUP_SESSION_COOKIE}=0000` },
	});
	assert.equal(hasValidSetupSessionCookie(tamperedReq, tokenA), false);

	const prevNodeEnv = process.env.NODE_ENV;
	const prevAuto = process.env.ORBIT_DEV_AUTO_UNLOCK;
	try {
		const loopbackReq = new Request('http://localhost:3000/api/setup/unlock', {
			headers: { host: 'localhost:3000', 'x-orbit-connecting-ip': '127.0.0.1' },
		});
		const proxiedReq = new Request('http://localhost:3000/api/setup/unlock', {
			headers: {
				host: 'localhost:3000',
				'x-orbit-connecting-ip': '127.0.0.1',
				'x-forwarded-for': '203.0.113.10',
			},
		});

		process.env.NODE_ENV = 'development';
		delete process.env.ORBIT_DEV_AUTO_UNLOCK;
		assert.equal(isDevAutoUnlockAllowed(loopbackReq), false);

		process.env.ORBIT_DEV_AUTO_UNLOCK = '1';
		assert.equal(isDevAutoUnlockAllowed(loopbackReq), true);
		assert.equal(isDevAutoUnlockAllowed(proxiedReq), false);

		process.env.NODE_ENV = 'production';
		assert.equal(isDevAutoUnlockAllowed(loopbackReq), false);
	} finally {
		if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
		else process.env.NODE_ENV = prevNodeEnv;
		if (prevAuto === undefined) delete process.env.ORBIT_DEV_AUTO_UNLOCK;
		else process.env.ORBIT_DEV_AUTO_UNLOCK = prevAuto;
	}
});

test('config provenance: masks secrets accurately and reports source precedence', async () => {
	const { collectConfigProvenance, maskConfigValue } = await import('../../src/server/config/provenance.ts');

	assert.equal(
		maskConfigValue('DATABASE_URL', 'postgresql://orbit:supersecret@127.0.0.1:5432/orbit', true),
		'postgresql://orbit:****@127.0.0.1:5432/orbit'
	);
	const maskedSecret = maskConfigValue('AUTH_SECRET', 'my-secret-value', true);
	assert.equal(maskedSecret.includes('my-secret-value'), false);
	assert.ok(maskedSecret.includes('<set'));

	const prevClub = process.env.CLUB_NAME;
	try {
		process.env.CLUB_NAME = 'Provenance Env Club';
		const entries = collectConfigProvenance(ROOT);
		const clubEntry = entries.find((e) => e.key === 'CLUB_NAME');
		assert.ok(clubEntry);
		assert.equal(clubEntry.value, 'Provenance Env Club');
		assert.equal(clubEntry.source, 'env');
		assert.equal(clubEntry.configured, true);
	} finally {
		if (prevClub === undefined) delete process.env.CLUB_NAME;
		else process.env.CLUB_NAME = prevClub;
	}
});

test('setup unlock route & shared test-db guard: exchanges token for HttpOnly cookie and enforces App Router exports', async () => {
	const unlockRoute = await import('../../src/app/api/setup/unlock/route.ts');
	const allowedKeys = new Set(['dynamic', 'GET', 'POST']);
	for (const key of Object.keys(unlockRoute)) {
		assert.ok(allowedKeys.has(key), `Disallowed Next.js route export in setup/unlock/route.ts: ${key}`);
	}
	assert.equal(typeof unlockRoute.GET, 'function');
	assert.equal(typeof unlockRoute.POST, 'function');

	const { isSetupLocked, resolveSetupUrl } = await import('../../src/lib/setup.ts');
	assert.equal(
		resolveSetupUrl('0123456789abcdef0123456789abcdef', 'https://orbit.example.com'),
		'https://orbit.example.com/setup#token=0123456789abcdef0123456789abcdef'
	);
	if (isSetupLocked()) {
		const lockedRes = await invokeRoute(unlockRoute.GET, '/api/setup/unlock');
		assert.equal(lockedRes.status, 403);
		return;
	}

	const dataDir = join(ROOT, 'data');
	const tokenPath = join(dataDir, 'orbit.setup.token');
	const hadTokenFile = existsSync(tokenPath);
	const prevTokenContent = hadTokenFile ? readFileSync(tokenPath, 'utf8') : null;
	const testToken = 'abcdef0123456789abcdef0123456789';

	const { globalForPg } = await import('../../src/db/core/pool.ts');
	const { CONFIG } = await import('../../src/server/config.ts');
	const { resetSetupCache } = await import('../../src/app/api/setup/setupService.ts');
	const testDbRoute = await import('../../src/app/api/setup/test-db/route.ts');

	const prevBootstrap = process.env.BOOTSTRAP_ADMIN_PASSWORD;
	const prevDbUrl = process.env.DATABASE_URL;
	const prevConfigDbUrl = CONFIG.database.url;
	const prevPool = globalForPg.__pgPool;
	const prevAutoUnlock = process.env.ORBIT_DEV_AUTO_UNLOCK;

	try {
		mkdirSync(dataDir, { recursive: true });
		writeFileSync(tokenPath, testToken, { encoding: 'utf8', mode: 0o600 });
		delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
		delete process.env.ORBIT_DEV_AUTO_UNLOCK;
		globalForPg.__pgPool = undefined;
		process.env.DATABASE_URL = '';
		CONFIG.database.url = '';
		resetSetupCache();

		const lockedStatus = await invokeRoute(unlockRoute.GET, '/api/setup/unlock', {
			headers: { 'x-orbit-connecting-ip': '127.0.0.42', 'cf-connecting-ip': '127.0.0.42' },
		});
		assert.equal(lockedStatus.status, 200);
		assert.equal(lockedStatus.data.tokenRequired, true);
		assert.equal(lockedStatus.data.unlocked, false);

		const badUnlock = await invokeRoute(unlockRoute.POST, '/api/setup/unlock', {
			method: 'POST',
			headers: { 'x-orbit-connecting-ip': '127.0.0.42', 'cf-connecting-ip': '127.0.0.42' },
			body: { token: '00000000000000000000000000000000' },
		});
		assert.equal(badUnlock.status, 403);
		assert.equal(badUnlock.data.code, 'SETUP_TOKEN_REQUIRED');

		const goodUnlock = await invokeRoute(unlockRoute.POST, '/api/setup/unlock', {
			method: 'POST',
			headers: { 'x-orbit-connecting-ip': '127.0.0.42', 'cf-connecting-ip': '127.0.0.42' },
			body: { token: testToken },
		});
		assert.equal(goodUnlock.status, 200);
		assert.equal(goodUnlock.data.unlocked, true);

		const setCookie = goodUnlock.headers.get('set-cookie') || '';
		const cookiePair = setCookie.split(';')[0];
		assert.ok(cookiePair.startsWith('orbit_setup_session='));
		assert.ok(setCookie.includes('HttpOnly'));
		assert.ok(setCookie.toLowerCase().includes('samesite=strict'));

		const unlockedStatus = await invokeRoute(unlockRoute.GET, '/api/setup/unlock', {
			headers: {
				cookie: cookiePair,
				'x-orbit-connecting-ip': '127.0.0.42',
				'cf-connecting-ip': '127.0.0.42',
			},
		});
		assert.equal(unlockedStatus.status, 200);
		assert.equal(unlockedStatus.data.unlocked, true);

		const unauthedDbRes = await invokeRoute(testDbRoute.POST, '/api/setup/test-db', {
			method: 'POST',
			headers: { 'x-orbit-connecting-ip': '127.0.0.43', 'cf-connecting-ip': '127.0.0.43' },
			body: { url: '' },
		});
		assert.equal(unauthedDbRes.status, 403);

		const authedDbRes = await invokeRoute(testDbRoute.POST, '/api/setup/test-db', {
			method: 'POST',
			headers: {
				cookie: cookiePair,
				'x-orbit-connecting-ip': '127.0.0.42',
				'cf-connecting-ip': '127.0.0.42',
			},
			body: { url: '' },
		});
		assert.equal(authedDbRes.status, 400);
	} finally {
		if (hadTokenFile && prevTokenContent !== null) {
			writeFileSync(tokenPath, prevTokenContent, { encoding: 'utf8', mode: 0o600 });
		} else if (!hadTokenFile && existsSync(tokenPath)) {
			unlinkSync(tokenPath);
		}
		if (prevBootstrap === undefined) delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
		else process.env.BOOTSTRAP_ADMIN_PASSWORD = prevBootstrap;
		if (prevDbUrl === undefined) delete process.env.DATABASE_URL;
		else process.env.DATABASE_URL = prevDbUrl;
		if (prevAutoUnlock === undefined) delete process.env.ORBIT_DEV_AUTO_UNLOCK;
		else process.env.ORBIT_DEV_AUTO_UNLOCK = prevAutoUnlock;
		CONFIG.database.url = prevConfigDbUrl;
		globalForPg.__pgPool = prevPool;
		resetSetupCache();
	}
});

test('orbit CLI JSON contracts: help, setup status, db status, and doctor respond deterministically', () => {
	const orbitBin = join(ROOT, 'bin', 'orbit');
	const runJson = (cliArgs) => {
		const out = execFileSync(orbitBin, cliArgs, { cwd: ROOT, encoding: 'utf8' });
		return JSON.parse(out);
	};

	const help = runJson(['help', '--json']);
	assert.ok(Array.isArray(help.commands));
	for (const cmd of ['doctor', 'dev', 'db up', 'setup url']) {
		assert.ok(help.commands.includes(cmd), `Missing CLI command in help: ${cmd}`);
	}

	const setupStatus = runJson(['setup', 'status', '--json']);
	assert.equal(setupStatus.ok, true);
	assert.equal(typeof setupStatus.locked, 'boolean');

	const dbStatus = runJson(['db', 'status', '--json']);
	assert.equal(dbStatus.ok, true);
	assert.equal(typeof dbStatus.connected, 'boolean');

	const doctor = runJson(['doctor', '--json']);
	assert.equal(doctor.ok, true);
	assert.ok(Array.isArray(doctor.checks) && doctor.checks.length >= 6);
	assert.ok(Array.isArray(doctor.config) && doctor.config.length >= 6);
});
