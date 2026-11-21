import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { teardownContractTestResources } from './helper.mjs';

after(teardownContractTestResources);

test('p2-gate: check-bundle-budget measures routes/chunks, enforces budgets, and detects baseline regressions', () => {
	const hasBuild = existsSync(join(process.cwd(), '.next', 'BUILD_ID'));
	if (hasBuild) {
		const out = execFileSync(process.execPath, ['scripts/check-bundle-budget.mjs', '--json'], {
			encoding: 'utf8',
		});
		const parsed = JSON.parse(out);
		assert.strictEqual(parsed.ok, true);
		assert.ok(parsed.routes.some((r) => r.route === '/'));
		assert.strictEqual(parsed.rootLazyLeaks.length, 0);

		// Confirm our lazy markers genuinely appear in lazy static chunks (not dead/minified-away strings)
		const chunksDir = join(process.cwd(), '.next', 'static', 'chunks');
		const allJsText = readdirSync(chunksDir)
			.filter((f) => f.endsWith('.js'))
			.map((f) => readFileSync(join(chunksDir, f), 'utf8'))
			.join('\n');
		for (const realLazyMarker of ['jsPDF', 'topRightFinderPattern', 'QR Code version']) {
			assert.ok(
				allJsText.includes(realLazyMarker),
				`Expected lazy marker '${realLazyMarker}' to exist in built static chunks`
			);
		}
	}

	const sandbox = mkdtempSync(join(tmpdir(), 'orbit-bundle-gate-'));
	try {
		// 1. Missing build dir fails cleanly, unless --if-built is passed
		const missingDir = join(sandbox, 'missing-next');
		const failMissing = spawnSync(
			process.execPath,
			['scripts/check-bundle-budget.mjs', '--dist', missingDir, '--json'],
			{ encoding: 'utf8' }
		);
		assert.notStrictEqual(failMissing.status, 0);

		const skipMissing = spawnSync(
			process.execPath,
			['scripts/check-bundle-budget.mjs', '--dist', missingDir, '--if-built', '--json'],
			{ encoding: 'utf8' }
		);
		assert.strictEqual(skipMissing.status, 0);
		assert.strictEqual(JSON.parse(skipMissing.stdout).skipped, true);

		// 2. Synthetic oversized chunk triggers deterministic budget failure & baseline regression detection
		const fakeDist = join(sandbox, 'fake-next');
		mkdirSync(join(fakeDist, 'static', 'chunks'), { recursive: true });
		mkdirSync(join(fakeDist, 'server', 'app'), { recursive: true });
		writeFileSync(join(fakeDist, 'BUILD_ID'), 'test-build-1', 'utf8');
		writeFileSync(
			join(fakeDist, 'build-manifest.json'),
			JSON.stringify({ polyfillFiles: [], rootMainFiles: ['static/chunks/main.js'] }),
			'utf8'
		);
		writeFileSync(
			join(fakeDist, 'app-path-routes-manifest.json'),
			JSON.stringify({ '/page': '/' }),
			'utf8'
		);
		writeFileSync(
			join(fakeDist, 'server', 'app', 'page_client-reference-manifest.js'),
			`globalThis.__RSC_MANIFEST=globalThis.__RSC_MANIFEST||{};globalThis.__RSC_MANIFEST["/page"]=${JSON.stringify({
				clientModules: {},
				entryCSSFiles: {},
				entryJSFiles: { '[project]/src/app/page': ['static/chunks/main.js'] },
			})};`,
			'utf8'
		);
		// Small incompressible payload (~2 KiB) passes budget
		writeFileSync(join(fakeDist, 'static', 'chunks', 'main.js'), crypto.randomBytes(2048));

		const baselineFile = join(sandbox, 'bundle-baseline.json');
		const passRes = spawnSync(
			process.execPath,
			[
				'scripts/check-bundle-budget.mjs',
				'--dist',
				fakeDist,
				'--save-baseline',
				'--baseline-file',
				baselineFile,
				'--json',
			],
			{ encoding: 'utf8' }
		);
		assert.strictEqual(passRes.status, 0);
		assert.strictEqual(existsSync(baselineFile), true);

		// Grow chunk by ~22 KiB (incompressible) -> budget still passes, but --compare fails regression gate
		writeFileSync(join(fakeDist, 'static', 'chunks', 'main.js'), crypto.randomBytes(24 * 1024));
		const regressedRes = spawnSync(
			process.execPath,
			[
				'scripts/check-bundle-budget.mjs',
				'--dist',
				fakeDist,
				'--compare',
				'--baseline-file',
				baselineFile,
				'--json',
			],
			{ encoding: 'utf8' }
		);
		assert.notStrictEqual(regressedRes.status, 0);
		const regressedJson = JSON.parse(regressedRes.stdout);
		assert.strictEqual(regressedJson.ok, false);
		assert.ok(regressedJson.violations.some((v) => v.includes('regressed')));

		// Strict 0% regression budget (--max-regression-pct 0) must reject even 512B growth
		writeFileSync(join(fakeDist, 'static', 'chunks', 'main.js'), crypto.randomBytes(2560));
		const zeroPctRes = spawnSync(
			process.execPath,
			[
				'scripts/check-bundle-budget.mjs',
				'--dist',
				fakeDist,
				'--compare',
				'--max-regression-pct',
				'0',
				'--baseline-file',
				baselineFile,
				'--json',
			],
			{ encoding: 'utf8' }
		);
		assert.notStrictEqual(zeroPctRes.status, 0);
		assert.strictEqual(JSON.parse(zeroPctRes.stdout).ok, false);

		// Injecting lazy-only library markers into '/' initial chunk must fail leak check
		writeFileSync(
			join(fakeDist, 'static', 'chunks', 'main.js'),
			'/* topRightFinderPattern QR Code version [lucide-react]: Name in Lucide DynamicIcon not found */',
			'utf8'
		);
		const leakRes = spawnSync(
			process.execPath,
			['scripts/check-bundle-budget.mjs', '--dist', fakeDist, '--json'],
			{ encoding: 'utf8' }
		);
		assert.notStrictEqual(leakRes.status, 0);
		const leakJson = JSON.parse(leakRes.stdout);
		assert.strictEqual(leakJson.rootLazyLeaks.length, 3);
	} finally {
		rmSync(sandbox, { recursive: true, force: true });
	}
});

