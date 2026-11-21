import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { registerTsAliasHooks } from '../../scripts/ts-loader.mjs';
import { createMockRequest, invokeRoute, teardownContractTestResources } from './helper.mjs';

registerTsAliasHooks();
after(teardownContractTestResources);

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const DESKTOP_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function extractCookieToken(headers, cookieName) {
	const raw = headers.get('set-cookie') || '';
	const match = raw.match(new RegExp(`${cookieName}=([^;]+)`));
	return match ? match[1] : null;
}

async function createDeviceRole(pool, roleId, name, policy = {}) {
	const allowMobile = policy.allowMobileAccess ?? true;
	const allowDesktop = policy.allowDesktopAccess ?? true;
	const desktopPolicy = policy.desktopAuthPolicy ?? 'standard';
	await pool.query(
		`INSERT INTO roles (
			id, name, color, description, permissions, is_system, require_2fa,
			allow_mobile_access, allow_desktop_access, desktop_auth_policy, created_at
		) VALUES ($1, $2, '#6366f1', 'Devices contract test role', '{}'::jsonb, 0, 0, $3, $4, $5, $6)`,
		[roleId, name, allowMobile, allowDesktop, desktopPolicy, Date.now()]
	);
}

async function createDeviceUser(pool, { id, roleId, passwordHash = 'unused', totpEnabled = 0 }) {
	const now = Date.now();
	await pool.query(
		`INSERT INTO users (
			id, first_name, last_name, email, password_hash, department, status, role_id,
			auth_method, totp_enabled, created_at
		) VALUES ($1, 'Device', 'Tester', $2, $3, 'Contract', 'active', $4, 'password', $5, $6)`,
		[id, `${id}@orbit.local`, passwordHash, roleId, totpEnabled, now]
	);
}

