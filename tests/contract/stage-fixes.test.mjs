import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { invokeRoute, teardownContractTestResources } from './helper.mjs';

after(teardownContractTestResources);

test('contract: budget PATCH receiptUrl/receiptPhotoUrl alias, transfer guard, and vault transfers', async () => {
	const { ensurePostgresInit, getPgPool, updateBudgetRecord } = await import('../../src/db/index.ts');
	const { SESSION_COOKIE } = await import('../../src/lib/auth/session.ts');
	const budgetRoute = await import('../../src/app/api/budget/route.ts');

	await ensurePostgresInit();
	const pool = getPgPool();
	const tag = `${process.pid}_${Date.now()}`;
	const roleId = `role_budget_fix_${tag}`;
	const userId = `usr_budget_fix_${tag}`;
	const teamId = `team_budget_fix_${tag}`;
	const sessionToken = crypto.randomBytes(32).toString('base64url');
	const now = Date.now();
	const createdIds = [];

	await pool.query(
		`INSERT INTO roles (id, name, permissions, created_at)
		 VALUES ($1, $2, $3::jsonb, $4)`,
		[roleId, `BudgetTest_${tag}`, JSON.stringify({ budget: 'manage', teams: 'manage' }), now]
	);
	await pool.query(
		`INSERT INTO users (
			id, first_name, last_name, email, password_hash, department, status, role_id,
			session_token, session_expires_at, created_at
		) VALUES ($1, 'Budget', 'Fix', $2, 'unused', 'Finance', 'active', $3, $4, $5, $6)`,
		[userId, `${userId}@orbit.local`, roleId, sessionToken, now + 600_000, now]
	);
	await pool.query(
		`INSERT INTO teams (id, slug, name, category, description, capacity, lead_id, status, created_at)
		 VALUES ($1, $2, $3, 'Engineering', 'Contract vault team', 5, $4, 'active', $5)`,
		[teamId, `vault-team-${tag}`, `VaultTeam_${tag}`, userId, now]
	);

	const cookieHeader = { cookie: `${SESSION_COOKIE}=${sessionToken}` };
	const fetchRecord = async (id) => {
		const getRes = await invokeRoute(budgetRoute.GET, '/api/budget', { headers: cookieHeader });
		assert.strictEqual(getRes.status, 200);
		return getRes.data?.records?.find((r) => r.id === id);
	};

	try {
		// 1. Seed income so general vault covers transfers cleanly
		const incRes = await invokeRoute(budgetRoute.POST, '/api/budget', {
			method: 'POST',
			headers: cookieHeader,
			body: { type: 'income', category: 'sponsorship', amountMinor: 50_000, description: `Income ${tag}`, date: now },
		});
		assert.strictEqual(incRes.status, 200);
		assert.strictEqual(incRes.data?.type, 'income');
		createdIds.push(incRes.data.id);

		// 2. PATCH receiptUrl persists and PATCH receiptPhotoUrl legacy alias also persists
		const receiptA = '/api/uploads/1700000000_aaaaaa.png';
		const patchA = await invokeRoute(budgetRoute.PATCH, '/api/budget', {
			method: 'PATCH',
			headers: cookieHeader,
			body: { id: incRes.data.id, receiptUrl: receiptA },
		});
		assert.strictEqual(patchA.status, 200);
		assert.strictEqual((await fetchRecord(incRes.data.id))?.receiptUrl, receiptA);

		const receiptB = '/api/uploads/1700000001_bbbbbb.png';
		const patchB = await invokeRoute(budgetRoute.PATCH, '/api/budget', {
			method: 'PATCH',
			headers: cookieHeader,
			body: { id: incRes.data.id, receiptPhotoUrl: receiptB },
		});
		assert.strictEqual(patchB.status, 200);
		assert.strictEqual((await fetchRecord(incRes.data.id))?.receiptUrl, receiptB);

		// Also verify direct repository call with legacy receiptPhotoUrl field
		const receiptC = '/api/uploads/1700000002_cccccc.png';
		const repoRes = await updateBudgetRecord(incRes.data.id, { receiptPhotoUrl: receiptC }, userId);
		assert.strictEqual(repoRes, 'ok');
		assert.strictEqual((await fetchRecord(incRes.data.id))?.receiptUrl, receiptC);

		// 3. Transfer between 'general' and teamId succeeds with 201 and emits linked records
		const txRes = await invokeRoute(budgetRoute.POST, '/api/budget', {
			method: 'POST',
			headers: cookieHeader,
			body: {
				action: 'transfer',
				source: 'general',
				target: teamId,
				amountMinor: 10_000,
				description: `Transfer ${tag}`,
				date: now,
			},
		});
		assert.strictEqual(txRes.status, 201);
		assert.ok(typeof txRes.data?.transferId === 'string' && txRes.data.transferId.length > 0);
		const genRes = await invokeRoute(budgetRoute.GET, '/api/budget', { headers: cookieHeader });
		const teamRes = await invokeRoute(budgetRoute.GET, `/api/budget?teamId=${encodeURIComponent(teamId)}`, {
			headers: cookieHeader,
		});
		const outRec = genRes.data?.records?.find((r) => r.transferId === txRes.data.transferId);
		const intoRec = teamRes.data?.records?.find((r) => r.transferId === txRes.data.transferId);
		assert.ok(outRec && intoRec);
		assert.strictEqual(outRec.type, 'expense');
		assert.strictEqual(intoRec.type, 'income');
		createdIds.push(outRec.id, intoRec.id);

		// 4. Transfer guard rejects receiptUrl/receiptPhotoUrl mutation via PATCH and repository
		const guardRes = await invokeRoute(budgetRoute.PATCH, '/api/budget', {
			method: 'PATCH',
			headers: cookieHeader,
			body: { id: outRec.id, receiptUrl: receiptA },
		});
		assert.strictEqual(guardRes.status, 409);
		assert.strictEqual(await updateBudgetRecord(outRec.id, { receiptPhotoUrl: receiptA }, userId), 'transfer');
	} finally {
		if (createdIds.length > 0) {
			await pool.query('DELETE FROM budget_records WHERE id = ANY($1::text[])', [createdIds]).catch(() => {});
		}
		await pool.query('DELETE FROM teams WHERE id = $1', [teamId]).catch(() => {});
		await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {});
		await pool.query('DELETE FROM roles WHERE id = $1', [roleId]).catch(() => {});
	}
});

