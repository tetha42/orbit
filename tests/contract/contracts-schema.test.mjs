import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { registerTsAliasHooks } from '../../scripts/ts-loader.mjs';
import { expandCompactRoute } from '../../scripts/lib/ai-index-compact.mjs';
import { teardownContractTestResources } from './helper.mjs';

registerTsAliasHooks();
after(teardownContractTestResources);

const ROOT = resolve(process.cwd());

function findContractFiles(dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			out.push(...findContractFiles(full));
		} else if (entry.endsWith('.contract.json')) {
			out.push(full);
		}
	}
	return out;
}

function resolveApiRouteFile(apiPath) {
	const stripped = apiPath.replace(/^\/api\/?/, '').split('?')[0];
	const segments = stripped ? stripped.split('/').filter(Boolean) : [];
	let current = join(ROOT, 'src', 'app', 'api');

	for (const seg of segments) {
		const direct = join(current, seg);
		if (existsSync(direct) && statSync(direct).isDirectory()) {
			current = direct;
			continue;
		}
		// Support dynamic route segments such as [id] or [token]
		const paramCandidate = seg.startsWith(':') || (seg.startsWith('{') && seg.endsWith('}'));
		const entries = existsSync(current) ? readdirSync(current) : [];
		const dynamicDir = entries.find((e) => e.startsWith('[') && e.endsWith(']'));
		if ((paramCandidate || seg.startsWith('[')) && dynamicDir) {
			current = join(current, dynamicDir);
			continue;
		}
		return null;
	}

	const routeFile = join(current, 'route.ts');
	return existsSync(routeFile) ? routeFile : null;
}

test('contract: all module *.contract.json files conform to schema, existing files, and real API routes', () => {
	const schema = JSON.parse(readFileSync(join(ROOT, 'src', 'contracts', 'contract.schema.json'), 'utf-8'));
	const contracts = findContractFiles(join(ROOT, 'src', 'apps'));
	assert.ok(contracts.length >= 10, `Expected at least 10 module contracts, found ${contracts.length}`);

	const validMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

	for (const file of contracts) {
		const rel = file.slice(ROOT.length + 1);
		const contract = JSON.parse(readFileSync(file, 'utf-8'));

		for (const reqField of schema.required) {
			assert.ok(reqField in contract, `${rel}: missing required field "${reqField}"`);
		}
		assert.strictEqual(typeof contract.id, 'string');
		assert.strictEqual(typeof contract.name, 'string');
		assert.strictEqual(typeof contract.version, 'string');
		assert.ok(Array.isArray(contract.tables), `${rel}: tables must be array`);
		assert.ok(Array.isArray(contract.errorCodes), `${rel}: errorCodes must be array`);

		for (const errCode of contract.errorCodes) {
			assert.strictEqual(typeof errCode.code, 'string', `${rel}: errorCode missing code`);
			assert.ok(Number.isInteger(errCode.status), `${rel}: errorCode ${errCode.code} invalid status`);
			assert.strictEqual(typeof errCode.i18nKey, 'string', `${rel}: errorCode ${errCode.code} missing i18nKey`);
		}

		for (const group of ['actions', 'queries', 'ui', 'i18n']) {
			const list = contract.files?.[group];
			assert.ok(Array.isArray(list), `${rel}: files.${group} must be array`);
			for (const fileRef of list) {
				assert.ok(existsSync(join(ROOT, fileRef)), `${rel}: referenced file missing: ${fileRef}`);
			}
		}

		assert.strictEqual(typeof contract.api?.base, 'string', `${rel}: api.base missing`);
		assert.ok(Array.isArray(contract.api?.endpoints), `${rel}: api.endpoints missing`);
		for (const ep of contract.api.endpoints) {
			assert.strictEqual(typeof ep.path, 'string', `${rel}: endpoint missing path`);
			assert.ok(Array.isArray(ep.methods) && ep.methods.length > 0, `${rel}: ${ep.path} missing methods`);
			const routeFile = resolveApiRouteFile(ep.path);
			assert.ok(routeFile, `${rel}: endpoint ${ep.path} has no matching route.ts`);
			const routeSrc = readFileSync(routeFile, 'utf-8');
			for (const method of ep.methods) {
				assert.ok(validMethods.has(method), `${rel}: invalid HTTP method ${method}`);
				const exportRe = new RegExp(
					`export\\s+(?:(?:async\\s+)?function|const|let|var)\\s+${method}\\b|export\\s*\\{[^}]*\\b${method}\\b`
				);
				assert.ok(exportRe.test(routeSrc), `${rel}: ${ep.path} declares ${method} but ${routeFile} does not export it`);
			}
		}
	}
});