test('multi-device sessions: single active mobile eviction, up to 4 concurrent desktops, and /api/auth/devices CRUD', async () => {
	const { ensurePostgresInit, getPgPool, getUserById } = await import('../../src/db/index.ts');
	const { establishSession, SESSION_COOKIE } = await import('../../src/lib/auth/session.ts');
	const { dropRoleCache } = await import('../../src/db/roles/queries.ts');
	const devicesRoute = await import('../../src/app/api/auth/devices/route.ts');
	const deviceDetailRoute = await import('../../src/app/api/auth/devices/[sessionId]/route.ts');
	const revokeOthersRoute = await import('../../src/app/api/auth/devices/revoke-others/route.ts');

	await ensurePostgresInit();
	const pool = getPgPool();
	const testStartTs = Date.now();
	const stamp = `${process.pid}_${testStartTs}`;
	const roleId = `role_ct_dev_${stamp}`;
	const userId = `usr_ct_dev_${stamp}`;

	await createDeviceRole(pool, roleId, `DevicesRole_${stamp}`);
	dropRoleCache();
	await createDeviceUser(pool, { id: userId, roleId });
	const user = await getUserById(userId);
	assert.ok(user);

	try {
		// 1. Mobile session 1 created -> active
		const mobileReq1 = await createMockRequest('/api/auth/login', {
			headers: { 'user-agent': MOBILE_UA },
		});
		const mobileToken1 = await establishSession(user, mobileReq1, 'password');

		const listM1 = await invokeRoute(devicesRoute.GET, '/api/auth/devices', {
			headers: { cookie: `${SESSION_COOKIE}=${mobileToken1}` },
		});
		assert.equal(listM1.status, 200);
		assert.equal(listM1.data?.sessions?.length, 1);
		assert.equal(listM1.data.sessions[0].deviceClass, 'mobile');
		assert.equal(listM1.data.sessions[0].isCurrent, true);

		// 2. Mobile session 2 created -> evicts mobile session 1 cleanly
		const mobileReq2 = await createMockRequest('/api/auth/login', {
			headers: { 'user-agent': `${MOBILE_UA} App/2` },
		});
		const mobileToken2 = await establishSession(user, mobileReq2, 'password');

		const evictedRes = await invokeRoute(devicesRoute.GET, '/api/auth/devices', {
			headers: { cookie: `${SESSION_COOKIE}=${mobileToken1}` },
		});
		assert.equal(evictedRes.status, 401);

		const listM2 = await invokeRoute(devicesRoute.GET, '/api/auth/devices', {
			headers: { cookie: `${SESSION_COOKIE}=${mobileToken2}` },
		});
		assert.equal(listM2.status, 200);
		assert.equal(listM2.data?.sessions?.length, 1);
		assert.equal(listM2.data.sessions[0].isCurrent, true);

		// 3. Up to 4 desktop sessions stay active concurrently alongside mobile session 2
		const desktopTokens = [];
		for (let i = 0; i < 4; i++) {
			await new Promise((r) => setTimeout(r, 2));
			const deskReq = await createMockRequest('/api/auth/login', {
				headers: { 'user-agent': `${DESKTOP_UA} Tab/${i}` },
			});
			desktopTokens.push(await establishSession(user, deskReq, 'password'));
		}

		const list5 = await invokeRoute(devicesRoute.GET, '/api/auth/devices', {
			headers: { cookie: `${SESSION_COOKIE}=${desktopTokens[3]}` },
		});
		assert.equal(list5.status, 200);
		assert.equal(list5.data?.sessions?.length, 5);
		assert.equal(list5.data.sessions.filter((s) => s.deviceClass === 'desktop').length, 4);
		assert.equal(list5.data.sessions.filter((s) => s.deviceClass === 'mobile').length, 1);

		// Registering a 5th desktop session evicts oldest desktop while preserving mobile session 2
		await new Promise((r) => setTimeout(r, 2));
		const deskReq5 = await createMockRequest('/api/auth/login', {
			headers: { 'user-agent': `${DESKTOP_UA} Tab/4` },
		});
		const desktopToken5 = await establishSession(user, deskReq5, 'password');

		const oldestEvicted = await invokeRoute(devicesRoute.GET, '/api/auth/devices', {
			headers: { cookie: `${SESSION_COOKIE}=${desktopTokens[0]}` },
		});
		assert.equal(oldestEvicted.status, 401);

		const listCapped = await invokeRoute(devicesRoute.GET, '/api/auth/devices', {
			headers: { cookie: `${SESSION_COOKIE}=${desktopToken5}` },
		});
		assert.equal(listCapped.status, 200);
		assert.equal(listCapped.data.sessions.filter((s) => s.deviceClass === 'desktop').length, 4);
		assert.equal(listCapped.data.sessions.filter((s) => s.deviceClass === 'mobile').length, 1);

		// 4. DELETE /api/auth/devices/[sessionId] revokes a targeted desktop session
		const targetSession = listCapped.data.sessions.find((s) => s.deviceClass === 'desktop' && !s.isCurrent);
		assert.ok(targetSession?.id);
		const delRes = await invokeRoute(
			deviceDetailRoute.DELETE,
			`/api/auth/devices/${encodeURIComponent(targetSession.id)}`,
			{
				method: 'DELETE',
				headers: { cookie: `${SESSION_COOKIE}=${desktopToken5}` },
				context: { params: Promise.resolve({ sessionId: targetSession.id }) },
			}
		);
		assert.equal(delRes.status, 200);
		assert.equal(delRes.data?.ok, true);
		assert.equal(delRes.data?.revokedId, targetSession.id);

		const missingDel = await invokeRoute(
			deviceDetailRoute.DELETE,
			'/api/auth/devices/ses_nonexistent_000',
			{
				method: 'DELETE',
				headers: { cookie: `${SESSION_COOKIE}=${desktopToken5}` },
				context: { params: Promise.resolve({ sessionId: 'ses_nonexistent_000' }) },
			}
		);
		assert.equal(missingDel.status, 404);

		// 5. POST /api/auth/devices/revoke-others leaves only current session active
		const revokeOthersRes = await invokeRoute(revokeOthersRoute.POST, '/api/auth/devices/revoke-others', {
			method: 'POST',
			headers: { cookie: `${SESSION_COOKIE}=${desktopToken5}` },
		});
		assert.equal(revokeOthersRes.status, 200);
		assert.equal(revokeOthersRes.data?.ok, true);
		assert.ok(revokeOthersRes.data?.revokedCount >= 3);

		const remainingRes = await invokeRoute(devicesRoute.GET, '/api/auth/devices', {
			headers: { cookie: `${SESSION_COOKIE}=${desktopToken5}` },
		});
		assert.equal(remainingRes.status, 200);
		assert.equal(remainingRes.data?.sessions?.length, 1);
		assert.equal(remainingRes.data.sessions[0].isCurrent, true);

		const mobileAfterRevoke = await invokeRoute(devicesRoute.GET, '/api/auth/devices', {
			headers: { cookie: `${SESSION_COOKIE}=${mobileToken2}` },
		});
		assert.equal(mobileAfterRevoke.status, 401);
	} finally {
		await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM audit_logs WHERE actor_id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM system_logs WHERE user_id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM roles WHERE id = $1', [roleId]).catch(() => {
			/* ignore test cleanup failure */
		});
		dropRoleCache();
	}
});

