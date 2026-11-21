// Reads <id>.contract.json, API routes, domain modules, and SQL tables -> AI_INDEX.json + .ai/shards/*.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverApiRoutes, discoverSchemaTables } from './lib/repo-introspect.mjs';
import { createAstModuleCache, extractFileExportSignatures } from './lib/ai-index-ast.mjs';
import { buildCompactRootIndex, mapTestsToDomains } from './lib/ai-index-compact.mjs';

const AI_INDEX_VERSION = '3.1.0';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPS_DIR = path.join(ROOT, 'src/apps');
const SHARDS_DIR = path.join(ROOT, '.ai/shards');
const AI_INDEX_PATH = path.join(ROOT, 'AI_INDEX.json');
const CORE_DOMAINS = ['auth', 'core', 'devices', 'setup', 'shell', 'system'];
const SKIP_I18N_CHUNKS_RE = /^src\/lib\/i18n\/(?:core|extra|features|data)\//;
const SOURCE_EXT_RE = /\.(?:ts|tsx|js|mjs)$/;
const isCheckMode = process.argv.includes('--check');

function validateContract(appId, spec) {
	const required = ['id', 'name', 'version', 'description', 'tables', 'api', 'limits', 'errorCodes', 'files'];
	for (const key of required) {
		if (spec[key] === undefined || spec[key] === null) {
			throw new Error(`Contract for "${appId}" is missing required field "${key}"`);
		}
	}
	if (spec.id !== appId) {
		throw new Error(`Contract id "${spec.id}" does not match directory "${appId}"`);
	}
	if (!spec.api?.base || !Array.isArray(spec.api?.endpoints)) {
		throw new Error(`Contract for "${appId}" has invalid api definition`);
	}
	for (const filesList of Object.values(spec.files)) {
		if (!Array.isArray(filesList)) continue;
		for (const fileRef of filesList) {
			if (!fs.existsSync(path.join(ROOT, fileRef))) {
				throw new Error(`[Contract Error] App ${appId} references non-existent file: ${fileRef}`);
			}
		}
	}
}

function walkTsFiles(relRoot, out = []) {
	const absDir = path.join(ROOT, relRoot);
	if (!fs.existsSync(absDir)) return out;
	for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
		const full = path.join(absDir, entry.name);
		if (entry.isDirectory()) {
			walkTsFiles(path.join(relRoot, entry.name), out);
		} else if (entry.isFile() && SOURCE_EXT_RE.test(entry.name) && !entry.name.endsWith('.d.ts') && !entry.name.endsWith('.gen.ts')) {
			out.push(path.relative(ROOT, full).replace(/\\/g, '/'));
		}
	}
	return out.sort();
}

function classifyRouteDomain(routePath, appIdSet) {
	const rules = [
		['/api/public/v1/events', 'events'],
		['/api/public/v1/news', 'news'],
		['/api/uploads', 'mediaviewer'],
		['/api/upload', 'mediaviewer'],
		['/api/committees', 'members'],
		['/api/team-categories', 'teams'],
		['/api/identity', 'settings'],
		['/api/custom-assets', 'settings'],
		['/api/roles', 'settings'],
		['/api/community', 'settings'],
		['/api/form-fields', 'settings'],
		['/api/registration-config', 'settings'],
		['/api/audit', 'soc'],
		['/api/auth/devices', 'devices'],
		['/api/auth', 'auth'],
		['/api/oauth', 'auth'],
		['/api/legal', 'auth'],
		['/api/profile', 'auth'],
		['/api/setup', 'setup'],
		['/api/notifications', 'shell'],
		['/api/stream', 'shell'],
		['/api/search', 'shell'],
		['/api/messages', 'shell'],
		['/api/healthz', 'system'],
		['/api/health', 'system'],
		['/api/admin', 'system'],
	];
	for (const [prefix, domain] of rules) {
		if (routePath === prefix || routePath.startsWith(`${prefix}/`)) return domain;
	}
	const firstSeg = routePath.replace(/^\/api\/?/, '').split('/')[0];
	return appIdSet.has(firstSeg) ? firstSeg : 'system';
}