test('contract: Next.js App Router compliance on /api/setup and zero gate-gaming ceilings', async () => {
	const setupRoute = await import('../../src/app/api/setup/route.ts');
	const allowedKeys = new Set([
		'GET',
		'POST',
		'PUT',
		'PATCH',
		'DELETE',
		'HEAD',
		'OPTIONS',
		'dynamic',
		'revalidate',
		'runtime',
		'fetchCache',
		'maxDuration',
		'preferredRegion',
	]);
	const exportedKeys = Object.keys(setupRoute);
	for (const key of exportedKeys) {
		assert.ok(allowedKeys.has(key), `Disallowed Next.js route export in setup/route.ts: ${key}`);
	}
	assert.strictEqual(typeof setupRoute.GET, 'function');
	assert.strictEqual(typeof setupRoute.POST, 'function');

	const fileLengthCeilings = JSON.parse(readFileSync(join(ROOT, 'scripts', 'file-length-ceilings.json'), 'utf-8'));
	assert.deepStrictEqual(fileLengthCeilings, {}, 'file-length-ceilings.json must remain empty {}');

	const i18nCeilings = JSON.parse(readFileSync(join(ROOT, 'scripts', 'i18n-ternary-ceilings.json'), 'utf-8'));
	assert.deepStrictEqual(i18nCeilings, {}, 'i18n-ternary-ceilings.json must remain empty {}');

	const i18nFiles = readdirSync(join(ROOT, 'src', 'lib', 'i18n'));
	const partFiles = i18nFiles.filter((f) => /Part\d+/i.test(f));
	assert.deepStrictEqual(partFiles, [], `Mechanically sliced i18n files remain: ${partFiles.join(', ')}`);
});

function normalizeContractRoutePath(routePath) {
	return routePath.replace(/\/:([^/]+)/g, '/[$1]').replace(/\/\{([^}]+)\}/g, '/[$1]');
}

