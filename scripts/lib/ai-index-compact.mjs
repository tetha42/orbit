import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RESOLVE_EXTS = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx', '/index.js'];

const KEYWORD_DOMAIN_RULES = [
	['drive', 'drive'],
	['webrtc', 'chat'],
	['chat', 'chat'],
	['device', 'devices'],
	['contracts-schema', 'system'],
	['measurement-gates', 'system'],
	['language-preference', 'system'],
	['health', 'system'],
	['soc', 'soc'],
	['fim', 'soc'],
	['wasm', 'soc'],
	['security', 'soc'],
	['passkey', 'auth'],
	['rate-limit', 'auth'],
	['auth', 'auth'],
	['setup', 'setup'],
	['db-studio', 'database'],
	['notes', 'notes'],
	['cache-invalidation', 'system'],
];

const API_PREFIX_HINTS = [
	['/api/auth/devices', 'devices'],
	['/api/auth', 'auth'],
	['/api/oauth', 'auth'],
	['/api/legal', 'auth'],
	['/api/profile', 'auth'],
	['/api/setup', 'setup'],
	['/api/drive', 'drive'],
	['/api/chat', 'chat'],
	['/api/notes', 'notes'],
	['/api/soc', 'soc'],
	['/api/audit', 'soc'],
	['/api/settings', 'settings'],
	['/api/database', 'database'],
	['/api/terminal', 'terminal'],
	['/api/budget', 'budget'],
	['/api/events', 'events'],
	['/api/members', 'members'],
	['/api/teams', 'teams'],
	['/api/admin', 'system'],
];

function resolveImportToRel(rootDir, fromAbs, spec) {
	let base = null;
	if (spec.startsWith('@/')) base = path.join(rootDir, 'src', spec.slice(2));
	else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromAbs), spec);
	if (!base) return null;
	for (const ext of RESOLVE_EXTS) {
		const candidate = base + ext;
		if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
			return path.relative(rootDir, candidate).replace(/\\/g, '/');
		}
	}
	return null;
}

function addDomain(map, key, val) {
	if (!map.has(key)) map.set(key, new Set());
	map.get(key).add(val);
}

function buildRouteMatchers(allApiRoutes, routeDomainMap) {
	const matchers = [];
	for (const route of allApiRoutes) {
		const domain = routeDomainMap[route.path];
		if (!route.path.includes('[')) continue;
		const escaped = route.path.replace(/[.*+?^${}()|[\]\\]/g, (ch) =>
			ch === '[' || ch === ']' ? ch : `\\${ch}`
		);
		const pattern = `^${escaped.replace(/\[[^\]]+\]/g, '[^/]+')}$`;
		matchers.push({ domain, re: new RegExp(pattern) });
	}
	return matchers;
}

function classifyImportedSourceFallback(relSrc, appIdSet, classifySourceFileDomain) {
	if (relSrc.startsWith('src/apps/')) {
		const seg = relSrc.split('/')[2] || '';
		return appIdSet.has(seg) ? seg : null;
	}
	if (relSrc.startsWith('src/app/api/')) {
		const sub = relSrc.slice('src/app/api/'.length);
		if (sub.startsWith('setup/')) return 'setup';
		if (sub.startsWith('auth/devices')) return 'devices';
		if (sub.startsWith('auth/')) return 'auth';
		const first = sub.split('/')[0];
		return appIdSet.has(first) ? first : null;
	}
	if (relSrc.startsWith('src/contracts/schemas/')) {
		const base = path.basename(relSrc, path.extname(relSrc));
		return appIdSet.has(base) ? base : null;
	}
	if (relSrc.startsWith('src/db/repositories/security') || relSrc.startsWith('src/db/repositories/inspection')) {
		return 'soc';
	}
	if (relSrc.startsWith('src/db/repositories/members')) return 'members';
	if (relSrc.startsWith('src/db/repositories/settings')) return 'settings';
	if (relSrc.startsWith('src/db/roles')) return 'settings';
	if (relSrc.startsWith('src/db/core/') || relSrc.startsWith('src/db/events') || relSrc.startsWith('src/db/schema/')) {
		return 'system';
	}
	if (relSrc.startsWith('src/db/')) return null;
	return classifySourceFileDomain(relSrc, appIdSet);
}