function classifySourceFileDomain(relPath, appIdSet) {
	if (SKIP_I18N_CHUNKS_RE.test(relPath)) return null;
	if (relPath.startsWith('src/domains/')) {
		const seg = relPath.split('/')[2] || '';
		if (seg === 'chatSearch' || seg === 'webrtc') return 'chat';
		if (seg === 'devices') return 'devices';
		if (appIdSet.has(seg) || CORE_DOMAINS.includes(seg)) return seg;
		return 'system';
	}
	if (relPath.startsWith('src/core/')) return 'core';
	if (
		relPath.startsWith('src/lib/auth/') ||
		relPath === 'src/lib/profile.ts' ||
		relPath === 'src/lib/membershipPolicy.ts' ||
		relPath === 'src/lib/setupSession.ts'
	) {
		return 'auth';
	}
	if (relPath === 'src/lib/setup.ts' || relPath === 'src/server/config.ts' || relPath.startsWith('src/server/config/') || relPath === 'src/server/iniWriter.ts') {
		return 'setup';
	}
	if (
		relPath.startsWith('src/lib/sse/') ||
		relPath.startsWith('src/server/sse/') ||
		relPath === 'src/lib/notifications.ts' ||
		relPath === 'src/lib/messages.ts' ||
		relPath === 'src/server/messages.ts' ||
		relPath === 'src/lib/mobileCockpit.ts'
	) {
		return 'shell';
	}
	if (
		relPath.startsWith('src/lib/waf') ||
		relPath.startsWith('src/lib/wasm/') ||
		relPath.startsWith('src/server/security/') ||
		relPath === 'src/lib/securityRules.ts' ||
		relPath === 'src/lib/securityCidr.ts' ||
		relPath === 'src/server/telemetryBuffer.ts'
	) {
		return 'soc';
	}
	const appPatterns = [
		['budget', /(?:^|\/)(?:budget|vaultAccess)(?:\.|\/|$)/],
		['certificates', /(?:^|\/)certificates(?:\.|\/|$)/],
		['chat', /(?:^|\/)chat(?:Audience)?(?:\.|\/|$)/],
		['database', /(?:^|\/)databaseAccess(?:\.|\/|$)/],
		['decisions', /(?:^|\/)(?:decisions|documentDigest)(?:\.|\/|$)/],
		['events', /(?:^|\/)(?:events|attendanceToken)(?:\.|\/|$)/],
		['inventory', /(?:^|\/)inventory(?:\.|\/|$)/],
		['mail', /(?:^|\/)mail(?:\.|\/|$)/],
		['mediaviewer', /(?:^|\/)(?:media|uploads)(?:\.|\/|$)/],
		['members', /(?:^|\/)members(?:\.|\/|$)/],
		['news', /(?:^|\/)news(?:\.|\/|$)/],
		['notes', /(?:^|\/)notes(?:\.|\/|$)/],
		['projects', /(?:^|\/)project(?:s|Input)(?:\.|\/|$)/],
		['settings', /(?:^|\/)(?:identityIcon|formFields|customData)(?:\.|\/|$)/],
		['teams', /(?:^|\/)(?:teams|teamCategories|kanban|taskAccess)(?:\.|\/|$)/],
		['terminal', /(?:^|\/)terminal(?:Access|Manager)?(?:\.|\/|$)/],
	];
	for (const [appId, re] of appPatterns) {
		if (appIdSet.has(appId) && re.test(relPath)) return appId;
	}
	return 'system';
}

function groupCoreFiles(fileRefs) {
	const groups = {};
	for (const ref of [...fileRefs].sort()) {
		const bucket = ref.startsWith('src/domains/')
			? 'domains'
			: ref.startsWith('src/core/')
				? 'core'
				: ref.startsWith('src/server/')
					? 'server'
					: 'lib';
		if (!groups[bucket]) groups[bucket] = [];
		groups[bucket].push(ref);
	}
	return groups;
}

function readJsonSafe(filePath) {
	if (!fs.existsSync(filePath)) return null;
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf8'));
	} catch {
		// Corrupted or unreadable index JSON is treated as stale/missing.
		return null;
	}
}

