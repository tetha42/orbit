import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const SOURCE_EXT_RE = /\.(?:ts|tsx|js|mjs)$/;
const RESOLVE_EXTS = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx', '/index.js'];
const MAX_JSON_CHARS = 2200;

function walkFiles(dir, matchFn, out = []) {
	if (!fs.existsSync(dir)) return out;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walkFiles(full, matchFn, out);
		else if (entry.isFile() && matchFn(entry.name)) out.push(full);
	}
	return out.sort();
}

function normalizeRelPath(rootDir, input) {
	if (!input) return '';
	const raw = input.trim().replace(/\\/g, '/');
	const abs = raw.startsWith('@/')
		? path.join(rootDir, 'src', raw.slice(2))
		: path.resolve(rootDir, raw);
	const rel = path.relative(rootDir, abs).replace(/\\/g, '/');
	for (const ext of RESOLVE_EXTS) {
		const candidate = abs + ext;
		if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
			return path.relative(rootDir, candidate).replace(/\\/g, '/');
		}
	}
	return rel;
}

function resolveImportSpec(rootDir, fromAbs, spec) {
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

function buildImportGraph(rootDir) {
	const files = walkFiles(path.join(rootDir, 'src'), (n) => SOURCE_EXT_RE.test(n));
	const forward = new Map();
	const reverse = new Map();
	for (const absPath of files) {
		const rel = path.relative(rootDir, absPath).replace(/\\/g, '/');
		const content = fs.readFileSync(absPath, 'utf8');
		const pre = ts.preProcessFile(content, true, true);
		const internal = new Set();
		const external = new Set();
		for (const imp of pre.importedFiles) {
			const resolved = resolveImportSpec(rootDir, absPath, imp.fileName);
			if (resolved) {
				internal.add(resolved);
				if (!reverse.has(resolved)) reverse.set(resolved, new Set());
				reverse.get(resolved).add(rel);
			} else if (!imp.fileName.startsWith('.')) {
				external.add(imp.fileName);
			}
		}
		forward.set(rel, { internal: [...internal].sort(), external: [...external].sort() });
	}
	return { forward, reverse };
}

function readAiIndex(rootDir) {
	const indexPath = path.join(rootDir, 'AI_INDEX.json');
	if (!fs.existsSync(indexPath)) return null;
	return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
}

function availableDomains(index) {
	return (index?.s || [])
		.map((entry) => (entry.endsWith('.json') ? path.basename(entry, '.json') : entry))
		.filter(Boolean)
		.sort();
}

function trimArray(arr, maxCount) {
	if (arr.length <= maxCount) return { items: arr, truncated: 0 };
	return { items: arr.slice(0, maxCount), truncated: arr.length - maxCount };
}

function cmdMap(rootDir, domain) {
	const index = readAiIndex(rootDir);
	if (!index) {
		console.log(JSON.stringify({ ok: false, error: 'Missing AI_INDEX.json; run node scripts/gen-ai-index.mjs' }));
		process.exit(1);
	}
	const domains = availableDomains(index);
	if (!domain) {
		const isAppSet = new Set(Array.isArray(index.m) ? index.m : Object.keys(index.m || {}));
		const domainList = domains.map((d) => {
			const shardPath = path.join(rootDir, '.ai/shards', `${d}.json`);
			if (!fs.existsSync(shardPath)) {
				return { d, app: isAppSet.has(d), routes: (index.r?.[d] || []).length, tables: 0, tests: 0 };
			}
			const shard = JSON.parse(fs.readFileSync(shardPath, 'utf8'));
			return {
				d,
				app: isAppSet.has(d),
				routes: (shard.routes || []).length,
				tables: (shard.tables || []).length,
				tests: (shard.tests || []).length,
			};
		});
		console.log(
			JSON.stringify({
				ok: true,
				v: index.v,
				totalModules: index.totalModules,
				totalApiRoutes: index.totalApiRoutes,
				totalTables: index.totalTables,
				domains: domainList,
			})
		);
		return;
	}
	const shardRel = `.ai/shards/${domain}.json`;
	const shardAbs = path.join(rootDir, shardRel);
	if (!fs.existsSync(shardAbs)) {
		console.log(JSON.stringify({ ok: false, error: `Unknown domain '${domain}'`, domains }));
		process.exit(1);
	}
	const shard = JSON.parse(fs.readFileSync(shardAbs, 'utf8'));
	const payload = {
		d: shard.d,
		shard: shardRel,
		files: shard.files,
		routes: (shard.routes || []).map((r) => ({ path: r.path, methods: r.methods, tables: r.tablesTouched })),
		tables: (shard.tables || []).map((t) => ({ name: t.name, file: t.sourceFile })),
		tests: shard.tests || [],
		limits: shard.limits,
		errorCodes: shard.errorCodes,
		exports: shard.exports,
	};
	let raw = JSON.stringify(payload);
	if (raw.length > MAX_JSON_CHARS) {
		const exportSummary = {};
		for (const [k, v] of Object.entries(shard.exports || {})) {
			exportSummary[k] = Array.isArray(v) ? v.length : 0;
		}
		payload.exports = exportSummary;
		payload.exportsCompact = true;
		raw = JSON.stringify(payload);
	}
	if (raw.length > MAX_JSON_CHARS) {
		delete payload.exports;
		delete payload.exportsCompact;
		payload.exportsOmitted = true;
		payload.routes = (shard.routes || []).map((r) => `${r.methods.join('|')} ${r.path}`);
		payload.tables = (shard.tables || []).map((t) => t.name);
		raw = JSON.stringify(payload);
	}
	if (raw.length > MAX_JSON_CHARS && Array.isArray(payload.routes)) {
		const rTrim = trimArray(payload.routes, 18);
		payload.routes = rTrim.items;
		if (rTrim.truncated) payload.routesTruncated = rTrim.truncated;
		raw = JSON.stringify(payload);
	}
	if (raw.length > MAX_JSON_CHARS && payload.files && typeof payload.files === 'object') {
		const compactFiles = {};
		let truncatedCount = 0;
		for (const [group, list] of Object.entries(payload.files)) {
			if (!Array.isArray(list)) continue;
			const trimmed = trimArray(list, 12);
			compactFiles[group] = trimmed.items;
			truncatedCount += trimmed.truncated;
		}
		payload.files = compactFiles;
		if (truncatedCount > 0) payload.filesTruncated = truncatedCount;
		raw = JSON.stringify(payload);
	}
	console.log(raw);
}

function cmdDeps(rootDir, rawTarget) {
	if (!rawTarget) {
		console.log(JSON.stringify({ ok: false, error: 'Missing <file>' }));
		process.exit(2);
	}
	const rel = normalizeRelPath(rootDir, rawTarget);
	const abs = path.join(rootDir, rel);
	if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
		console.log(JSON.stringify({ ok: false, error: 'File not found', file: rel }));
		process.exit(1);
	}
	const { forward, reverse } = buildImportGraph(rootDir);
	const fwd = forward.get(rel) || { internal: [], external: [] };
	const importers = [...(reverse.get(rel) || [])].sort();
	const payload = {
		file: rel,
		imports: fwd.internal,
		external: fwd.external,
		importers,
	};
	let raw = JSON.stringify(payload);
	if (raw.length > MAX_JSON_CHARS) {
		const impTrim = trimArray(importers, 25);
		payload.importers = impTrim.items;
		if (impTrim.truncated) payload.importersTruncated = impTrim.truncated;
		raw = JSON.stringify(payload);
	}
	console.log(raw);
}

