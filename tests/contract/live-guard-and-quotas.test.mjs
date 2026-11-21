import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerTsAliasHooks } from '../../scripts/ts-loader.mjs';
import { createMockRequest, invokeRoute, teardownContractTestResources } from './helper.mjs';

registerTsAliasHooks();
after(teardownContractTestResources);

async function allocateFreeTcpPort() {
	return await new Promise((resolve, reject) => {
		const srv = net.createServer();
		srv.unref();
		srv.on('error', reject);
		srv.listen(0, '127.0.0.1', () => {
			const addr = srv.address();
			const port = typeof addr === 'object' && addr ? addr.port : 0;
			srv.close((err) => (err ? reject(err) : resolve(port)));
		});
	});
}

async function waitForUnixSocket(sockPath, timeoutMs = 5000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (existsSync(sockPath)) {
			const connected = await new Promise((resolve) => {
				const client = net.createConnection(sockPath);
				client.once('connect', () => {
					client.end();
					resolve(true);
				});
				client.once('error', () => resolve(false));
			});
			if (connected) return;
		}
		await new Promise((r) => setTimeout(r, 25));
	}
	throw new Error(`Timed out waiting for Unix domain socket: ${sockPath}`);
}

function sendRawUnixJson(sockPath, path, payloadStr) {
	return new Promise((resolve, reject) => {
		const req = http.request(
			{
				socketPath: sockPath,
				path,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(payloadStr),
				},
			},
			(res) => {
				const chunks = [];
				res.on('data', (c) => chunks.push(c));
				res.on('end', () => {
					resolve({
						status: res.statusCode ?? 0,
						headers: res.headers,
						text: Buffer.concat(chunks).toString('utf8'),
					});
				});
			}
		);
		req.on('error', reject);
		req.end(payloadStr);
	});
}