test('contract: AI_INDEX.json v3.1.0 and .ai/shards/*.json match compact sharded schema', () => {
	const indexPath = join(ROOT, 'AI_INDEX.json');
	assert.ok(existsSync(indexPath), 'AI_INDEX.json must exist at repository root');
	const raw = readFileSync(indexPath, 'utf-8');
	const byteLen = Buffer.byteLength(raw, 'utf-8');
	assert.ok(byteLen <= 4 * 1024, `AI_INDEX.json must stay <= 4 KB, got ${byteLen} bytes`);
	assert.ok(!raw.trimEnd().includes('\n'), 'AI_INDEX.json must be minified (no pretty indentation)');

	const index = JSON.parse(raw);
	assert.strictEqual(index.v, '3.1.0', 'AI_INDEX.json version must be 3.1.0');
	assert.strictEqual(typeof index.generatedAt, 'string', 'AI_INDEX.json missing generatedAt');
	assert.ok(Number.isInteger(index.totalModules) && index.totalModules >= 10, 'Invalid totalModules');
	assert.ok(Number.isInteger(index.totalApiRoutes) && index.totalApiRoutes >= 10, 'Invalid totalApiRoutes');
	assert.ok(Number.isInteger(index.totalTables) && index.totalTables >= 10, 'Invalid totalTables');

	assert.ok(Array.isArray(index.m) && index.m.length >= 10, 'AI_INDEX.json m must be array of >= 10 module IDs');
	assert.strictEqual(index.m.length, index.totalModules, 'AI_INDEX.json m count mismatch');
	assert.ok(Array.isArray(index.s) && index.s.length >= index.totalModules, 'AI_INDEX.json s must be domain array');
	assert.ok(index.t && typeof index.t === 'object' && !Array.isArray(index.t), 'AI_INDEX.json t must be object');
	assert.ok(index.r && typeof index.r === 'object' && !Array.isArray(index.r), 'AI_INDEX.json r must be object');

	for (const appId of index.m) {
		assert.strictEqual(typeof appId, 'string', 'Invalid appId in index.m');
		assert.ok(index.s.includes(appId), `Shard list s missing app ${appId}`);
	}
	for (const coreDomain of ['auth', 'core', 'devices', 'setup', 'shell', 'system']) {
		assert.ok(index.s.includes(coreDomain), `Shard list s missing core shard ${coreDomain}`);
	}

	let totalTablesCount = 0;
	for (const [srcFile, tableList] of Object.entries(index.t)) {
		assert.ok(existsSync(join(ROOT, srcFile)), `Table group points to missing file: ${srcFile}`);
		assert.ok(Array.isArray(tableList) && tableList.length > 0, `AI_INDEX.json t[${srcFile}] must be non-empty array`);
		for (const tbl of tableList) {
			assert.strictEqual(typeof tbl, 'string', `Invalid table name in t[${srcFile}]`);
		}
		totalTablesCount += tableList.length;
	}
	assert.strictEqual(totalTablesCount, index.totalTables, 'AI_INDEX.json t total table count mismatch');

	const indexRoutesByDomain = new Map();
	let totalIndexRoutes = 0;
	for (const [domain, subpaths] of Object.entries(index.r)) {
		assert.ok(index.s.includes(domain), `Route group ${domain} missing from index.s`);
		assert.ok(Array.isArray(subpaths), `AI_INDEX.json r[${domain}] must be array`);
		const expanded = new Set();
		for (const sub of subpaths) {
			assert.strictEqual(typeof sub, 'string', `Invalid route subpath in r[${domain}]`);
			expanded.add(expandCompactRoute(domain, sub));
			totalIndexRoutes++;
		}
		indexRoutesByDomain.set(domain, expanded);
	}
	assert.strictEqual(totalIndexRoutes, index.totalApiRoutes, 'AI_INDEX.json r total route count mismatch');

	const shardDomainMap = new Map();
	const shardMap = new Map();
	for (const domain of index.s) {
		assert.strictEqual(typeof domain, 'string', `Invalid domain name in index.s: ${domain}`);
		const shardRel = `.ai/shards/${domain}.json`;
		const shardAbs = join(ROOT, shardRel);
		assert.ok(existsSync(shardAbs), `Missing shard file: ${shardRel}`);
		const shardRaw = readFileSync(shardAbs, 'utf-8');
		assert.ok(!shardRaw.trimEnd().includes('\n'), `${shardRel} must be minified`);
		const shard = JSON.parse(shardRaw);
		assert.strictEqual(shard.d, domain, `${shardRel}: d field mismatch`);
		assert.ok(shard.files && typeof shard.files === 'object' && !Array.isArray(shard.files), `${shardRel}: files must be object`);
		assert.ok(Array.isArray(shard.routes), `${shardRel}: routes must be array`);
		assert.ok(Array.isArray(shard.tables), `${shardRel}: tables must be array`);
		assert.ok(Array.isArray(shard.tests), `${shardRel}: tests must be array`);
		for (const testFile of shard.tests) {
			assert.strictEqual(typeof testFile, 'string', `${shardRel}: invalid test reference`);
			assert.ok(existsSync(join(ROOT, testFile)), `${shardRel}: referenced test file missing: ${testFile}`);
		}
		assert.ok(shard.exports && typeof shard.exports === 'object' && !Array.isArray(shard.exports), `${shardRel}: exports must be object`);
		assert.ok(shard.limits && typeof shard.limits === 'object' && !Array.isArray(shard.limits), `${shardRel}: limits must be object`);
		assert.ok(Array.isArray(shard.errorCodes), `${shardRel}: errorCodes must be array`);
		for (const expFile of Object.keys(shard.exports)) {
			assert.ok(existsSync(join(ROOT, expFile)), `${shardRel}: export file missing: ${expFile}`);
		}
		shardDomainMap.set(shard.d, new Set(shard.routes.map((r) => r.path)));
		shardMap.set(shard.d, shard);
	}

	let totalShardRoutes = 0;
	for (const [domain, routesSet] of shardDomainMap.entries()) {
		totalShardRoutes += routesSet.size;
		const idxSet = indexRoutesByDomain.get(domain) || new Set();
		for (const routePath of routesSet) {
			assert.ok(idxSet.has(routePath), `Route ${routePath} in shard ${domain} missing in index.r[${domain}]`);
		}
		for (const idxRoute of idxSet) {
			assert.ok(routesSet.has(idxRoute), `Route ${idxRoute} in index.r[${domain}] missing in shard ${domain}`);
		}
	}
	assert.strictEqual(totalShardRoutes, index.totalApiRoutes, 'Total routes across shards must match totalApiRoutes');

	for (const appId of index.m) {
		const shard = shardMap.get(appId);
		assert.ok(shard, `Missing shard for app ${appId}`);
		const contractPath = join(ROOT, 'src', 'apps', appId, `${appId}.contract.json`);
		const contract = JSON.parse(readFileSync(contractPath, 'utf-8'));
		const declaredPaths = new Set((contract.api?.endpoints || []).map((ep) => normalizeContractRoutePath(ep.path)));
		for (const route of shard.routes) {
			assert.ok(
				declaredPaths.has(route.path),
				`${appId}.contract.json missing endpoint ${route.path} present in .ai/shards/${appId}.json`
			);
		}
	}

	const diskShards = readdirSync(join(ROOT, '.ai', 'shards')).filter((f) => f.endsWith('.json')).sort();
	assert.deepStrictEqual(
		diskShards,
		[...index.s].map((d) => `${d}.json`).sort(),
		'Orphan or missing files under .ai/shards/'
	);
});
