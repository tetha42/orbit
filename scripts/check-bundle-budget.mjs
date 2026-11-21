import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';
import { gzipSync } from 'node:zlib';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const jsonMode = flags.has('--json');

function getFlagValue(name, fallback = '') {
	const eq = args.find((a) => a.startsWith(`${name}=`));
	if (eq) return eq.slice(name.length + 1);
	const idx = args.indexOf(name);
	if (idx >= 0 && idx + 1 < args.length && !args[idx + 1].startsWith('--')) return args[idx + 1];
	return fallback;
}

const DEFAULT_BUDGETS = {
	rootInitialJsGzipMaxBytes: 500 * 1024,
	rootInitialJsRawMaxBytes: 1600 * 1024,
	routeInitialJsGzipMaxBytes: 400 * 1024,
	routeInitialJsRawMaxBytes: 1250 * 1024,
	routeInitialCssGzipMaxBytes: 45 * 1024,
	maxInitialJsChunkRawBytes: 400 * 1024,
	maxStaticJsChunkRawBytes: 500 * 1024,
	totalStaticJsGzipMaxBytes: 1500 * 1024,
	totalStaticJsRawMaxBytes: 5200 * 1024,
};

const LAZY_ONLY_MARKERS = [
	{ marker: 'jsPDF', pkg: 'jspdf' },
	{ marker: 'topRightFinderPattern', pkg: 'jsqr' },
	{ marker: 'QR Code version', pkg: 'qrcode' },
	{ marker: '[lucide-react]: Name in Lucide DynamicIcon not found', pkg: 'lucide-react/dynamic' },
];