test('live-ipc: compiled Go security-guard Unix socket (0600), FIM baseline parity, and 1 MiB quota', async () => {
	const sandbox = mkdtempSync(join(tmpdir(), 'orbit-live-guard-'));
	const rootDir = join(sandbox, 'repo');
	const baselineDir = join(sandbox, 'baselines');
	const binPath = join(sandbox, 'security-guard-test');
	const sockPath = join(sandbox, 'guard.sock');
	mkdirSync(rootDir, { recursive: true });
	mkdirSync(baselineDir, { recursive: true });

	writeFileSync(join(rootDir, 'app.ts'), 'export const ok = true;\n', 'utf8');
	writeFileSync(join(rootDir, 'config.json'), '{"mode":"safe"}\n', 'utf8');
	writeFileSync(join(rootDir, 'probe.go'), 'package main\nfunc helper() {}\n', 'utf8');

	execFileSync('go', ['build', '-o', binPath, '.'], {
		cwd: join(process.cwd(), 'services', 'security-guard'),
		stdio: 'pipe',
	});

	const port = await allocateFreeTcpPort();
	const child = spawn(binPath, [], {
		env: {
			...process.env,
			PORT: String(port),
			ORBIT_ROOT: rootDir,
			ORBIT_FIM_BASELINE_DIR: baselineDir,
			ORBIT_GUARD_SOCKET: sockPath,
		},
		stdio: 'ignore',
	});

	const prevSocket = process.env.ORBIT_GUARD_SOCKET;
	const prevUrl = process.env.SECURITY_GUARD_URL;
	const prevBase = process.env.ORBIT_FIM_BASELINE_DIR;

	const guardClient = await import('../../src/server/security/securityGuardClient.ts');
	const { runPureNodeFimScan } = await import('../../src/db/repositories/inspection/pureScanner.ts');

	try {
		await waitForUnixSocket(sockPath);
		const mode = statSync(sockPath).mode & 0o777;
		assert.strictEqual(mode, 0o600, `Expected Unix socket mode 0600, got ${mode.toString(8)}`);

		process.env.ORBIT_GUARD_SOCKET = sockPath;
		process.env.SECURITY_GUARD_URL = `http://127.0.0.1:${port}`;
		process.env.ORBIT_FIM_BASELINE_DIR = baselineDir;
		guardClient.resetSecurityGuardClientState();

		const health = await guardClient.checkSecurityGuardHealth();
		assert.strictEqual(health.available, true);
		assert.strictEqual(health.transport, 'unix');

		const waf = await guardClient.inspectWafWithGuard({
			pathname: '/api/members',
			search: '?id=1 UNION SELECT password_hash FROM users--',
		});
		assert.strictEqual(waf?.matched, true);
		assert.strictEqual(waf?.category, 'sqli');
		assert.strictEqual(waf?.points, 65);

		const saved = await guardClient.runFimScanWithGuard('repo', true);
		assert.strictEqual(saved?.baselineSaved, true);
		assert.strictEqual(saved?.scannedFiles, 3);
		const baselineJsonPath = join(baselineDir, 'baseline.json');
		assert.strictEqual(existsSync(baselineJsonPath), true);

		// Mutate workspace and assert Go sidecar + Node pureScanner produce identical anomaly & heuristic results
		writeFileSync(join(rootDir, 'config.json'), '{"mode":"tampered"}\n', 'utf8');
		writeFileSync(join(rootDir, 'evil.php'), '<?php eval($_POST["cmd"]); ?>\n', 'utf8');

		const [goScan, nodeScan] = await Promise.all([
			guardClient.runFimScanWithGuard('repo', false),
			runPureNodeFimScan(rootDir, baselineJsonPath, false, 'repo'),
		]);
		assert.ok(goScan, 'Go FIM scan must return result');

		const goAnomalies = new Map(goScan.anomalies.map((a) => [a.path, a.type]));
		const nodeAnomalies = new Map(nodeScan.anomalies.map((a) => [a.path, a.type]));
		assert.strictEqual(goAnomalies.get('config.json'), 'modified');
		assert.strictEqual(nodeAnomalies.get('config.json'), 'modified');
		assert.strictEqual(goAnomalies.get('evil.php'), 'added');
		assert.strictEqual(nodeAnomalies.get('evil.php'), 'added');
		assert.ok(goScan.suspiciousFiles.some((f) => f.path === 'evil.php'));
		assert.ok(nodeScan.suspiciousFiles.some((f) => f.path === 'evil.php'));

		// 1 MiB MaxBytesReader quota enforced over Unix socket
		const overLimit = JSON.stringify({ pathname: '/api/test', body: 'x'.repeat(1024 * 1024 + 4096) });
		const bigRes = await sendRawUnixJson(sockPath, '/api/waf/inspect', overLimit);
		assert.strictEqual(bigRes.status, 413, `Expected 413 over Unix socket, got ${bigRes.status}`);
	} finally {
		guardClient.resetSecurityGuardClientState();
		if (prevSocket === undefined) delete process.env.ORBIT_GUARD_SOCKET;
		else process.env.ORBIT_GUARD_SOCKET = prevSocket;
		if (prevUrl === undefined) delete process.env.SECURITY_GUARD_URL;
		else process.env.SECURITY_GUARD_URL = prevUrl;
		if (prevBase === undefined) delete process.env.ORBIT_FIM_BASELINE_DIR;
		else process.env.ORBIT_FIM_BASELINE_DIR = prevBase;

		if (!child.killed && child.exitCode === null) {
			child.kill('SIGTERM');
			await Promise.race([
				new Promise((resolve) => child.once('exit', resolve)),
				new Promise((resolve) => setTimeout(() => {
					try { child.kill('SIGKILL'); } catch { /* ignore */ }
					resolve();
				}, 2000)),
			]);
		}
		rmSync(sandbox, { recursive: true, force: true });
	}
});

