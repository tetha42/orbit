import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { registerTsAliasHooks } from '../../scripts/ts-loader.mjs';
import { teardownContractTestResources } from './helper.mjs';

registerTsAliasHooks();
after(teardownContractTestResources);

const { defineRoute, defineRouteMeta, parseRouteBody, parseRouteQuery, withRouteMeta } = await import(
	'../../src/contracts/defineRoute.ts'
);
const {
	BUDGET_MAX_AMOUNT,
	BUDGET_MAX_DESC,
	BudgetCreateBodySchema,
	BudgetDeleteQuerySchema,
	BudgetPatchBodySchema,
	BudgetRecordSchema,
	BudgetTransferBodySchema,
} = await import('../../src/contracts/schemas/budget.ts');
const {
	InventoryCreateBodySchema,
	InventoryItemSchema,
	InventoryPatchBodySchema,
	InventoryPostBodySchema,
	InventoryQuerySchema,
} = await import('../../src/contracts/schemas/inventory.ts');

test('defineRoute: parseRouteBody validates JSON payloads and rejects malformed input with 400 VALIDATION_ERROR', async () => {
	const BodySchema = z.object({ name: z.string().trim().min(2), count: z.number().int().positive() });

	const goodReq = new Request('http://127.0.0.1/api/test', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ name: '  Orbit  ', count: 3 }),
	});
	const okRes = await parseRouteBody(goodReq, BodySchema);
	assert.strictEqual(okRes.ok, true);
	assert.deepStrictEqual(okRes.data, { name: 'Orbit', count: 3 });

	const invalidReq = new Request('http://127.0.0.1/api/test', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ name: 'A', count: 0 }),
	});
	const invalidRes = await parseRouteBody(invalidReq, BodySchema);
	assert.strictEqual(invalidRes.ok, false);
	assert.strictEqual(invalidRes.response.status, 400);
	const invalidJson = await invalidRes.response.json();
	assert.strictEqual(invalidJson.ok, false);
	assert.strictEqual(invalidJson.code, 'VALIDATION_ERROR');
	assert.ok(Array.isArray(invalidJson.issues) && invalidJson.issues.length >= 2);
	assert.strictEqual(typeof invalidJson.error, 'string');

	const malformedReq = new Request('http://127.0.0.1/api/test', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: '{not-valid-json',
	});
	const malformedRes = await parseRouteBody(malformedReq, BodySchema);
	assert.strictEqual(malformedRes.ok, false);
	assert.strictEqual(malformedRes.response.status, 400);
	const malformedJson = await malformedRes.response.json();
	assert.strictEqual(malformedJson.code, 'VALIDATION_ERROR');
});

test('defineRoute: parseRouteQuery validates URLSearchParams and returns 400 VALIDATION_ERROR on invalid query', async () => {
	const okQuery = parseRouteQuery(new URLSearchParams('id=bud_123'), BudgetDeleteQuerySchema);
	assert.strictEqual(okQuery.ok, true);
	assert.deepStrictEqual(okQuery.data, { id: 'bud_123' });

	const badQuery = parseRouteQuery(new URLSearchParams(''), BudgetDeleteQuerySchema);
	assert.strictEqual(badQuery.ok, false);
	assert.strictEqual(badQuery.response.status, 400);
	const badJson = await badQuery.response.json();
	assert.strictEqual(badJson.ok, false);
	assert.strictEqual(badJson.code, 'VALIDATION_ERROR');
	assert.ok(Array.isArray(badJson.issues) && badJson.issues.length === 1);

	const invQuery = parseRouteQuery(new URLSearchParams('history=inv_42'), InventoryQuerySchema);
	assert.strictEqual(invQuery.ok, true);
	assert.deepStrictEqual(invQuery.data, { history: 'inv_42' });
});