export function mapTestsToDomains({
	rootDir,
	shards,
	allApiRoutes,
	routeDomainMap,
	appIdSet,
	classifySourceFileDomain,
}) {
	const fileToDomains = new Map();
	for (const [domain, shard] of shards.entries()) {
		for (const list of Object.values(shard.files || {})) {
			if (!Array.isArray(list)) continue;
			for (const f of list) addDomain(fileToDomains, f, domain);
		}
		for (const r of shard.routes || []) {
			if (r.file) addDomain(fileToDomains, r.file, domain);
		}
	}

	const routeMatchers = buildRouteMatchers(allApiRoutes, routeDomainMap);
	const testsByDomain = new Map();
	const testsDir = path.join(rootDir, 'tests/contract');
	if (!fs.existsSync(testsDir)) return testsByDomain;

	const testFiles = fs
		.readdirSync(testsDir)
		.filter((f) => f.endsWith('.test.mjs'))
		.sort();

	for (const fileName of testFiles) {
		const testRel = `tests/contract/${fileName}`;
		const testAbs = path.join(testsDir, fileName);
		const src = fs.readFileSync(testAbs, 'utf8');
		const matched = new Set();

		const pre = ts.preProcessFile(src, true, true);
		for (const imp of pre.importedFiles) {
			const relSrc = resolveImportToRel(rootDir, testAbs, imp.fileName);
			if (!relSrc || !relSrc.startsWith('src/')) continue;
			const owners = fileToDomains.get(relSrc);
			if (owners) {
				for (const d of owners) matched.add(d);
			} else {
				const fallback = classifyImportedSourceFallback(relSrc, appIdSet, classifySourceFileDomain);
				if (fallback) matched.add(fallback);
			}
		}

		for (const m of src.matchAll(/['"`](\/api(?:\/[a-zA-Z0-9_.\-[\]:${}]+)*)['"`]/g)) {
			const apiLit = m[1];
			if (routeDomainMap[apiLit]) {
				matched.add(routeDomainMap[apiLit]);
				continue;
			}
			const patternHit = routeMatchers.find((rm) => rm.re.test(apiLit));
			if (patternHit) {
				matched.add(patternHit.domain);
				continue;
			}
			for (const [prefix, domain] of API_PREFIX_HINTS) {
				if (apiLit === prefix || apiLit.startsWith(`${prefix}/`)) {
					matched.add(domain);
					break;
				}
			}
		}

		const lowerName = fileName.toLowerCase();
		for (const [kw, domain] of KEYWORD_DOMAIN_RULES) {
			if (lowerName.includes(kw)) matched.add(domain);
		}

		for (const domain of matched) {
			addDomain(testsByDomain, domain, testRel);
		}
	}

	return testsByDomain;
}

export function compactRouteSubpath(domain, routePath) {
	const sub = routePath.replace(/^\/api\/?/, '');
	if (sub === domain) return '';
	if (sub.startsWith(`${domain}/`)) return sub.slice(domain.length + 1);
	return `/${sub}`;
}

export function expandCompactRoute(domain, sub) {
	if (sub === '') return `/api/${domain}`;
	if (sub.startsWith('/')) return `/api${sub}`;
	return `/api/${domain}/${sub}`;
}

export function buildCompactRootIndex({
	version,
	generatedAt,
	appDirs,
	allDomains,
	allTables,
	allApiRoutes,
	routeDomainMap,
}) {
	const tablesByFile = {};
	for (const tbl of allTables) {
		if (!tablesByFile[tbl.sourceFile]) tablesByFile[tbl.sourceFile] = [];
		tablesByFile[tbl.sourceFile].push(tbl.name);
	}
	const sortedTables = {};
	for (const file of Object.keys(tablesByFile).sort()) {
		sortedTables[file] = tablesByFile[file].sort();
	}

	const routesByDomain = {};
	for (const route of allApiRoutes) {
		const domain = routeDomainMap[route.path];
		if (!routesByDomain[domain]) routesByDomain[domain] = [];
		routesByDomain[domain].push(compactRouteSubpath(domain, route.path));
	}
	const sortedRoutes = {};
	for (const domain of Object.keys(routesByDomain).sort()) {
		sortedRoutes[domain] = routesByDomain[domain].sort();
	}

	return {
		v: version,
		generatedAt,
		totalModules: appDirs.length,
		totalApiRoutes: allApiRoutes.length,
		totalTables: allTables.length,
		m: [...appDirs].sort(),
		t: sortedTables,
		r: sortedRoutes,
		s: [...allDomains].sort(),
	};
}