test('resource-guard: chunked stream quotas abort early and withAudit skips rejected pre-parse', async () => {
	const { PayloadTooLargeError, readBoundedBytes } = await import('../../src/lib/httpBodyGuard.ts');
	const { withAudit } = await import('../../src/lib/audit/withAudit.ts');

	// Streaming request WITHOUT Content-Length aborts before reading entire payload
	let pulledChunks = 0;
	const stream = new ReadableStream({
		pull(controller) {
			pulledChunks += 1;
			if (pulledChunks > 30) {
				controller.close();
				return;
			}
			controller.enqueue(new Uint8Array(32 * 1024));
		},
	});
	const chunkedReq = new Request('http://127.0.0.1:3000/api/upload', {
		method: 'POST',
		duplex: 'half',
		body: stream,
	});
	await assert.rejects(
		() => readBoundedBytes(chunkedReq, 100 * 1024),
		(err) => err instanceof PayloadTooLargeError
	);
	assert.ok(pulledChunks < 10, `Expected early stream termination (<10 pulls), saw ${pulledChunks}`);

	// withAudit must not buffer oversized JSON when wrapped route rejects with 401
	const wrapped = withAudit(
		() => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
		{ action: 'TEST', target: 'probe' }
	);
	const hugeReq = new Request('http://127.0.0.1:3000/api/items', {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'content-length': String(10 * 1024 * 1024) },
		body: '{"ok":true}',
	});
	const res = await wrapped(hugeReq, {});
	assert.strictEqual(res.status, 401);
});