function cmdImpact(rootDir, inputs) {
	const rawList = inputs
		.flatMap((x) => x.split(','))
		.map((x) => normalizeRelPath(rootDir, x))
		.filter(Boolean);
	if (rawList.length === 0) {
		console.log(JSON.stringify({ ok: false, error: 'Missing <file1,file2>' }));
		process.exit(2);
	}
	const files = [...new Set(rawList)].sort();
	const { reverse } = buildImportGraph(rootDir);

	const affected = new Set(files);
	const queue = [...files];
	while (queue.length > 0) {
		const cur = queue.shift();
		for (const caller of reverse.get(cur) || []) {
			if (!affected.has(caller)) {
				affected.add(caller);
				queue.push(caller);
			}
		}
	}

	const index = readAiIndex(rootDir);
	const domains = new Set();
	const affectedRoutes = new Set();
	const shardTestsByDomain = new Map();
	for (const d of availableDomains(index)) {
		const shardPath = path.join(rootDir, '.ai/shards', `${d}.json`);
		if (!fs.existsSync(shardPath)) continue;
		const shard = JSON.parse(fs.readFileSync(shardPath, 'utf8'));
		shardTestsByDomain.set(d, Array.isArray(shard.tests) ? shard.tests : []);
		const shardFiles = new Set(Object.values(shard.files || {}).filter(Array.isArray).flat());
		for (const r of shard.routes || []) {
			shardFiles.add(r.file);
			if (affected.has(r.file)) affectedRoutes.add(r.path);
		}
		for (const af of affected) {
			if (shardFiles.has(af) || af.startsWith(`src/apps/${d}/`)) domains.add(d);
		}
	}
	for (const af of affected) {
		if (af.startsWith('src/lib/i18n')) domains.add('system');
		else if (af.startsWith('src/app/api/auth/devices')) domains.add('devices');
		else if (af.startsWith('src/app/api/auth/')) domains.add('auth');
		else if (af.startsWith('src/app/api/setup/')) domains.add('setup');
	}

	const routeMatchers = [...affectedRoutes].map((routePath) => {
		if (!routePath.includes('[')) return (src) => src.includes(routePath);
		const escaped = routePath.replace(/[.*+?^${}()|[\]\\]/g, (ch) =>
			ch === '[' || ch === ']' ? ch : `\\${ch}`
		);
		const pattern = escaped.replace(/\[[^\]]+\]/g, "[^'\"`\\s/]+");
		const re = new RegExp(pattern);
		return (src) => src.includes(routePath) || re.test(src);
	});
	const schemaTriggerFiles = new Set([
		'AI_INDEX.json',
		'scripts/gen-ai-index.mjs',
		'scripts/lib/ai-index-compact.mjs',
		'src/contracts/contract.schema.json',
		'scripts/file-length-ceilings.json',
		'scripts/i18n-ternary-ceilings.json',
		'src/app/api/setup/route.ts',
	]);

	const testsDir = path.join(rootDir, 'tests/contract');
	const matchedTests = new Set();
	for (const d of domains) {
		for (const tRel of shardTestsByDomain.get(d) || []) {
			if (fs.existsSync(path.join(rootDir, tRel))) matchedTests.add(tRel);
		}
	}
	if (fs.existsSync(testsDir)) {
		for (const entry of fs.readdirSync(testsDir).filter((f) => f.endsWith('.test.mjs')).sort()) {
			const testRel = `tests/contract/${entry}`;
			const testAbs = path.join(testsDir, entry);
			const src = fs.readFileSync(testAbs, 'utf8');
			if (affected.has(testRel)) matchedTests.add(testRel);
			const pre = ts.preProcessFile(src, true, true);
			for (const imp of pre.importedFiles) {
				const resolved = resolveImportSpec(rootDir, testAbs, imp.fileName);
				if (resolved && affected.has(resolved)) matchedTests.add(testRel);
			}
			for (const matchesRoute of routeMatchers) {
				if (matchesRoute(src)) matchedTests.add(testRel);
			}
			if (
				entry === 'contracts-schema.test.mjs' &&
				files.some((f) => f.endsWith('.contract.json') || f.endsWith('/manifest.ts') || f.startsWith('.ai/') || schemaTriggerFiles.has(f))
			) {
				matchedTests.add(testRel);
			}
		}
	}

	const checks = [];
	const srcFiles = files.filter((f) => f.startsWith('src/'));
	const srcOrScriptFiles = files.filter((f) => f.startsWith('src/') || f.startsWith('scripts/'));
	if (srcOrScriptFiles.length > 0) {
		checks.push(`node scripts/check-file-lengths.mjs --files ${srcOrScriptFiles.join(',')}`);
	}
	if (srcFiles.length > 0) {
		checks.push(`node scripts/verify-ast.mjs --files ${srcFiles.join(',')}`);
	}
	if (files.some((f) => f.endsWith('/manifest.ts') || f.startsWith('src/lib/i18n/domains/') || f === 'scripts/gen-apps.mjs')) {
		checks.push('node scripts/gen-apps.mjs --check');
	}
	if (files.some((f) => f === 'src/lib/i18n.ts' || f.startsWith('src/lib/i18n') || f === 'src/lib/i18nApps.ts')) {
		checks.push('node scripts/check-i18n.mjs');
	}
	if (
		files.some(
			(f) =>
				f.endsWith('.contract.json') ||
				f.startsWith('src/app/api/') ||
				f.startsWith('src/db/') ||
				f === 'scripts/gen-ai-index.mjs' ||
				f === 'scripts/lib/ai-index-compact.mjs' ||
				f === 'scripts/lib/repo-introspect.mjs' ||
				f === 'scripts/lib/ai-index-ast.mjs'
		)
	) {
		checks.push('node scripts/gen-ai-index.mjs --check');
	}
	if (files.some((f) => f.startsWith('scripts/pure-checks/') || f === 'scripts/check-pure.mjs')) {
		checks.push('node scripts/check-pure.mjs');
	}
	if (files.some((f) => f.startsWith('tests/'))) {
		checks.push('node scripts/check-test-language.mjs');
	}
	if (files.some((f) => f.endsWith('.ts') || f.endsWith('.tsx'))) {
		checks.push('npx tsc --noEmit');
	}

	const payload = {
		files,
		domains: [...domains].sort(),
		tests: [...matchedTests].sort(),
		checks,
	};
	console.log(JSON.stringify(payload));
}

export async function runAiCommand(rootDir, positionalArgs, _flags, getFlagValue) {
	const sub = positionalArgs[0];
	if (sub === 'map') {
		cmdMap(rootDir, positionalArgs[1]);
		return;
	}
	if (sub === 'deps') {
		cmdDeps(rootDir, positionalArgs[1]);
		return;
	}
	if (sub === 'impact') {
		const flagFiles = getFlagValue ? getFlagValue('--files', '') : '';
		const inputs = [...positionalArgs.slice(1), ...(flagFiles ? [flagFiles] : [])];
		cmdImpact(rootDir, inputs);
		return;
	}
	console.log(JSON.stringify({ ok: false, error: 'Usage: orbit ai <map|deps|impact> <arg>' }));
	process.exit(2);
}