export async function run() {
	const appDirs = fs
		.readdirSync(APPS_DIR, { withFileTypes: true })
		.filter((e) => e.isDirectory() && fs.existsSync(path.join(APPS_DIR, e.name, 'manifest.ts')))
		.map((e) => e.name)
		.sort();
	const appIdSet = new Set(appDirs);

	const astCache = createAstModuleCache(ROOT);
	const fileExportsCache = new Map();
	const getFileExports = (fileRef) => {
		if (!fileExportsCache.has(fileRef)) {
			fileExportsCache.set(fileRef, extractFileExportSignatures(astCache, ROOT, fileRef));
		}
		return fileExportsCache.get(fileRef);
	};

	const specs = new Map();
	for (const appId of appDirs) {
		const contractPath = path.join(APPS_DIR, appId, `${appId}.contract.json`);
		if (!fs.existsSync(contractPath)) {
			console.error(`Missing contract file on disk: ${contractPath}`);
			process.exit(1);
		}
		try {
			const spec = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
			validateContract(appId, spec);
			specs.set(appId, spec);
		} catch (err) {
			console.error(err instanceof Error ? err.message : String(err));
			process.exit(1);
		}
	}

	const allTablesRaw = discoverSchemaTables(ROOT);
	const allTables = allTablesRaw.map((t) => ({
		name: t.name,
		sourceFile: t.sourceFile,
		columnCount: t.columns.length,
		columns: t.columns.map((c) => c.name),
		indexCount: t.indexes.length,
	}));
	const tableByName = new Map(allTables.map((t) => [t.name, t]));

	const allApiRoutes = discoverApiRoutes(
		ROOT,
		allTablesRaw.map((t) => t.name)
	).map((r) => ({
		path: r.path,
		file: r.file,
		methods: r.methods,
		auditActions: r.auditActions,
		dbCalls: r.dbCalls,
		tablesTouched: r.tablesTouched,
	}));

	const routesByDomain = new Map();
	const routeDomainMap = {};
	for (const route of allApiRoutes) {
		const domain = classifyRouteDomain(route.path, appIdSet);
		routeDomainMap[route.path] = domain;
		if (!routesByDomain.has(domain)) routesByDomain.set(domain, []);
		routesByDomain.get(domain).push(route);
	}

	const domainFilesByDomain = new Map();
	for (const relRoot of ['src/domains', 'src/core', 'src/lib', 'src/server']) {
		for (const relPath of walkTsFiles(relRoot)) {
			const domain = classifySourceFileDomain(relPath, appIdSet);
			if (!domain) continue;
			if (!domainFilesByDomain.has(domain)) domainFilesByDomain.set(domain, []);
			domainFilesByDomain.get(domain).push(relPath);
		}
	}

	const allDomains = [...new Set([...appDirs, ...CORE_DOMAINS])].sort();
	const orderedDomains = [...allDomains.filter((d) => d !== 'system'), 'system'];
	const claimedTables = new Set();
	const shards = new Map();

	for (const domain of orderedDomains) {
		const spec = specs.get(domain);
		const domainExtra = (domainFilesByDomain.get(domain) || []).sort();
		const files = spec
			? { ...spec.files, ...(domainExtra.length ? { domain: domainExtra } : {}) }
			: groupCoreFiles(domainExtra);
		const routes = routesByDomain.get(domain) || [];
		const tableNames = new Set(spec?.tables || []);
		for (const r of routes) {
			for (const tbl of r.tablesTouched) tableNames.add(tbl);
		}
		for (const tbl of tableNames) claimedTables.add(tbl);
		if (domain === 'system') {
			for (const tbl of allTables) {
				if (!claimedTables.has(tbl.name)) tableNames.add(tbl.name);
			}
		}
		const tables = [...tableNames]
			.filter((name) => tableByName.has(name))
			.sort()
			.map((name) => tableByName.get(name));

		const referencedFiles = [
			...new Set(
				Object.values(files)
					.filter((v) => Array.isArray(v))
					.flat()
					.filter((f) => SOURCE_EXT_RE.test(f))
			),
		].sort();
		const exports = {};
		for (const fileRef of referencedFiles) {
			exports[fileRef] = getFileExports(fileRef);
		}

		shards.set(domain, {
			d: domain,
			files,
			routes,
			tables,
			tests: [],
			exports,
			limits: spec?.limits || {},
			errorCodes: spec?.errorCodes || [],
		});
	}

	const testsByDomain = mapTestsToDomains({
		rootDir: ROOT,
		shards,
		allApiRoutes,
		routeDomainMap,
		appIdSet,
		classifySourceFileDomain,
	});
	for (const [domain, shard] of shards.entries()) {
		shard.tests = [...(testsByDomain.get(domain) || [])].sort();
	}

	const existingIndex = readJsonSafe(AI_INDEX_PATH);
	const actualRootRaw = fs.existsSync(AI_INDEX_PATH) ? fs.readFileSync(AI_INDEX_PATH, 'utf8') : null;
	const existingGenAt = typeof existingIndex?.generatedAt === 'string' && existingIndex.generatedAt.length > 0 ? existingIndex.generatedAt : null;
	const candidateIndex = buildCompactRootIndex({
		version: AI_INDEX_VERSION,
		generatedAt: existingGenAt || new Date().toISOString(),
		appDirs,
		allDomains,
		allTables,
		allApiRoutes,
		routeDomainMap,
	});
	const rootMatches = Boolean(existingGenAt && actualRootRaw === JSON.stringify(candidateIndex));

	const staleShards = [];
	for (const domain of allDomains) {
		const shardPath = path.join(SHARDS_DIR, `${domain}.json`);
		const expectedJson = JSON.stringify(shards.get(domain));
		const actualRaw = fs.existsSync(shardPath) ? fs.readFileSync(shardPath, 'utf8') : null;
		if (actualRaw !== expectedJson) staleShards.push(`.ai/shards/${domain}.json`);
	}
	const existingShardFiles = fs.existsSync(SHARDS_DIR)
		? fs.readdirSync(SHARDS_DIR).filter((f) => f.endsWith('.json')).sort()
		: [];
	const expectedShardFiles = allDomains.map((d) => `${d}.json`);
	const extraShards = existingShardFiles.filter((f) => !expectedShardFiles.includes(f));

	const allFresh = rootMatches && staleShards.length === 0 && extraShards.length === 0;

	if (isCheckMode) {
		if (!existingIndex) {
			console.error(`AI_INDEX.json missing or invalid at root: ${AI_INDEX_PATH}`);
			process.exit(1);
		}
		if (!allFresh) {
			console.error(
				`AI_INDEX.json or shards out of sync (root=${rootMatches ? 'ok' : 'stale'}, ` +
					`${staleShards.length} stale shards, ${extraShards.length} extra). ` +
					'Run `node scripts/gen-ai-index.mjs` to regenerate.'
			);
			process.exit(1);
		}
		console.log(
			`gen-ai-index: v${AI_INDEX_VERSION} validated (${appDirs.length} contracts, ${allDomains.length} shards, ${allApiRoutes.length} routes, ${allTables.length} tables)`
		);
		return;
	}

	fs.mkdirSync(SHARDS_DIR, { recursive: true });
	for (const extra of extraShards) {
		fs.unlinkSync(path.join(SHARDS_DIR, extra));
	}
	for (const domain of allDomains) {
		const shardPath = path.join(SHARDS_DIR, `${domain}.json`);
		const json = JSON.stringify(shards.get(domain));
		if (!fs.existsSync(shardPath) || fs.readFileSync(shardPath, 'utf8') !== json) {
			fs.writeFileSync(shardPath, json, 'utf8');
		}
	}

	const rootJson = JSON.stringify(
		allFresh ? candidateIndex : { ...candidateIndex, generatedAt: new Date().toISOString() }
	);
	fs.writeFileSync(AI_INDEX_PATH, rootJson, 'utf8');
	console.log(
		`gen-ai-index: compiled v${AI_INDEX_VERSION} (${allDomains.length} shards, ${allApiRoutes.length} routes, ${allTables.length} tables, ${Buffer.byteLength(rootJson, 'utf8')} B root)`
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	run().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