test('authenticated-contracts: upload bounds, db import hygiene, community defaults, and pre-aborted SSE cleanup', async () => {
	const { NextRequest } = await import('next/server');
	const { getPgPool } = await import('../../src/db/index.ts');
	const { ADMIN_ROLE_ID } = await import('../../src/core/permissions/index.ts');
	const { SESSION_COOKIE } = await import('../../src/lib/auth/session.ts');
	const { createDatabaseSessionToken } = await import('../../src/server/databaseAccess.ts');
	const { getStreamQuotaSnapshot, acquireStreamSlot } = await import('../../src/server/sse/streamQuota.ts');

	const pool = getPgPool();
	const userId = `usr_contract_${process.pid}_${Date.now()}`;
	const sessionToken = crypto.randomBytes(32).toString('base64url');
	const cookieHeader = `${SESSION_COOKIE}=${sessionToken}`;
	const prevWriteFlag = process.env.ORBIT_DB_STUDIO_WRITE;

	// Trigger table initialization if fresh DB before inserting ephemeral test user
	const communityRoute = await import('../../src/app/api/settings/community/route.ts');
	await invokeRoute(communityRoute.GET, '/api/settings/community');

	await pool.query(
		`INSERT INTO users (
			id, first_name, last_name, email, password_hash, department, status, role_id,
			session_token, session_expires_at, auth_method, totp_enabled, created_at
		) VALUES ($1, 'Contract', 'Admin', $2, 'not-used', 'Contract', 'active', $3, $4, $5, 'passkey', 1, $6)`,
		[userId, `${userId}@orbit.local`, ADMIN_ROLE_ID, sessionToken, Date.now() + 600_000, Date.now()]
	);

	try {
		// 1. /api/settings/community authenticated GET -> clean contract & no Turkish defaults
		const commRes = await invokeRoute(communityRoute.GET, '/api/settings/community', {
			headers: { cookie: cookieHeader },
		});
		assert.strictEqual(commRes.status, 200);
		assert.strictEqual(typeof commRes.data.clubName, 'string');
		assert.strictEqual(typeof commRes.data.signature1Rank, 'string');
		assert.ok(commRes.data.signature1Rank.length > 0);

		// 2. /api/notifications authenticated GET -> items/counts structure
		const notifRoute = await import('../../src/app/api/notifications/route.ts');
		const notifRes = await invokeRoute(notifRoute.GET, '/api/notifications', {
			headers: { cookie: cookieHeader },
		});
		assert.strictEqual(notifRes.status, 200);
		assert.ok(Array.isArray(notifRes.data.items));
		assert.strictEqual(typeof notifRes.data.counts?.total, 'number');

		// 3. /api/upload rejects declared oversized body (413) and disguised ELF payload (415)
		const uploadRoute = await import('../../src/app/api/upload/route.ts');
		const tooBigReq = await createMockRequest('/api/upload', {
			method: 'POST',
			headers: {
				cookie: cookieHeader,
				'content-type': 'multipart/form-data; boundary=----orbitprobe',
				'content-length': String(999 * 1024 * 1024),
			},
			body: '------orbitprobe--\r\n',
		});
		const tooBigRes = await uploadRoute.POST(tooBigReq);
		assert.strictEqual(tooBigRes.status, 413);

		const elfForm = new FormData();
		elfForm.append('file', new File([new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01])], 'evil.png', { type: 'image/png' }));
		const elfReq = new NextRequest('http://127.0.0.1:3000/api/upload', {
			method: 'POST',
			headers: { cookie: cookieHeader, 'cf-connecting-ip': '127.0.0.1' },
			body: elfForm,
		});
		const elfRes = await uploadRoute.POST(elfReq);
		assert.strictEqual(elfRes.status, 415);

		// 4. /api/database/import rejects non-object rows cleanly (400, never 500)
		process.env.ORBIT_DB_STUDIO_WRITE = '1';
		const dbToken = await createDatabaseSessionToken(userId);
		const importRoute = await import('../../src/app/api/database/import/route.ts');
		const badRowRes = await invokeRoute(importRoute.POST, '/api/database/import', {
			method: 'POST',
			headers: { cookie: cookieHeader, 'x-db-token': dbToken },
			body: { table: 'notes', rows: ['not-an-object'] },
		});
		assert.strictEqual(badRowRes.status, 400);

		const badJsonRes = await invokeRoute(importRoute.POST, '/api/database/import', {
			method: 'POST',
			headers: { cookie: cookieHeader, 'x-db-token': dbToken, 'content-type': 'application/json' },
			body: '{broken-json',
		});
		assert.strictEqual(badJsonRes.status, 400);

		// 4b. Terminal session & input endpoints enforce fail-closed flag and body limits cleanly
		const prevTermEnabled = process.env.TERMINAL_ENABLED;
		const termSessionRoute = await import('../../src/app/api/terminal/session/route.ts');
		const termInputRoute = await import('../../src/app/api/terminal/input/route.ts');
		try {
			delete process.env.TERMINAL_ENABLED;
			const disabledRes = await invokeRoute(termSessionRoute.POST, '/api/terminal/session', {
				method: 'POST',
				headers: { cookie: cookieHeader, 'content-type': 'application/json' },
				body: {},
			});
			assert.strictEqual(disabledRes.status, 403);
			assert.strictEqual(disabledRes.data?.code, 'TERMINAL_DISABLED');

			process.env.TERMINAL_ENABLED = '1';
			const bigTermSess = await invokeRoute(termSessionRoute.POST, '/api/terminal/session', {
				method: 'POST',
				headers: { cookie: cookieHeader, 'content-type': 'application/json' },
				body: { pad: 'x'.repeat(40 * 1024) },
			});
			assert.strictEqual(bigTermSess.status, 413);

			const badTermInput = await invokeRoute(termInputRoute.POST, '/api/terminal/input', {
				method: 'POST',
				headers: { cookie: cookieHeader, 'content-type': 'application/json' },
				body: '{broken',
			});
			assert.strictEqual(badTermInput.status, 400);
		} finally {
			if (prevTermEnabled === undefined) delete process.env.TERMINAL_ENABLED;
			else process.env.TERMINAL_ENABLED = prevTermEnabled;
		}

		// 5. Pre-aborted SSE streams must release quota slots immediately across all channels
		const streamRoute = await import('../../src/app/api/stream/route.ts');
		const socStreamRoute = await import('../../src/app/api/soc/stream/route.ts');
		const chatStreamRoute = await import('../../src/app/api/chat/stream/route.ts');

		for (const [handler, path] of [
			[streamRoute.GET, '/api/stream'],
			[socStreamRoute.GET, '/api/soc/stream'],
			[chatStreamRoute.GET, '/api/chat/stream'],
		]) {
			const ac = new AbortController();
			ac.abort();
			const abortedReq = new NextRequest(`http://127.0.0.1:3000${path}`, {
				headers: { cookie: cookieHeader, 'cf-connecting-ip': '127.0.0.1' },
				signal: ac.signal,
			});
			const sseRes = await handler(abortedReq);
			assert.strictEqual(sseRes.status, 200);
			await sseRes.body?.cancel().catch(() => {});
		}

		// Terminal channel slot lifecycle
		const termSlot = acquireStreamSlot({
			channel: 'terminal',
			userId,
			maxPerUser: 6,
			maxGlobal: 64,
			onEvict: () => {},
		});
		assert.strictEqual(termSlot.ok, true);
		assert.strictEqual(getStreamQuotaSnapshot().terminal, 1);
		if (termSlot.ok) termSlot.release();

		assert.deepStrictEqual(getStreamQuotaSnapshot(), {
			system: 0,
			soc: 0,
			chat: 0,
			terminal: 0,
		});

		// 6. Stage 0: Budget canonical schema + PATCH receiptUrl + transfer guard
		const budgetRoute = await import('../../src/app/api/budget/route.ts');
		const createdBudIds = [];
		const createdInvIds = [];
		const prevCommunityRows = (
			await pool.query(
				`SELECT key, value FROM system_settings WHERE key = ANY($1)`,
				[['club_name', 'organization_name', 'signature1_rank', 'signatory_1_title']]
			)
		).rows;
		try {
			const createBud = await invokeRoute(budgetRoute.POST, '/api/budget', {
				method: 'POST',
				headers: { cookie: cookieHeader },
				body: { type: 'income', category: 'sponsorship', amountMinor: 5000, description: 'Contract budget test' },
			});
			assert.strictEqual(createBud.status, 200);
			const budId = createBud.data?.id;
			assert.ok(budId);
			createdBudIds.push(budId);

			const patchReceipt = await invokeRoute(budgetRoute.PATCH, '/api/budget', {
				method: 'PATCH',
				headers: { cookie: cookieHeader },
				body: { id: budId, receiptUrl: '/api/uploads/12345_abcdef.png' },
			});
			assert.strictEqual(patchReceipt.status, 200);

			const listBud = await invokeRoute(budgetRoute.GET, '/api/budget', {
				headers: { cookie: cookieHeader },
			});
			assert.strictEqual(listBud.status, 200);
			const budRec = listBud.data?.records?.find((r) => r.id === budId);
			assert.ok(budRec, 'Created budget record must be returned by GET /api/budget');
			assert.strictEqual(budRec.type, 'income');
			assert.strictEqual(budRec.receiptUrl, '/api/uploads/12345_abcdef.png');
			assert.strictEqual(budRec.recorderName, 'Contract Admin');
			assert.strictEqual(budRec.updaterName, 'Contract Admin');
			assert.strictEqual(typeof budRec.createdAt, 'number');
			assert.strictEqual(typeof budRec.updatedAt, 'number');

			// Transfer guard must reject receiptUrl update on transfer pair rows (409)
			const xferId = `xfer_ct_${Date.now()}`;
			const xferRowId = `bud_ct_x_${Date.now()}`;
			createdBudIds.push(xferRowId);
			await pool.query(
				`INSERT INTO budget_records (id, date, entry_type, category, amount_minor, description, recorded_by, created_at, transfer_pair_id)
				 VALUES ($1, $2, 'expense', 'transfer', 1000, 'Transfer guard probe', $3, $2, $4)`,
				[xferRowId, Date.now(), userId, xferId]
			);
			const guardRes = await invokeRoute(budgetRoute.PATCH, '/api/budget', {
				method: 'PATCH',
				headers: { cookie: cookieHeader },
				body: { id: xferRowId, receiptUrl: '/api/uploads/12345_abcdef.png' },
			});
			assert.strictEqual(guardRes.status, 409);

			// 7. Stage 0: Inventory canonical schema (holderUserId, holderName, dueDate, serialNo, history)
			const invRoute = await import('../../src/app/api/inventory/route.ts');
			const invCode = `CT-${String(Date.now()).slice(-6)}`;
			const createInv = await invokeRoute(invRoute.POST, '/api/inventory', {
				method: 'POST',
				headers: { cookie: cookieHeader },
				body: { action: 'create', code: invCode, name: 'Contract Sensor', category: 'Sensor', location: 'Shelf A', serialNo: 'SN-CT-01' },
			});
			assert.strictEqual(createInv.status, 201);
			const invId = createInv.data?.item?.id;
			assert.ok(invId);
			assert.strictEqual(createInv.data.item.serialNo, 'SN-CT-01');
			createdInvIds.push(invId);

			const borrowInv = await invokeRoute(invRoute.POST, '/api/inventory', {
				method: 'POST',
				headers: { cookie: cookieHeader },
				body: { action: 'borrow', inventoryId: invId, dueDate: Date.now() + 7 * 86_400_000 },
			});
			assert.strictEqual(borrowInv.status, 200);

			const listInv = await invokeRoute(invRoute.GET, '/api/inventory', {
				headers: { cookie: cookieHeader },
			});
			assert.strictEqual(listInv.status, 200);
			const invItem = listInv.data?.find((i) => i.id === invId);
			assert.ok(invItem);
			assert.strictEqual(invItem.holderUserId, userId);
			assert.strictEqual(invItem.holderName, 'Contract Admin');
			assert.strictEqual(invItem.serialNo, 'SN-CT-01');
			assert.strictEqual(typeof invItem.dueDate, 'number');
			assert.strictEqual(typeof invItem.loanDate, 'number');

			const histInv = await invokeRoute(invRoute.GET, `/api/inventory?history=${encodeURIComponent(invId)}`, {
				headers: { cookie: cookieHeader },
			});
			assert.strictEqual(histInv.status, 200);
			assert.ok(histInv.data?.movements?.length >= 2);
			assert.strictEqual(histInv.data.movements[0].type, 'loan');
			assert.strictEqual(histInv.data.movements[0].actorName, 'Contract Admin');
			assert.strictEqual(histInv.data.movements[0].userName, 'Contract Admin');

			// 8. Stage 0: Community settings key sync (/api/settings/community -> /api/community)
			const communityPublicRoute = await import('../../src/app/api/community/route.ts');
			const patchComm = await invokeRoute(communityRoute.PATCH, '/api/settings/community', {
				method: 'PATCH',
				headers: { cookie: cookieHeader },
				body: { clubName: 'Orbit Sync Test', signature1Rank: 'Sync Lead' },
			});
			assert.strictEqual(patchComm.status, 200);
			const pubComm = await invokeRoute(communityPublicRoute.GET, '/api/community', {
				headers: { cookie: cookieHeader },
			});
			assert.strictEqual(pubComm.status, 200);
			assert.strictEqual(pubComm.data?.clubName, 'Orbit Sync Test');
			assert.strictEqual(pubComm.data?.signatures?.[0]?.rank, 'Sync Lead');
		} finally {
			if (createdBudIds.length > 0) {
				await pool.query('DELETE FROM budget_records WHERE id = ANY($1)', [createdBudIds]).catch(() => {});
			}
			if (createdInvIds.length > 0) {
				await pool.query('DELETE FROM inventory WHERE id = ANY($1)', [createdInvIds]).catch(() => {});
			}
			await pool.query(
				`DELETE FROM system_settings WHERE key = ANY($1)`,
				[['club_name', 'organization_name', 'signature1_rank', 'signatory_1_title']]
			).catch(() => {});
			for (const row of prevCommunityRows) {
				await pool.query(
					`INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, $3)
					 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
					[row.key, row.value, Date.now()]
				).catch(() => {});
			}
			const { invalidateCache } = await import('../../src/server/cache.ts');
			invalidateCache('club_info');
		}
	} finally {
		if (prevWriteFlag === undefined) delete process.env.ORBIT_DB_STUDIO_WRITE;
		else process.env.ORBIT_DB_STUDIO_WRITE = prevWriteFlag;
		await pool.query('DELETE FROM audit_logs WHERE actor_id = $1', [userId]).catch(() => {});
		await pool.query('DELETE FROM system_logs WHERE user_id = $1', [userId]).catch(() => {});
		await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {});
	}
});
