import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { invokeRoute, teardownContractTestResources } from './helper.mjs';

after(teardownContractTestResources);

test('contract: DB Studio routes block unauthenticated writes and queries', async () => {
	const mutateRoute = await import('../../src/app/api/database/mutate/route.ts');
	const importRoute = await import('../../src/app/api/database/import/route.ts');
	const queryRoute = await import('../../src/app/api/database/query/route.ts');

	const mutateRes = await invokeRoute(mutateRoute.POST, '/api/database/mutate', {
		method: 'POST',
		body: { table: 'users', inserts: [{ email: 'probe@orbit.local' }] },
	});
	assert.ok(mutateRes.status === 401 || mutateRes.status === 403, `Expected 401/403 for mutate, got ${mutateRes.status}`);

	const importRes = await invokeRoute(importRoute.POST, '/api/database/import', {
		method: 'POST',
		body: { table: 'users', rows: [{ email: 'probe@orbit.local' }] },
	});
	assert.ok(importRes.status === 401 || importRes.status === 403, `Expected 401/403 for import, got ${importRes.status}`);

	const queryRes = await invokeRoute(queryRoute.POST, '/api/database/query', {
		method: 'POST',
		body: { sql: 'DROP TABLE users;' },
	});
	assert.ok(queryRes.status === 401 || queryRes.status === 403, `Expected 401/403 for query, got ${queryRes.status}`);
});

test('contract: DB Studio SQL guard blocks OS primitives, sensitive columns, and audit mutations', async () => {
	const { inspectDatabaseSql } = await import('../../src/lib/waf/sqlGuard.ts');

	const copyProgram = inspectDatabaseSql("COPY users TO PROGRAM 'id'");
	assert.strictEqual(copyProgram.allowed, false);
	assert.ok(copyProgram.strikePoints >= 40);

	const fsRead = inspectDatabaseSql("SELECT pg_read_file('/etc/passwd')");
	assert.strictEqual(fsRead.allowed, false);

	const sensitiveCol = inspectDatabaseSql('SELECT id, password_hash, totp_secret FROM users');
	assert.strictEqual(sensitiveCol.allowed, false);
	assert.ok(sensitiveCol.strikePoints >= 30);

	const auditDelete = inspectDatabaseSql('DELETE FROM audit_logs WHERE id > 0');
	assert.strictEqual(auditDelete.allowed, false);

	const safeSelect = inspectDatabaseSql('SELECT id, name, surname FROM users LIMIT 10');
	assert.strictEqual(safeSelect.allowed, true);
});

test('contract: DB Studio session token signing, tampering rejection, and user freeze', async () => {
	const {
		createDatabaseSessionToken,
		verifyDatabaseSessionToken,
		freezeUserDatabaseAccess,
		unfreezeUserDatabaseAccess,
		isUserDatabaseFrozen,
	} = await import('../../src/server/databaseAccess.ts');

	const token = await createDatabaseSessionToken('usr_contract_admin');
	assert.strictEqual(await verifyDatabaseSessionToken('usr_contract_admin', token), true);
	assert.strictEqual(await verifyDatabaseSessionToken('usr_other_admin', token), false);
	assert.strictEqual(await verifyDatabaseSessionToken('usr_contract_admin', `${token}x`), false);
	assert.strictEqual(await verifyDatabaseSessionToken('usr_contract_admin', null), false);

	assert.strictEqual(isUserDatabaseFrozen('usr_contract_admin'), false);
	freezeUserDatabaseAccess('usr_contract_admin');
	assert.strictEqual(isUserDatabaseFrozen('usr_contract_admin'), true);
	unfreezeUserDatabaseAccess('usr_contract_admin');
	assert.strictEqual(isUserDatabaseFrozen('usr_contract_admin'), false);
});