test('p2-gate: bench-runner saves baseline and detects latency regressions deterministically', async () => {
	const { runBenchmarks } = await import('../../scripts/bench-runner.mjs');
	const sandbox = mkdtempSync(join(tmpdir(), 'orbit-bench-gate-'));
	const baselineFile = join(sandbox, 'bench-baseline.json');
	try {
		const res = await runBenchmarks({ iterations: 20, saveBaseline: true, baselineFile });
		assert.strictEqual(res.ok, true);
		assert.ok(typeof res.wafInspectionUs.p50 === 'number');
		assert.ok(typeof res.securityRulesUs.p50 === 'number');
		assert.ok(typeof res.sseProtocolUs.p50 === 'number');
		assert.strictEqual(existsSync(baselineFile), true);

		// Write an impossibly tight baseline to verify regression gate triggers
		const saved = JSON.parse(readFileSync(baselineFile, 'utf8'));
		saved.metrics.wasmSecurityUs.p50 = 0.01;
		writeFileSync(baselineFile, JSON.stringify(saved), 'utf8');

		const cmp = await runBenchmarks({
			iterations: 20,
			compare: true,
			baselineFile,
			maxFactor: 1.1,
			floorUs: 1,
		});
		assert.strictEqual(cmp.ok, false);
		assert.ok(cmp.regressions.some((r) => r.includes('wasmSecurityUs')));
	} finally {
		rmSync(sandbox, { recursive: true, force: true });
	}
});

test('p2-gate: db-explain executes non-destructive EXPLAIN (ANALYZE, BUFFERS) across 14 critical queries', () => {
	const out = execFileSync(
		process.execPath,
		['--no-warnings', 'scripts/db-explain.mjs', '--json'],
		{ encoding: 'utf8' }
	);
	const report = JSON.parse(out);
	assert.strictEqual(report.ok, true);
	assert.ok(Array.isArray(report.plans) && report.plans.length >= 14);
	for (const p of report.plans) {
		assert.strictEqual(typeof p.executionTimeMs, 'number');
		assert.strictEqual(typeof p.planningTimeMs, 'number');
	}
});