test('role device policy enforcement on POST /api/auth/login', async () => {
	const { ensurePostgresInit, getPgPool } = await import('../../src/db/index.ts');
	const { SESSION_COOKIE } = await import('../../src/lib/auth/session.ts');
	const { dropRoleCache } = await import('../../src/db/roles/queries.ts');
	const { clearRateLimit } = await import('../../src/lib/rateLimit.ts');
	const loginRoute = await import('../../src/app/api/auth/login/route.ts');

	await ensurePostgresInit();
	const pool = getPgPool();
	const testStartTs = Date.now();
	const stamp = `${process.pid}_${testStartTs}`;
	const roleId = `role_ct_pol_${stamp}`;
	const userId = `usr_ct_pol_${stamp}`;
	const email = `${userId}@orbit.local`;
	const password = 'OrbitPolicyTest!42';
	const passwordHash = await bcrypt.hash(password, 4);

	await createDeviceRole(pool, roleId, `PolicyRole_${stamp}`, {
		allowMobileAccess: false,
		allowDesktopAccess: true,
		desktopAuthPolicy: 'standard',
	});
	dropRoleCache();
	await createDeviceUser(pool, { id: userId, roleId, passwordHash, totpEnabled: 0 });

	try {
		// 1. allow_mobile_access = false blocks mobile UA login (403), allows desktop UA
		const mobileBlocked = await invokeRoute(loginRoute.POST, '/api/auth/login', {
			method: 'POST',
			headers: { 'user-agent': MOBILE_UA },
			body: { email, password },
		});
		assert.equal(mobileBlocked.status, 403);
		assert.equal(mobileBlocked.data?.code, 'MOBILE_ACCESS_DENIED');

		const desktopAllowed = await invokeRoute(loginRoute.POST, '/api/auth/login', {
			method: 'POST',
			headers: { 'user-agent': DESKTOP_UA },
			body: { email, password },
		});
		assert.equal(desktopAllowed.status, 200);
		assert.equal(desktopAllowed.data?.success, true);
		assert.ok(extractCookieToken(desktopAllowed.headers, SESSION_COOKIE));

		// 2. allow_desktop_access = false blocks desktop UA login (403), allows mobile UA
		await pool.query(
			`UPDATE roles SET allow_mobile_access = TRUE, allow_desktop_access = FALSE WHERE id = $1`,
			[roleId]
		);
		const desktopBlocked = await invokeRoute(loginRoute.POST, '/api/auth/login', {
			method: 'POST',
			headers: { 'user-agent': DESKTOP_UA },
			body: { email, password },
		});
		assert.equal(desktopBlocked.status, 403);
		assert.equal(desktopBlocked.data?.code, 'DESKTOP_ACCESS_DENIED');

		const mobileAllowed = await invokeRoute(loginRoute.POST, '/api/auth/login', {
			method: 'POST',
			headers: { 'user-agent': MOBILE_UA },
			body: { email, password },
		});
		assert.equal(mobileAllowed.status, 200);
		assert.equal(mobileAllowed.data?.success, true);
		assert.ok(extractCookieToken(mobileAllowed.headers, SESSION_COOKIE));

		// 3. desktop_auth_policy = 'mobile_required' forces mobile/2FA challenge on desktop
		await pool.query(
			`UPDATE roles SET allow_desktop_access = TRUE, desktop_auth_policy = 'mobile_required' WHERE id = $1`,
			[roleId]
		);
		const requiredChallenge = await invokeRoute(loginRoute.POST, '/api/auth/login', {
			method: 'POST',
			headers: { 'user-agent': DESKTOP_UA },
			body: { email, password },
		});
		assert.equal(requiredChallenge.status, 200);
		assert.equal(requiredChallenge.data?.success, false);
		assert.equal(requiredChallenge.data?.require2fa, true);
		assert.equal(requiredChallenge.data?.mobileApprovalAvailable, true);
		assert.ok(typeof requiredChallenge.data?.challengeToken === 'string' && requiredChallenge.data.challengeToken.length > 20);
		assert.equal(extractCookieToken(requiredChallenge.headers, SESSION_COOKIE), null);

		// 4. desktop_auth_policy = 'mobile_preferred' challenges when mobile is linked, succeeds directly when unlinked
		await pool.query(`UPDATE roles SET desktop_auth_policy = 'mobile_preferred' WHERE id = $1`, [roleId]);
		const preferredChallenge = await invokeRoute(loginRoute.POST, '/api/auth/login', {
			method: 'POST',
			headers: { 'user-agent': DESKTOP_UA },
			body: { email, password },
		});
		assert.equal(preferredChallenge.status, 200);
		assert.equal(preferredChallenge.data?.require2fa, true);
		assert.equal(preferredChallenge.data?.mobileApprovalAvailable, true);

		await pool.query(`UPDATE user_sessions SET revoked_at = $2 WHERE user_id = $1 AND device_class = 'mobile'`, [
			userId,
			Date.now(),
		]);
		const preferredDirect = await invokeRoute(loginRoute.POST, '/api/auth/login', {
			method: 'POST',
			headers: { 'user-agent': DESKTOP_UA },
			body: { email, password },
		});
		assert.equal(preferredDirect.status, 200);
		assert.equal(preferredDirect.data?.success, true);
		assert.ok(extractCookieToken(preferredDirect.headers, SESSION_COOKIE));
	} finally {
		clearRateLimit(`login:account:${email}`);
		clearRateLimit(`login:burst:acct:${email}`);
		clearRateLimit('login:burst:ip:127.0.0.1');
		clearRateLimit('login:ip:127.0.0.1');
		await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM audit_logs WHERE actor_id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM system_logs WHERE user_id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM roles WHERE id = $1', [roleId]).catch(() => {
			/* ignore test cleanup failure */
		});
		dropRoleCache();
	}
});