function normalizeChunkPath(relPath) {
	return String(relPath).replace(/^\/_next\//, '').replace(/^\/+/, '');
}

function kb(bytes) {
	return `${(bytes / 1024).toFixed(1)} KiB`;
}

function measureFile(distDir, relPath, memo) {
	const clean = normalizeChunkPath(relPath);
	if (memo.has(clean)) return memo.get(clean);
	const full = join(distDir, clean);
	if (!existsSync(full) || !statSync(full).isFile()) {
		const missing = { file: clean, rawBytes: 0, gzipBytes: 0, exists: false };
		memo.set(clean, missing);
		return missing;
	}
	const buf = readFileSync(full);
	const measured = {
		file: clean,
		rawBytes: buf.length,
		gzipBytes: gzipSync(buf, { level: 9 }).length,
		exists: true,
		text: clean.endsWith('.js') ? buf.toString('utf8') : '',
	};
	memo.set(clean, measured);
	return measured;
}

function parseClientReferenceManifest(manifestPath, pageKey) {
	const code = readFileSync(manifestPath, 'utf8');
	const sandbox = { globalThis: { __RSC_MANIFEST: {} } };
	vm.runInNewContext(code, sandbox, { timeout: 1000 });
	return sandbox.globalThis.__RSC_MANIFEST[pageKey] || null;
}

function sumFiles(distDir, relPaths, memo) {
	let rawBytes = 0;
	let gzipBytes = 0;
	const files = [];
	for (const rel of relPaths) {
		const m = measureFile(distDir, rel, memo);
		if (!m.exists) continue;
		rawBytes += m.rawBytes;
		gzipBytes += m.gzipBytes;
		files.push({ file: m.file, rawBytes: m.rawBytes, gzipBytes: m.gzipBytes });
	}
	return { rawBytes, gzipBytes, files };
}

function collectBundleMetrics(distDir) {
	const buildIdPath = join(distDir, 'BUILD_ID');
	const buildManifestPath = join(distDir, 'build-manifest.json');
	const appPathsPath = join(distDir, 'app-path-routes-manifest.json');

	if (!existsSync(buildIdPath) || !existsSync(buildManifestPath) || !existsSync(appPathsPath)) {
		return { built: false, buildId: null };
	}

	const buildId = readFileSync(buildIdPath, 'utf8').trim();
	const buildManifest = JSON.parse(readFileSync(buildManifestPath, 'utf8'));
	const appPaths = JSON.parse(readFileSync(appPathsPath, 'utf8'));
	const baseJs = new Set(
		[...(buildManifest.polyfillFiles || []), ...(buildManifest.rootMainFiles || [])].map(normalizeChunkPath)
	);
	const memo = new Map();

	const routes = {};
	const allInitialJsFiles = new Set();

	for (const [pageKey, route] of Object.entries(appPaths)) {
		if (!pageKey.endsWith('/page')) continue;
		const manifestPath = join(distDir, 'server', 'app', `${pageKey}_client-reference-manifest.js`);
		if (!existsSync(manifestPath)) continue;
		const manifest = parseClientReferenceManifest(manifestPath, pageKey);
		if (!manifest) continue;

		const jsSet = new Set(baseJs);
		for (const list of Object.values(manifest.entryJSFiles || {})) {
			for (const chunk of list) jsSet.add(normalizeChunkPath(chunk));
		}
		for (const mod of Object.values(manifest.clientModules || {})) {
			for (const chunk of mod.chunks || []) {
				if (chunk.endsWith('.js')) jsSet.add(normalizeChunkPath(chunk));
			}
		}

		const cssSet = new Set();
		for (const list of Object.values(manifest.entryCSSFiles || {})) {
			for (const item of list) {
				if (item && item.path) cssSet.add(normalizeChunkPath(item.path));
			}
		}

		for (const f of jsSet) allInitialJsFiles.add(f);
		const jsStats = sumFiles(distDir, jsSet, memo);
		const cssStats = sumFiles(distDir, cssSet, memo);
		routes[route] = {
			route,
			pageKey,
			initialJsChunks: jsStats.files.length,
			initialJsBytes: jsStats.rawBytes,
			initialJsGzipBytes: jsStats.gzipBytes,
			initialCssChunks: cssStats.files.length,
			initialCssBytes: cssStats.rawBytes,
			initialCssGzipBytes: cssStats.gzipBytes,
			jsFiles: jsStats.files.map((f) => f.file).sort(),
		};
	}

	const chunksDir = join(distDir, 'static', 'chunks');
	const staticFiles = existsSync(chunksDir) ? readdirSync(chunksDir) : [];
	const staticJs = sumFiles(
		distDir,
		staticFiles.filter((f) => f.endsWith('.js')).map((f) => `static/chunks/${f}`),
		memo
	);
	const staticCss = sumFiles(
		distDir,
		staticFiles.filter((f) => f.endsWith('.css')).map((f) => `static/chunks/${f}`),
		memo
	);
	const initialJsSummary = sumFiles(distDir, allInitialJsFiles, memo);
	const largestStaticJsChunk =
		[...staticJs.files].sort((a, b) => b.rawBytes - a.rawBytes)[0] || { file: '', rawBytes: 0, gzipBytes: 0 };
	const largestInitialJsChunk =
		[...initialJsSummary.files].sort((a, b) => b.rawBytes - a.rawBytes)[0] || { file: '', rawBytes: 0, gzipBytes: 0 };

	const rootRoute = routes['/'];
	const rootLazyLeaks = [];
	if (rootRoute) {
		for (const file of rootRoute.jsFiles) {
			const m = measureFile(distDir, file, memo);
			for (const entry of LAZY_ONLY_MARKERS) {
				if (m.text && m.text.includes(entry.marker)) {
					rootLazyLeaks.push({ file, marker: entry.marker, pkg: entry.pkg });
				}
			}
		}
	}

	return {
		built: true,
		buildId,
		routes,
		totals: {
			routeCount: Object.keys(routes).length,
			staticJsCount: staticJs.files.length,
			totalStaticJsBytes: staticJs.rawBytes,
			totalStaticJsGzipBytes: staticJs.gzipBytes,
			staticCssCount: staticCss.files.length,
			totalStaticCssBytes: staticCss.rawBytes,
			totalStaticCssGzipBytes: staticCss.gzipBytes,
			largestStaticJsChunk,
			largestInitialJsChunk,
		},
		rootLazyLeaks,
	};
}

function evaluateBudgets(metrics) {
	const violations = [];
	const t = metrics.totals;

	for (const r of Object.values(metrics.routes)) {
		const isRoot = r.route === '/';
		const maxGz = isRoot ? DEFAULT_BUDGETS.rootInitialJsGzipMaxBytes : DEFAULT_BUDGETS.routeInitialJsGzipMaxBytes;
		const maxRaw = isRoot ? DEFAULT_BUDGETS.rootInitialJsRawMaxBytes : DEFAULT_BUDGETS.routeInitialJsRawMaxBytes;
		if (r.initialJsGzipBytes > maxGz) {
			violations.push(`Route ${r.route} initial JS gzip ${kb(r.initialJsGzipBytes)} > budget ${kb(maxGz)}`);
		}
		if (r.initialJsBytes > maxRaw) {
			violations.push(`Route ${r.route} initial JS raw ${kb(r.initialJsBytes)} > budget ${kb(maxRaw)}`);
		}
		if (r.initialCssGzipBytes > DEFAULT_BUDGETS.routeInitialCssGzipMaxBytes) {
			violations.push(
				`Route ${r.route} initial CSS gzip ${kb(r.initialCssGzipBytes)} > budget ${kb(DEFAULT_BUDGETS.routeInitialCssGzipMaxBytes)}`
			);
		}
	}

	if (t.largestInitialJsChunk.rawBytes > DEFAULT_BUDGETS.maxInitialJsChunkRawBytes) {
		violations.push(
			`Largest initial JS chunk (${t.largestInitialJsChunk.file}) ${kb(t.largestInitialJsChunk.rawBytes)} > budget ${kb(DEFAULT_BUDGETS.maxInitialJsChunkRawBytes)}`
		);
	}
	if (t.largestStaticJsChunk.rawBytes > DEFAULT_BUDGETS.maxStaticJsChunkRawBytes) {
		violations.push(
			`Largest static JS chunk (${t.largestStaticJsChunk.file}) ${kb(t.largestStaticJsChunk.rawBytes)} > budget ${kb(DEFAULT_BUDGETS.maxStaticJsChunkRawBytes)}`
		);
	}
	if (t.totalStaticJsGzipBytes > DEFAULT_BUDGETS.totalStaticJsGzipMaxBytes) {
		violations.push(
			`Total static JS gzip ${kb(t.totalStaticJsGzipBytes)} > budget ${kb(DEFAULT_BUDGETS.totalStaticJsGzipMaxBytes)}`
		);
	}
	if (t.totalStaticJsBytes > DEFAULT_BUDGETS.totalStaticJsRawMaxBytes) {
		violations.push(
			`Total static JS raw ${kb(t.totalStaticJsBytes)} > budget ${kb(DEFAULT_BUDGETS.totalStaticJsRawMaxBytes)}`
		);
	}
	for (const leak of metrics.rootLazyLeaks) {
		violations.push(`Lazy-only package '${leak.pkg}' (marker '${leak.marker}') found in initial '/' chunk ${leak.file}`);
	}

	return violations;
}

function compareWithBaseline(metrics, baselinePath, maxRegressionPct) {
	if (!existsSync(baselinePath)) {
		return { ok: false, regressions: [`Baseline file not found: ${baselinePath}`], diffs: [] };
	}
	const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
	const regressions = [];
	const diffs = [];
	const factor = 1 + maxRegressionPct / 100;
	const floorBytes = maxRegressionPct === 0 ? 0 : 2048;

	for (const [route, cur] of Object.entries(metrics.routes)) {
		const prev = baseline.routes?.[route];
		if (!prev) continue;
		const deltaGzip = cur.initialJsGzipBytes - prev.initialJsGzipBytes;
		const pct = prev.initialJsGzipBytes > 0 ? (deltaGzip / prev.initialJsGzipBytes) * 100 : 0;
		diffs.push({
			route,
			prevGzipBytes: prev.initialJsGzipBytes,
			curGzipBytes: cur.initialJsGzipBytes,
			deltaGzipBytes: deltaGzip,
			deltaPct: Number(pct.toFixed(2)),
		});
		if (cur.initialJsGzipBytes > Math.max(prev.initialJsGzipBytes * factor, prev.initialJsGzipBytes + floorBytes)) {
			regressions.push(
				`Route ${route} initial JS gzip regressed: ${kb(prev.initialJsGzipBytes)} -> ${kb(cur.initialJsGzipBytes)} (+${pct.toFixed(1)}%)`
			);
		}
		if (
			prev.initialCssGzipBytes > 0 &&
			cur.initialCssGzipBytes > Math.max(prev.initialCssGzipBytes * factor, prev.initialCssGzipBytes + (maxRegressionPct === 0 ? 0 : 1024))
		) {
			const cssPct = ((cur.initialCssGzipBytes - prev.initialCssGzipBytes) / prev.initialCssGzipBytes) * 100;
			regressions.push(
				`Route ${route} initial CSS gzip regressed: ${kb(prev.initialCssGzipBytes)} -> ${kb(cur.initialCssGzipBytes)} (+${cssPct.toFixed(1)}%)`
			);
		}
	}

	const prevStatic = baseline.totals?.totalStaticJsGzipBytes ?? 0;
	if (prevStatic > 0) {
		const curStatic = metrics.totals.totalStaticJsGzipBytes;
		const pct = ((curStatic - prevStatic) / prevStatic) * 100;
		if (curStatic > Math.max(prevStatic * factor, prevStatic + floorBytes)) {
			regressions.push(`Total static JS gzip regressed: ${kb(prevStatic)} -> ${kb(curStatic)} (+${pct.toFixed(1)}%)`);
		}
	}

	return { ok: regressions.length === 0, regressions, diffs };
}

function toBaselinePayload(metrics) {
	const routeSnapshot = {};
	for (const [route, r] of Object.entries(metrics.routes)) {
		routeSnapshot[route] = {
			initialJsChunks: r.initialJsChunks,
			initialJsBytes: r.initialJsBytes,
			initialJsGzipBytes: r.initialJsGzipBytes,
			initialCssBytes: r.initialCssBytes,
			initialCssGzipBytes: r.initialCssGzipBytes,
		};
	}
	return {
		generatedAt: new Date().toISOString(),
		buildId: metrics.buildId,
		totals: {
			totalStaticJsBytes: metrics.totals.totalStaticJsBytes,
			totalStaticJsGzipBytes: metrics.totals.totalStaticJsGzipBytes,
			totalStaticCssBytes: metrics.totals.totalStaticCssBytes,
			totalStaticCssGzipBytes: metrics.totals.totalStaticCssGzipBytes,
			largestStaticJsChunkBytes: metrics.totals.largestStaticJsChunk.rawBytes,
			largestInitialJsChunkBytes: metrics.totals.largestInitialJsChunk.rawBytes,
		},
		routes: routeSnapshot,
	};
}

const distArg = getFlagValue('--dist', process.env.BEU_DIST_DIR || '.next');
const distDir = resolve(ROOT, distArg);
const baselinePath = resolve(ROOT, getFlagValue('--baseline-file', 'scripts/bundle-baseline.json'));
const saveBaseline = flags.has('--save-baseline') || flags.has('--baseline');
const compareMode = flags.has('--compare');
const ifBuilt = flags.has('--if-built');
const rawPct = getFlagValue('--max-regression-pct', '5');
const parsedPct = Number(rawPct);
const maxRegressionPct = rawPct !== '' && Number.isFinite(parsedPct) ? Math.max(0, parsedPct) : 5;

const metrics = collectBundleMetrics(distDir);
if (!metrics.built) {
	const msg = `No production build found in ${distDir}. Run 'pnpm build' first.`;
	if (ifBuilt) {
		if (jsonMode) console.log(JSON.stringify({ ok: true, skipped: true, reason: msg }, null, 2));
		else console.log(`check-bundle-budget: skipped (${msg})`);
		process.exit(0);
	}
	if (jsonMode) console.error(JSON.stringify({ ok: false, error: msg }, null, 2));
	else console.error(`check-bundle-budget: FAILED — ${msg}`);
	process.exit(1);
}

const budgetViolations = evaluateBudgets(metrics);
const compareResult = compareMode ? compareWithBaseline(metrics, baselinePath, maxRegressionPct) : null;

if (saveBaseline) {
	mkdirSync(dirname(baselinePath), { recursive: true });
	writeFileSync(baselinePath, `${JSON.stringify(toBaselinePayload(metrics), null, 2)}\n`, 'utf8');
}

const allViolations = [...budgetViolations, ...(compareResult?.regressions || [])];
const ok = allViolations.length === 0;

const report = {
	ok,
	buildId: metrics.buildId,
	distDir,
	budgets: DEFAULT_BUDGETS,
	totals: metrics.totals,
	routes: Object.values(metrics.routes).sort((a, b) => a.route.localeCompare(b.route)),
	rootLazyLeaks: metrics.rootLazyLeaks,
	baselineSaved: saveBaseline ? baselinePath : null,
	comparison: compareResult,
	violations: allViolations,
};

if (jsonMode) {
	console.log(JSON.stringify(report, null, 2));
} else {
	console.log(`check-bundle-budget: build=${metrics.buildId} (${report.routes.length} routes, ${metrics.totals.staticJsCount} JS chunks)`);
	for (const r of report.routes) {
		console.log(`  ${r.route.padEnd(20)} JS=${kb(r.initialJsGzipBytes)} gz (${kb(r.initialJsBytes)} raw, ${r.initialJsChunks} chunks) | CSS=${kb(r.initialCssGzipBytes)} gz`);
	}
	console.log(
		`  Static JS total=${kb(metrics.totals.totalStaticJsGzipBytes)} gz (${kb(metrics.totals.totalStaticJsBytes)} raw) | Max static chunk=${kb(metrics.totals.largestStaticJsChunk.rawBytes)} | Max initial chunk=${kb(metrics.totals.largestInitialJsChunk.rawBytes)}`
	);
	if (saveBaseline) console.log(`  Saved bundle baseline -> ${baselinePath}`);
	if (compareResult?.diffs.length) {
		for (const d of compareResult.diffs) {
			const sign = d.deltaGzipBytes >= 0 ? '+' : '';
			console.log(`  Compare ${d.route}: ${kb(d.prevGzipBytes)} -> ${kb(d.curGzipBytes)} (${sign}${kb(d.deltaGzipBytes)}, ${sign}${d.deltaPct}%)`);
		}
	}
	if (ok) {
		console.log('check-bundle-budget: PASS (all route budgets & lazy-split checks satisfied)');
	} else {
		console.error('check-bundle-budget: FAILED');
		for (const v of allViolations) console.error(`  - ${v}`);
	}
}

if (!ok) process.exit(1);