test('defineRoute: defineRouteMeta and defineRoute attach static contract metadata and preserve route exports', async () => {
	const meta = defineRouteMeta({
		id: 'sample.create',
		method: 'POST',
		path: '/api/sample',
		summary: 'Sample route contract',
		auth: 'authenticated',
	});
	assert.ok(Object.isFrozen(meta));
	assert.strictEqual(meta.id, 'sample.create');

	const handler = defineRoute(meta, async (req) => {
		const url = new URL(req.url);
		return Response.json({ path: url.pathname });
	});
	assert.strictEqual(handler.contractMeta.id, 'sample.create');
	assert.strictEqual(handler.contractMeta.method, 'POST');
	const res = await handler(new Request('http://127.0.0.1/api/sample'));
	assert.deepStrictEqual(await res.json(), { path: '/api/sample' });

	const wrapped = withRouteMeta(() => Response.json({ ok: true }), meta);
	assert.strictEqual(wrapped.contractMeta.path, '/api/sample');

	const budgetRoute = await import('../../src/app/api/budget/route.ts');
	const inventoryRoute = await import('../../src/app/api/inventory/route.ts');
	const allowedExports = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
	for (const mod of [budgetRoute, inventoryRoute]) {
		for (const key of Object.keys(mod)) {
			assert.ok(allowedExports.has(key), `Unexpected Next.js route export: ${key}`);
		}
	}
	assert.strictEqual(budgetRoute.GET.contractMeta.id, 'budget.get');
	assert.strictEqual(budgetRoute.POST.contractMeta.id, 'budget.create');
	assert.strictEqual(budgetRoute.PATCH.contractMeta.id, 'budget.update');
	assert.strictEqual(budgetRoute.DELETE.contractMeta.id, 'budget.delete');
	assert.strictEqual(inventoryRoute.GET.contractMeta.id, 'inventory.get');
	assert.strictEqual(inventoryRoute.POST.contractMeta.id, 'inventory.mutate');
});

test('schemas/budget: validates create, patch, transfer, and canonical record contracts', () => {
	const now = Date.now();
	const created = BudgetCreateBodySchema.parse({
		teamId: 'general',
		typeValue: 'income',
		category: 'food',
		amountMinor: 2500,
		description: '  Team pizza night  ',
		date: now,
		receiptPhotoUrl: '/api/uploads/1700000000_receipt.png',
	});
	assert.deepStrictEqual(created, {
		teamId: null,
		type: 'income',
		category: 'catering',
		amountMinor: 2500,
		description: 'Team pizza night',
		date: now,
		receiptUrl: '/api/uploads/1700000000_receipt.png',
	});

	for (const bad of [
		{ category: 'sponsorship', amountMinor: 100, description: 'missing type' },
		{ type: 'gift', category: 'sponsorship', amountMinor: 100, description: 'invalid type' },
		{ type: 'income', category: 'unknown_cat', amountMinor: 100, description: 'bad category' },
		{ type: 'income', category: 'sponsorship', amountMinor: 0, description: 'zero amount' },
		{ type: 'income', category: 'sponsorship', amountMinor: 12.5, description: 'fractional minor' },
		{ type: 'income', category: 'sponsorship', amountMinor: BUDGET_MAX_AMOUNT + 1, description: 'exceeds max' },
		{ type: 'income', category: 'sponsorship', amountMinor: 100, description: '   ' },
		{ type: 'income', category: 'sponsorship', amountMinor: 100, description: 'x'.repeat(BUDGET_MAX_DESC + 1) },
		{ type: 'income', category: 'sponsorship', amountMinor: 100, description: 'bad receipt', receiptUrl: 'https://evil.example/a.png' },
		{ type: 'income', category: 'sponsorship', amountMinor: 100, description: 'future', date: now + 30 * 86_400_000 },
	]) {
		assert.strictEqual(BudgetCreateBodySchema.safeParse(bad).success, false);
	}

	const patched = BudgetPatchBodySchema.parse({
		id: 'bud_1',
		description: '  Updated desc  ',
		receiptPhotoUrl: null,
	});
	assert.deepStrictEqual(patched, {
		id: 'bud_1',
		description: 'Updated desc',
		category: undefined,
		date: undefined,
		receiptUrl: null,
	});
	assert.strictEqual(BudgetPatchBodySchema.safeParse({ id: 'bud_1', amountMinor: 1 }).success, false);
	assert.strictEqual(BudgetPatchBodySchema.safeParse({ id: 'bud_1', type: 'income' }).success, false);
	assert.strictEqual(BudgetPatchBodySchema.safeParse({ id: 'bud_1', typeValue: 'expense' }).success, false);
	assert.strictEqual(BudgetPatchBodySchema.safeParse({ id: '' }).success, false);

	const transfer = BudgetTransferBodySchema.parse({
		action: 'transfer',
		source: 'general',
		target: 'team_alpha',
		amountMinor: 10_000,
		description: 'Grant transfer',
		date: now,
	});
	assert.deepStrictEqual(transfer, {
		action: 'transfer',
		sourceTeamId: null,
		targetTeamId: 'team_alpha',
		amountMinor: 10_000,
		description: 'Grant transfer',
		date: now,
	});
	assert.strictEqual(
		BudgetTransferBodySchema.safeParse({
			action: 'transfer',
			source: 'general',
			target: null,
			amountMinor: 500,
			description: 'Same vault',
		}).success,
		false
	);
	assert.strictEqual(
		BudgetTransferBodySchema.safeParse({
			action: 'transfer',
			source: 'general',
			target: 'team_alpha',
			amountMinor: 500,
			description: 'ab',
		}).success,
		false
	);

	const recordCheck = BudgetRecordSchema.safeParse({
		id: 'bud_1',
		date: now,
		createdAt: now,
		type: 'expense',
		category: 'hardware',
		amountMinor: 5000,
		description: 'Oscilloscope probes',
		receiptUrl: null,
		recorderId: 'usr_1',
		recorderName: 'Ada Lovelace',
		transferId: null,
		counterpartVaultName: null,
		updaterName: null,
		updatedAt: null,
	});
	assert.strictEqual(recordCheck.success, true);
});