test('E-Devlet 2-digit approval, 6-digit code verification, and cross-device passkey options', async () => {
	const { ensurePostgresInit, getPgPool, getUserById } = await import('../../src/db/index.ts');
	const { establishSession, SESSION_COOKIE } = await import('../../src/lib/auth/session.ts');
	const { createLoginChallenge } = await import('../../src/lib/auth/authToken.ts');
	const { dropRoleCache } = await import('../../src/db/roles/queries.ts');
	const { clearRateLimit } = await import('../../src/lib/rateLimit.ts');
	const approvalStartRoute = await import('../../src/app/api/auth/devices/approval/start/route.ts');
	const approvalPendingRoute = await import('../../src/app/api/auth/devices/approval/pending/route.ts');
	const approvalRespondRoute = await import('../../src/app/api/auth/devices/approval/respond/route.ts');
	const approvalPollRoute = await import('../../src/app/api/auth/devices/approval/poll/route.ts');
	const verifyCodeRoute = await import('../../src/app/api/auth/devices/approval/verify-code/route.ts');
	const passkeyOptsRoute = await import('../../src/app/api/auth/passkey/login/options/route.ts');
	const devicesRoute = await import('../../src/app/api/auth/devices/route.ts');

	await ensurePostgresInit();
	const pool = getPgPool();
	const testStartTs = Date.now();
	const stamp = `${process.pid}_${testStartTs}`;
	const roleId = `role_ct_apv_${stamp}`;
	const userId = `usr_ct_apv_${stamp}`;
	const email = `${userId}@orbit.local`;
	const credentialId = crypto.randomBytes(32).toString('base64url');

	await createDeviceRole(pool, roleId, `ApprovalRole_${stamp}`, {
		desktopAuthPolicy: 'mobile_required',
	});
	dropRoleCache();
	await createDeviceUser(pool, { id: userId, roleId });
	const user = await getUserById(userId);
	assert.ok(user);

	await pool.query(
		`INSERT INTO webauthn_credentials (id, user_id, public_key, counter, transports, device_type, backed_up, nickname, created_at)
		 VALUES ($1, $2, $3, 0, 'internal', 'singleDevice', 0, 'Phone Key', $4)`,
		[credentialId, userId, crypto.randomBytes(32).toString('base64url'), Date.now()]
	);

	const createdApprovalIds = [];
	try {
		const mobileReq = await createMockRequest('/api/auth/login', {
			headers: { 'user-agent': MOBILE_UA },
		});
		const mobileToken = await establishSession(user, mobileReq, 'password');
		const mobileCookie = `${SESSION_COOKIE}=${mobileToken}`;

		// 1. Start approval challenge and fail with wrong 2-digit number
		const challenge1 = await createLoginChallenge(userId);
		const start1 = await invokeRoute(approvalStartRoute.POST, '/api/auth/devices/approval/start', {
			method: 'POST',
			headers: { 'user-agent': DESKTOP_UA },
			body: { challengeToken: challenge1, mode: 'push' },
		});
		assert.equal(start1.status, 200);
		assert.equal(start1.data?.ok, true);
		const approvalId1 = start1.data.approvalId;
		createdApprovalIds.push(approvalId1);
		const challengeNum1 = start1.data.challengeNumber;
		assert.ok(challengeNum1 >= 10 && challengeNum1 <= 99);

		const pending1 = await invokeRoute(approvalPendingRoute.GET, '/api/auth/devices/approval/pending', {
			headers: { cookie: mobileCookie },
		});
		assert.equal(pending1.status, 200);
		const item1 = pending1.data?.approvals?.find((a) => a.id === approvalId1);
		assert.ok(item1);
		assert.equal(item1.numberOptions.length, 3);
		assert.ok(item1.numberOptions.includes(challengeNum1));
		assert.match(String(item1.mobileDisplayCode || ''), /^\d{6}$/);

		const wrongNum = item1.numberOptions.find((n) => n !== challengeNum1);
		const wrongRespond = await invokeRoute(approvalRespondRoute.POST, '/api/auth/devices/approval/respond', {
			method: 'POST',
			headers: { cookie: mobileCookie },
			body: { approvalId: approvalId1, decision: 'approve', selectedNumber: wrongNum },
		});
		assert.equal(wrongRespond.status, 403);

		const pollRejected = await invokeRoute(approvalPollRoute.POST, '/api/auth/devices/approval/poll', {
			method: 'POST',
			headers: { 'user-agent': DESKTOP_UA },
			body: { approvalId: approvalId1, pollSecret: start1.data.pollSecret },
		});
		assert.equal(pollRejected.status, 200);
		assert.equal(pollRejected.data?.status, 'rejected');
		assert.equal(extractCookieToken(pollRejected.headers, SESSION_COOKIE), null);

		// 2. Correct 2-digit number approval issues session cookie & consumes challenge
		const challenge2 = await createLoginChallenge(userId);
		const start2 = await invokeRoute(approvalStartRoute.POST, '/api/auth/devices/approval/start', {
			method: 'POST',
			headers: { 'user-agent': DESKTOP_UA },
			body: { challengeToken: challenge2, mode: 'push' },
		});
		assert.equal(start2.status, 200);
		const approvalId2 = start2.data.approvalId;
		createdApprovalIds.push(approvalId2);

		const approveRes = await invokeRoute(approvalRespondRoute.POST, '/api/auth/devices/approval/respond', {
			method: 'POST',
			headers: { cookie: mobileCookie },
			body: { approvalId: approvalId2, decision: 'approve', selectedNumber: start2.data.challengeNumber },
		});
		assert.equal(approveRes.status, 200);
		assert.equal(approveRes.data?.status, 'approved');

		const pollApproved = await invokeRoute(approvalPollRoute.POST, '/api/auth/devices/approval/poll', {
			method: 'POST',
			headers: { 'user-agent': DESKTOP_UA },
			body: { approvalId: approvalId2, pollSecret: start2.data.pollSecret },
		});
		assert.equal(pollApproved.status, 200);
		assert.equal(pollApproved.data?.status, 'approved');
		const issuedDesktopToken = extractCookieToken(pollApproved.headers, SESSION_COOKIE);
		assert.ok(issuedDesktopToken);

		const checkSession = await invokeRoute(devicesRoute.GET, '/api/auth/devices', {
			headers: { cookie: `${SESSION_COOKIE}=${issuedDesktopToken}` },
		});
		assert.equal(checkSession.status, 200);

		const replayPoll = await invokeRoute(approvalPollRoute.POST, '/api/auth/devices/approval/poll', {
			method: 'POST',
			headers: { 'user-agent': DESKTOP_UA },
			body: { approvalId: approvalId2, pollSecret: start2.data.pollSecret },
		});
		assert.equal(replayPoll.data?.status, 'consumed');

		// 3. 6-digit code verification flow
		const challenge3 = await createLoginChallenge(userId);
		const start3 = await invokeRoute(approvalStartRoute.POST, '/api/auth/devices/approval/start', {
			method: 'POST',
			headers: { 'user-agent': DESKTOP_UA },
			body: { challengeToken: challenge3, mode: 'code' },
		});
		assert.equal(start3.status, 200);
		const approvalId3 = start3.data.approvalId;
		createdApprovalIds.push(approvalId3);

		const pending3 = await invokeRoute(approvalPendingRoute.GET, '/api/auth/devices/approval/pending', {
			headers: { cookie: mobileCookie },
		});
		const item3 = pending3.data?.approvals?.find((a) => a.id === approvalId3);
		assert.ok(item3?.mobileDisplayCode);

		const wrongCode = item3.mobileDisplayCode === '000000' ? '111111' : '000000';
		const badCodeRes = await invokeRoute(verifyCodeRoute.POST, '/api/auth/devices/approval/verify-code', {
			method: 'POST',
			headers: { 'user-agent': DESKTOP_UA },
			body: { approvalId: approvalId3, pollSecret: start3.data.pollSecret, code: wrongCode },
		});
		assert.equal(badCodeRes.status, 400);

		const goodCodeRes = await invokeRoute(verifyCodeRoute.POST, '/api/auth/devices/approval/verify-code', {
			method: 'POST',
			headers: { 'user-agent': DESKTOP_UA },
			body: { approvalId: approvalId3, pollSecret: start3.data.pollSecret, code: item3.mobileDisplayCode },
		});
		assert.equal(goodCodeRes.status, 200);
		assert.equal(goodCodeRes.data?.success, true);
		assert.ok(extractCookieToken(goodCodeRes.headers, SESSION_COOKIE));

		// 4. Hybrid / cross-device Passkey login options enforce userVerification='required' and hybrid transport
		const passkeyRes = await invokeRoute(passkeyOptsRoute.POST, '/api/auth/passkey/login/options', {
			method: 'POST',
			body: { email },
		});
		assert.equal(passkeyRes.status, 200);
		assert.equal(passkeyRes.data?.success, true);
		assert.equal(passkeyRes.data?.options?.userVerification, 'required');
		const transports = passkeyRes.data?.options?.allowCredentials?.[0]?.transports || [];
		assert.ok(transports.includes('hybrid'));
		assert.ok(transports.includes('internal'));
	} finally {
		clearRateLimit('devices:approval:start:127.0.0.1');
		clearRateLimit('passkey:options:ip:127.0.0.1');
		if (createdApprovalIds.length > 0) {
			await pool.query('DELETE FROM device_login_approvals WHERE id = ANY($1)', [createdApprovalIds]).catch(() => {
				/* ignore test cleanup failure */
			});
		}
		await pool.query('DELETE FROM device_login_approvals WHERE user_id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM webauthn_challenges WHERE user_id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM webauthn_credentials WHERE user_id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool
			.query("DELETE FROM audit_logs WHERE actor_id = $1 OR (actor_id IS NULL AND action LIKE 'auth.devices.approval%' AND timestamp >= $2)", [
				userId,
				testStartTs,
			])
			.catch(() => {
				/* ignore test cleanup failure */
			});
		await pool.query('DELETE FROM system_logs WHERE user_id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM roles WHERE id = $1', [roleId]).catch(() => {
			/* ignore test cleanup failure */
		});
		dropRoleCache();
	}
});

test('web push crypto & dispatcher: builds ES256 VAPID header, encrypts aes128gcm payload, delivers and prunes 410 subscriptions', async () => {
	const { ensurePostgresInit, getPgPool, getUserById } = await import('../../src/db/index.ts');
	const { establishSession } = await import('../../src/lib/auth/session.ts');
	const { findActiveDeviceSessionByToken } = await import('../../src/domains/devices/sessionStore.ts');
	const { dropRoleCache } = await import('../../src/db/roles/queries.ts');
	const { b64UrlDecode, buildVapidAuthorizationHeader, encryptWebPushPayload } = await import(
		'../../src/domains/devices/webPushCrypto.ts'
	);
	const { dispatchWebPushToUser, saveUserPushSubscription } = await import('../../src/domains/devices/webPush.ts');

	await ensurePostgresInit();
	const pool = getPgPool();
	const stamp = `${process.pid}_${Date.now()}`;
	const roleId = `role_ct_push_${stamp}`;
	const userId = `usr_ct_push_${stamp}`;

	const vapidPair = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
	const jwk = vapidPair.privateKey.export({ format: 'jwk' });
	const vapidPubB64 = Buffer.concat([
		Buffer.from([0x04]),
		b64UrlDecode(jwk.x),
		b64UrlDecode(jwk.y),
	]).toString('base64url');

	const uaEcdh = crypto.createECDH('prime256v1');
	uaEcdh.generateKeys();
	const uaPublic = uaEcdh.getPublicKey();
	const uaAuth = crypto.randomBytes(16);

	// 1. Direct VAPID JWT + RFC 8291 encryption/decryption roundtrip
	const endpointActive = `https://push.example.test/sub/active_${stamp}`;
	const endpointGone = `https://push.example.test/sub/gone_${stamp}`;
	const authHeader = buildVapidAuthorizationHeader(
		endpointActive,
		'mailto:push-test@orbit.local',
		vapidPubB64,
		jwk.d,
		1_800_000_000
	);
	const headerMatch = authHeader.match(/^vapid t=([^,]+),\s*k=(.+)$/);
	assert.ok(headerMatch);
	assert.equal(headerMatch[2], vapidPubB64);
	const [hdrB64, payB64, sigB64] = headerMatch[1].split('.');
	const claims = JSON.parse(b64UrlDecode(payB64).toString('utf8'));
	assert.equal(claims.aud, 'https://push.example.test');
	assert.equal(claims.sub, 'mailto:push-test@orbit.local');
	assert.equal(claims.exp, 1_800_000_000 + 12 * 3600);
	const verifiedSig = crypto.verify(
		'sha256',
		Buffer.from(`${hdrB64}.${payB64}`, 'utf8'),
		{ key: vapidPair.publicKey, dsaEncoding: 'ieee-p1363' },
		b64UrlDecode(sigB64)
	);
	assert.equal(verifiedSig, true);

	const samplePayload = { title: 'Orbit Login Approval', body: 'Desktop login', data: { approvalId: 'dla_1' } };
	const encrypted = encryptWebPushPayload(JSON.stringify(samplePayload), uaPublic.toString('base64url'), uaAuth.toString('base64url'));
	const salt = encrypted.subarray(0, 16);
	const idLen = encrypted.readUInt8(20);
	const asPublic = encrypted.subarray(21, 21 + idLen);
	const encAndTag = encrypted.subarray(21 + idLen);
	const ecdhSecret = uaEcdh.computeSecret(asPublic);
	const ikm = Buffer.from(
		crypto.hkdfSync('sha256', ecdhSecret, uaAuth, Buffer.concat([Buffer.from('WebPush: info\0', 'utf8'), uaPublic, asPublic]), 32)
	);
	const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16));
	const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12));
	const decipher = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
	decipher.setAuthTag(encAndTag.subarray(encAndTag.length - 16));
	const plain = Buffer.concat([decipher.update(encAndTag.subarray(0, -16)), decipher.final()]);
	assert.equal(plain[plain.length - 1], 0x02);
	assert.deepEqual(JSON.parse(plain.subarray(0, -1).toString('utf8')), samplePayload);

	// 2. End-to-end DB dispatch & 410 pruning
	const prevPub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
	const prevPriv = process.env.VAPID_PRIVATE_KEY;
	const prevSubj = process.env.VAPID_SUBJECT;
	process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = vapidPubB64;
	process.env.VAPID_PRIVATE_KEY = jwk.d;
	process.env.VAPID_SUBJECT = 'mailto:push-test@orbit.local';

	await createDeviceRole(pool, roleId, `PushRole_${stamp}`);
	dropRoleCache();
	await createDeviceUser(pool, { id: userId, roleId });
	const pushUser = await getUserById(userId);
	assert.ok(pushUser);
	const mobReq = await createMockRequest('/api/auth/login', { headers: { 'user-agent': MOBILE_UA } });
	const mobToken = await establishSession(pushUser, mobReq, 'password');
	const devSession = await findActiveDeviceSessionByToken(mobToken);
	assert.ok(devSession?.id);

	try {
		await saveUserPushSubscription({
			userId,
			sessionId: devSession.id,
			subscription: { endpoint: endpointActive, keys: { p256dh: uaPublic.toString('base64url'), auth: uaAuth.toString('base64url') } },
		});
		await saveUserPushSubscription({
			userId,
			sessionId: null,
			subscription: { endpoint: endpointGone, keys: { p256dh: uaPublic.toString('base64url'), auth: uaAuth.toString('base64url') } },
		});
		// Non-HTTPS endpoint must be skipped by SSRF guard
		await saveUserPushSubscription({
			userId,
			sessionId: devSession.id,
			subscription: { endpoint: 'http://127.0.0.1:9999/internal', keys: { p256dh: uaPublic.toString('base64url'), auth: uaAuth.toString('base64url') } },
		});

		const calls = [];
		const result = await dispatchWebPushToUser(userId, samplePayload, {
			fetchImpl: async (url, init) => {
				calls.push({ url: String(url), headers: init?.headers });
				if (String(url) === endpointGone) return new Response(null, { status: 410 });
				return new Response(null, { status: 201 });
			},
		});

		assert.equal(result.attempted, 3);
		assert.equal(result.delivered, 1);
		assert.equal(result.pruned, 1);
		assert.equal(calls.length, 2);
		assert.ok(calls.every((c) => !c.url.startsWith('http://127.0.0.1')));

		const remaining = await pool.query('SELECT endpoint FROM push_subscriptions WHERE user_id = $1', [userId]);
		const remainingEndpoints = remaining.rows.map((r) => r.endpoint);
		assert.equal(remainingEndpoints.includes(endpointActive), true);
		assert.equal(remainingEndpoints.includes(endpointGone), false);
	} finally {
		if (prevPub === undefined) delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
		else process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = prevPub;
		if (prevPriv === undefined) delete process.env.VAPID_PRIVATE_KEY;
		else process.env.VAPID_PRIVATE_KEY = prevPriv;
		if (prevSubj === undefined) delete process.env.VAPID_SUBJECT;
		else process.env.VAPID_SUBJECT = prevSubj;

		await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM roles WHERE id = $1', [roleId]).catch(() => {
			/* ignore test cleanup failure */
		});
		dropRoleCache();
	}
});