test('contract: getSystemSettings & getSystemSetting mirror legacy/canonical paired keys on partial DB state', async () => {
	const { ensurePostgresInit, getPgPool, getSystemSettings, getSystemSetting } = await import('../../src/db/index.ts');
	await ensurePostgresInit();
	const pool = getPgPool();

	const trackedKeys = ['club_name', 'organization_name', 'signature1_rank', 'signatory_1_title'];
	const prev = await pool.query('SELECT key, value, updated_at FROM system_settings WHERE key = ANY($1::text[])', [trackedKeys]);
	const prevRows = prev.rows;

	try {
		// Case A: only canonical organization_name & signatory_1_title exist (legacy keys absent)
		await pool.query('DELETE FROM system_settings WHERE key = ANY($1::text[])', [trackedKeys]);
		await pool.query(
			`INSERT INTO system_settings (key, value, updated_at) VALUES
			 ('organization_name', 'Canonical Org Only', $1),
			 ('signatory_1_title', 'Canonical Chair', $1)`,
			[Date.now()]
		);
		const mapA = await getSystemSettings();
		assert.strictEqual(mapA.organization_name, 'Canonical Org Only');
		assert.strictEqual(mapA.club_name, 'Canonical Org Only');
		assert.strictEqual(mapA.signatory_1_title, 'Canonical Chair');
		assert.strictEqual(mapA.signature1_rank, 'Canonical Chair');
		assert.strictEqual(await getSystemSetting('club_name'), 'Canonical Org Only');

		// Case B: only legacy club_name & signature1_rank exist (canonical keys absent)
		await pool.query('DELETE FROM system_settings WHERE key = ANY($1::text[])', [trackedKeys]);
		await pool.query(
			`INSERT INTO system_settings (key, value, updated_at) VALUES
			 ('club_name', 'Legacy Club Only', $1),
			 ('signature1_rank', 'Legacy President', $1)`,
			[Date.now()]
		);
		const mapB = await getSystemSettings();
		assert.strictEqual(mapB.club_name, 'Legacy Club Only');
		assert.strictEqual(mapB.organization_name, 'Legacy Club Only');
		assert.strictEqual(mapB.signature1_rank, 'Legacy President');
		assert.strictEqual(mapB.signatory_1_title, 'Legacy President');
		assert.strictEqual(await getSystemSetting('organization_name'), 'Legacy Club Only');
	} finally {
		await pool.query('DELETE FROM system_settings WHERE key = ANY($1::text[])', [trackedKeys]).catch(() => {});
		for (const row of prevRows) {
			await pool
				.query(
					`INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, $3)
					 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
					[row.key, row.value, row.updated_at]
				)
				.catch(() => {});
		}
	}
});

test('contract: inventory CRUD and loan lifecycle return canonical serialNo, holderUserId, holderName, dueDate', async () => {
	const { ensurePostgresInit, getPgPool } = await import('../../src/db/index.ts');
	const { SESSION_COOKIE } = await import('../../src/lib/auth/session.ts');
	const inventoryRoute = await import('../../src/app/api/inventory/route.ts');

	await ensurePostgresInit();
	const pool = getPgPool();
	const tag = `${process.pid}_${Date.now()}`;
	const roleId = `role_inv_fix_${tag}`;
	const userId = `usr_inv_fix_${tag}`;
	const sessionToken = crypto.randomBytes(32).toString('base64url');
	const now = Date.now();
	let itemId = null;

	await pool.query(
		`INSERT INTO roles (id, name, permissions, created_at) VALUES ($1, $2, $3::jsonb, $4)`,
		[roleId, `InvTest_${tag}`, JSON.stringify({ inventory: 'manage' }), now]
	);
	await pool.query(
		`INSERT INTO users (
			id, first_name, last_name, email, password_hash, department, status, role_id,
			session_token, session_expires_at, created_at
		) VALUES ($1, 'Inv', 'Tester', $2, 'unused', 'Hardware', 'active', $3, $4, $5, $6)`,
		[userId, `${userId}@orbit.local`, roleId, sessionToken, now + 600_000, now]
	);

	const headers = { cookie: `${SESSION_COOKIE}=${sessionToken}` };
	const code = `FIX-${process.pid}-${Date.now().toString(36).toUpperCase()}`;

	try {
		const createRes = await invokeRoute(inventoryRoute.POST, '/api/inventory', {
			method: 'POST',
			headers,
			body: {
				action: 'create',
				code,
				name: 'Logic Analyzer',
				category: 'Hardware',
				location: 'Lab A',
				serialNo: 'SN-12345',
			},
		});
		assert.strictEqual(createRes.status, 201);
		itemId =
			createRes.data?.id ??
			createRes.data?.item?.id ??
			(await invokeRoute(inventoryRoute.GET, '/api/inventory', { headers })).data?.find((i) => i.code === code)
				?.id;
		assert.ok(itemId);

		const borrowRes = await invokeRoute(inventoryRoute.POST, '/api/inventory', {
			method: 'POST',
			headers,
			body: { action: 'borrow', inventoryId: itemId },
		});
		assert.strictEqual(borrowRes.status, 200);

		const listRes = await invokeRoute(inventoryRoute.GET, '/api/inventory', { headers });
		assert.strictEqual(listRes.status, 200);
		const item = listRes.data?.find((i) => i.id === itemId);
		assert.ok(item);
		assert.strictEqual(item.serialNo, 'SN-12345');
		assert.strictEqual(item.holderUserId, userId);
		assert.strictEqual(item.holderName, 'Inv Tester');
		assert.strictEqual(typeof item.dueDate, 'number');
		assert.ok(item.dueDate > now);

		const histRes = await invokeRoute(
			inventoryRoute.GET,
			`/api/inventory?history=${encodeURIComponent(itemId)}`,
			{ headers }
		);
		assert.strictEqual(histRes.status, 200);
		const movements = histRes.data?.movements;
		assert.ok(Array.isArray(movements) && movements.length >= 1);
		assert.strictEqual(movements[0].type, 'loan');
		assert.strictEqual(movements[0].actorName, 'Inv Tester');
	} finally {
		if (itemId) {
			await pool.query('DELETE FROM inventory_history WHERE item_id = $1', [itemId]).catch(() => {});
			await pool.query('DELETE FROM inventory WHERE id = $1', [itemId]).catch(() => {});
		}
		await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {});
		await pool.query('DELETE FROM roles WHERE id = $1', [roleId]).catch(() => {});
	}
});

test('contract: createOAuthClient and verifyClientCredentials work against real oauth_clients schema', async () => {
	const { ensurePostgresInit, getPgPool } = await import('../../src/db/index.ts');
	const { createOAuthClient, getOAuthClients, verifyClientCredentials, deleteOAuthClient } = await import(
		'../../src/db/oauth.ts'
	);

	await ensurePostgresInit();
	const pool = getPgPool();
	const tag = `${process.pid}_${Date.now()}`;
	const userId = `usr_oauth_fix_${tag}`;
	const roleId = `role_oauth_fix_${tag}`;
	let clientId = null;

	await pool.query(
		`INSERT INTO roles (id, name, permissions, created_at) VALUES ($1, $2, '{}'::jsonb, $3)`,
		[roleId, `OAuthTest_${tag}`, Date.now()]
	);
	await pool.query(
		`INSERT INTO users (
			id, first_name, last_name, email, password_hash, department, status, role_id, created_at
		) VALUES ($1, 'OAuth', 'Owner', $2, 'unused', 'CS', 'active', $3, $4)`,
		[userId, `${userId}@orbit.local`, roleId, Date.now()]
	);

	try {
		const { client, plainSecret } = await createOAuthClient(
			{
				name: `Demo OAuth ${tag}`,
				description: 'Contract test client',
				redirectUris: ['http://localhost:4000/callback'],
				allowedScopes: ['openid', 'profile'],
			},
			userId
		);
		clientId = client.id;
		assert.ok(client.id.startsWith('client_'));
		assert.ok(plainSecret.startsWith('sec_'));
		assert.strictEqual(client.creatorId, userId);

		const list = await getOAuthClients();
		assert.ok(list.some((c) => c.id === client.id));

		const verified = await verifyClientCredentials(client.id, plainSecret);
		assert.ok(verified);
		assert.strictEqual(verified.id, client.id);
	} finally {
		if (clientId) await deleteOAuthClient(clientId).catch(() => {});
		await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {});
		await pool.query('DELETE FROM roles WHERE id = $1', [roleId]).catch(() => {});
	}
});