test('schemas/inventory: validates create, update, loan actions, and canonical item contracts', () => {
	const created = InventoryCreateBodySchema.parse({
		action: 'create',
		code: ' lab rpi 006 ',
		name: '  Raspberry Pi 5  ',
		category: '  Embedded  ',
		location: '  Shelf B2  ',
		description: '',
		serialNo: '  SN-500  ',
		status: 'available',
	});
	assert.deepStrictEqual(created, {
		action: 'create',
		code: 'LAB-RPI-006',
		name: 'Raspberry Pi 5',
		category: 'Embedded',
		location: 'Shelf B2',
		description: null,
		serialNo: 'SN-500',
		status: 'available',
	});

	assert.strictEqual(
		InventoryCreateBodySchema.safeParse({
			action: 'create',
			code: 'lower case!',
			name: 'Probe',
			category: 'Sensor',
			location: 'Shelf',
		}).success,
		false
	);
	assert.strictEqual(
		InventoryCreateBodySchema.safeParse({
			action: 'create',
			code: 'LAB-100',
			name: 'Hi',
			category: 'Sensor',
			location: 'Shelf',
			status: 'on_loan',
		}).success,
		false
	);

	const updated = InventoryPatchBodySchema.parse({
		action: 'update',
		inventoryId: 'inv_1',
		location: 'Rack C1',
	});
	assert.strictEqual(updated.location, 'Rack C1');
	assert.strictEqual(updated.name, undefined);
	assert.strictEqual(
		InventoryPatchBodySchema.safeParse({ action: 'update', inventoryId: '', location: 'Rack C1' }).success,
		false
	);

	assert.strictEqual(
		InventoryPostBodySchema.safeParse({ action: 'borrow', inventoryId: 'inv_1', dueDate: Date.now() + 86_400_000 })
			.success,
		true
	);
	assert.strictEqual(
		InventoryPostBodySchema.safeParse({ action: 'return', inventoryId: 'inv_1', failure: true, note: 'Damaged port' })
			.success,
		true
	);
	assert.strictEqual(
		InventoryPostBodySchema.safeParse({ action: 'extend', inventoryId: 'inv_1' }).success,
		false
	);
	assert.strictEqual(
		InventoryPostBodySchema.safeParse({ action: 'updateStatus', inventoryId: 'inv_1', status: 'on_loan' }).success,
		false
	);
	assert.strictEqual(
		InventoryPostBodySchema.safeParse({ action: 'updateStatus', inventoryId: 'inv_1', status: 'faulty' }).success,
		true
	);

	const itemCheck = InventoryItemSchema.safeParse({
		id: 'inv_1',
		code: 'LAB-RPI-006',
		name: 'Raspberry Pi 5',
		category: 'Embedded',
		status: 'available',
		location: 'Shelf B2',
		holderUserId: null,
		holderName: null,
		dueDate: null,
		loanDate: null,
		description: null,
		serialNo: 'SN-500',
	});
	assert.strictEqual(itemCheck.success, true);
});
