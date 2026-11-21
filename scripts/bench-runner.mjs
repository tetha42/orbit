import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

function percentile(sorted, p) {
	if (sorted.length === 0) return 0;
	const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
	return sorted[idx];
}

function summarize(samplesUs) {
	const sorted = [...samplesUs].sort((a, b) => a - b);
	return {
		p50: Number(percentile(sorted, 0.5).toFixed(2)),
		p95: Number(percentile(sorted, 0.95).toFixed(2)),
		p99: Number(percentile(sorted, 0.99).toFixed(2)),
	};
}

export async function runBenchmarks(options = {}) {
	const ROOT = process.cwd();
	const rawIter = options.iterations !== undefined ? Number(options.iterations) : 200;
	const iterations = Number.isFinite(rawIter) ? Math.max(10, Math.min(5000, Math.trunc(rawIter))) : 200;
	const warmup = Math.min(40, iterations);
	const saveBaseline = Boolean(options.saveBaseline);
	const compare = Boolean(options.compare);
	const baselinePath = resolve(ROOT, options.baselineFile || 'scripts/bench-baseline.json');
	const rawFactor = options.maxFactor !== undefined ? Number(options.maxFactor) : 3.0;
	const maxFactor = Number.isFinite(rawFactor) ? Math.max(1.1, rawFactor) : 3.0;
	const rawFloor = options.floorUs !== undefined ? Number(options.floorUs) : 8;
	const floorUs = Number.isFinite(rawFloor) ? Math.max(0, rawFloor) : 8;

	const { inspectRequestComponents } = await import('@/lib/waf/requestWaf');
	const { initWasmEngine, computeDocumentDigestWasm, verifyCertificateFormatWasm } = await import(
		'@/lib/wasm/securityEngine'
	);
	const { evaluateSecurityRules } = await import('@/lib/securityRules');
	const { encodeSseEvent } = await import('@/lib/sse/protocol');
	await initWasmEngine();

	const sampleRules = [
		{
			id: 'bench_rule_1',
			name: 'Bench Export Block',
			enabled: true,
			priority: 10,
			matchMode: 'all',
			action: 'block',
			conditions: [
				{ type: 'ip_cidr', value: '203.0.113.0/24' },
				{ type: 'path_pattern', value: '/api/**/export' },
			],
		},
		{
			id: 'bench_rule_2',
			name: 'Bench Allow Health',
			enabled: true,
			priority: 20,
			matchMode: 'all',
			action: 'allow',
			conditions: [{ type: 'path_pattern', value: '/api/health*' }],
		},
	];

	for (let i = 0; i < warmup; i++) {
		inspectRequestComponents({
			pathname: '/api/items',
			search: `?q=1%20UNION%20SELECT%20password%20FROM%20information_schema.tables&i=${i}`,
			userAgent: 'Mozilla/5.0',
		});
		computeDocumentDigestWasm('REF-2026', 'Protocol', '2026-11-15', `Warm-${i}`);
		verifyCertificateFormatWasm('ORB-2026-X442-9988');
		evaluateSecurityRules(sampleRules, { ip: '203.0.113.42', pathname: '/api/soc/export', method: 'GET' });
		encodeSseEvent('soc_updated', { ts: i });
	}

	const wafSamplesUs = [];
	for (let i = 0; i < iterations; i++) {
		const t0 = performance.now();
		inspectRequestComponents({
			pathname: '/api/items',
			search: `?q=1%20UNION%20SELECT%20password%20FROM%20information_schema.tables&i=${i}`,
			userAgent: 'Mozilla/5.0',
		});
		wafSamplesUs.push((performance.now() - t0) * 1000);
	}

	const wasmSamplesUs = [];
	for (let i = 0; i < iterations; i++) {
		const t0 = performance.now();
		computeDocumentDigestWasm('REF-2026', 'Protocol', '2026-11-15', `Body-${i}`);
		verifyCertificateFormatWasm('ORB-2026-X442-9988');
		wasmSamplesUs.push((performance.now() - t0) * 1000);
	}

	const rulesSamplesUs = [];
	for (let i = 0; i < iterations; i++) {
		const t0 = performance.now();
		evaluateSecurityRules(sampleRules, { ip: '203.0.113.42', pathname: '/api/soc/export', method: 'GET' });
		rulesSamplesUs.push((performance.now() - t0) * 1000);
	}

	const sseSamplesUs = [];
	for (let i = 0; i < iterations; i++) {
		const t0 = performance.now();
		encodeSseEvent('soc_updated', { ts: 1700000000000 + i });
		sseSamplesUs.push((performance.now() - t0) * 1000);
	}

	const metrics = {
		wafInspectionUs: summarize(wafSamplesUs),
		wasmSecurityUs: summarize(wasmSamplesUs),
		securityRulesUs: summarize(rulesSamplesUs),
		sseProtocolUs: summarize(sseSamplesUs),
	};

	const regressions = [];
	let comparison = null;
	if (compare) {
		if (!existsSync(baselinePath)) {
			regressions.push(`Benchmark baseline file not found: ${baselinePath}`);
			comparison = { ok: false, diffs: [] };
		} else {
			const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
			const diffs = [];
			for (const [name, cur] of Object.entries(metrics)) {
				const prev = baseline.metrics?.[name];
				if (!prev) continue;
				const limitUs = Math.max(prev.p50 * maxFactor, prev.p50 + floorUs);
				const regressed = cur.p50 > limitUs;
				diffs.push({
					metric: name,
					prevP50Us: prev.p50,
					curP50Us: cur.p50,
					limitP50Us: Number(limitUs.toFixed(2)),
					regressed,
				});
				if (regressed) {
					regressions.push(`${name} p50 regressed: ${prev.p50}us -> ${cur.p50}us (limit ${limitUs.toFixed(2)}us)`);
				}
			}
			comparison = { ok: regressions.length === 0, diffs };
		}
	}

	if (saveBaseline) {
		mkdirSync(dirname(baselinePath), { recursive: true });
		writeFileSync(
			baselinePath,
			`${JSON.stringify(
				{
					generatedAt: new Date().toISOString(),
					node: process.version,
					platform: process.platform,
					arch: process.arch,
					iterations,
					metrics,
				},
				null,
				2
			)}\n`,
			'utf8'
		);
	}

	return {
		ok: regressions.length === 0,
		iterations,
		...metrics,
		baselineSaved: saveBaseline ? baselinePath : null,
		comparison,
		regressions,
	};
}
