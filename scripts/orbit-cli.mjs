import { spawn, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { printGroupedHelp } from './cli/format.mjs';
import { runQuotasCommand, runStatusCommand } from './orbit-cli-info.mjs';
import { registerTsAliasHooks } from './ts-loader.mjs';

registerTsAliasHooks();

const ROOT = process.cwd();
const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith('-')) || 'help';
const flags = new Set(args.filter((a) => a.startsWith('--')));
const jsonMode = flags.has('--json');

function getFlagValue(name, fallback = '') {
	const values = [];
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a.startsWith(`${name}=`)) values.push(a.slice(name.length + 1));
		else if (a === name && i + 1 < args.length && !args[i + 1].startsWith('--')) values.push(args[++i]);
	}
	if (values.length === 0) return fallback;
	return name === '--files' ? values.join(',') : values[values.length - 1];
}

const VALUE_FLAGS = new Set([
	'--port', '--target', '--search', '--ua', '--body', '--socket', '--url', '--iterations',
	'--rows', '--dist', '--baseline-file', '--max-regression-pct', '--max-factor', '--floor-us', '--files',
]);

function getPositionalArgs() {
	const out = [];
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (VALUE_FLAGS.has(a)) {
			if (i + 1 < args.length && !args[i + 1].startsWith('-')) i++;
			continue;
		}
		if (!a.startsWith('-')) out.push(a);
	}
	return out;
}

function output(data, humanFormatter) {
	if (jsonMode) {
		console.log(JSON.stringify(data, null, 2));
	} else if (humanFormatter) {
		humanFormatter(data);
	} else {
		console.log(data);
	}
}

function runGateScriptAsync(scriptRelPath, extraArgs = []) {
	return new Promise((resolvePromise) => {
		const t0 = performance.now();
		const child = spawn(
			process.execPath,
			['--no-warnings', join(ROOT, scriptRelPath), ...extraArgs],
			{ cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
		);
		const stdoutChunks = [];
		const stderrChunks = [];
		child.stdout?.on('data', (chunk) => stdoutChunks.push(chunk));
		child.stderr?.on('data', (chunk) => stderrChunks.push(chunk));
		child.on('error', (err) => {
			resolvePromise({
				script: scriptRelPath,
				ok: false,
				code: 1,
				durationMs: Number((performance.now() - t0).toFixed(1)),
				stdout: Buffer.concat(stdoutChunks).toString('utf-8').trim(),
				stderr: (Buffer.concat(stderrChunks).toString('utf-8') || err.message).trim(),
			});
		});
		child.on('close', (code) => {
			resolvePromise({
				script: scriptRelPath,
				ok: code === 0,
				code: code ?? 1,
				durationMs: Number((performance.now() - t0).toFixed(1)),
				stdout: Buffer.concat(stdoutChunks).toString('utf-8').trim(),
				stderr: Buffer.concat(stderrChunks).toString('utf-8').trim(),
			});
		});
	});
}

async function cmdStatus() {
	await runStatusCommand(ROOT, output);
}

async function cmdVerify() {
	const hasFilesFlag = args.some((a) => a === '--files' || a.startsWith('--files='));
	const stagedMode = flags.has('--staged');
	const scoped = hasFilesFlag || stagedMode;
	let results;
	if (scoped) {
		const scopeArgs = [...(hasFilesFlag ? ['--files', getFlagValue('--files', '')] : []), ...(stagedMode ? ['--staged'] : [])];
		results = await Promise.all(
			['scripts/check-file-lengths.mjs', 'scripts/verify-ast.mjs'].map((s) => runGateScriptAsync(s, scopeArgs))
		);
	} else {
		const checkArgs = flags.has('--check') ? ['--check'] : [];
		const codegenScripts = ['scripts/gen-apps.mjs', 'scripts/gen-ai-index.mjs', 'scripts/gen-docs.mjs'];
		const checkScripts = [
			'scripts/check-file-lengths.mjs',
			'scripts/check-pure.mjs',
			'scripts/verify-ast.mjs',
			'scripts/check-tokens.mjs',
			'scripts/check-test-language.mjs',
			'scripts/check-no-turkish.mjs',
		];
		const [codegenResults, checkResults] = await Promise.all([
			Promise.all(codegenScripts.map((s) => runGateScriptAsync(s, checkArgs))),
			Promise.all(checkScripts.map((s) => runGateScriptAsync(s))),
		]);
		results = [...codegenResults, ...checkResults];
	}
	const passed = results.every((r) => r.ok);
	output({ ok: passed, ...(scoped ? { scoped: true } : {}), checks: results }, (d) => {
		for (const r of d.checks) {
			console.log(`${r.ok ? '[PASS]' : '[FAIL]'} ${r.script} (${r.durationMs}ms)`);
			if (!r.ok && (r.stderr || r.stdout)) console.error(r.stderr || r.stdout);
		}
	});
	if (!passed) process.exit(1);
}

async function cmdFim() {
	const target = getFlagValue('--target', 'repo');
	const saveBaseline = flags.has('--save-baseline');
	const { runFimScan } = await import('@/db/repositories/inspection/fim');
	const res = await runFimScan(target, { force: true, saveBaseline });
	output(res, (r) => {
		console.log(`FIM [${r.targetKey || target}] scanned ${r.scannedFiles} files in ${r.durationMs}ms`);
		console.log(`  Anomalies: ${r.anomalies.length} | Suspicious findings: ${r.suspiciousFiles.length} | Baseline saved: ${r.baselineSaved}`);
		for (const m of r.suspiciousFiles.slice(0, 10)) {
			console.log(`  ! [${m.severity}] ${m.matchedRule} @ ${m.path}:${m.line}`);
		}
	});
	if (!flags.has('--no-fail-on-findings') && res.suspiciousFiles.some((f) => f.severity === 'CRITICAL')) {
		process.exit(2);
	}
}

async function cmdWaf() {
	const pos = getPositionalArgs();
	const rawTarget = pos[1] || '/';
	const qIdx = rawTarget.indexOf('?');
	const pathname = qIdx >= 0 ? rawTarget.slice(0, qIdx) || '/' : rawTarget;
	const explicitSearch = getFlagValue('--search', '');
	const search = explicitSearch || (qIdx >= 0 ? rawTarget.slice(qIdx) : '');
	const userAgent = getFlagValue('--ua', '');
	const body = getFlagValue('--body', '');
	const { inspectRequestComponents } = await import('@/lib/waf/requestWaf');
	const { inspectWafWithGuard, getSecurityGuardTransportInfo } = await import('@/server/security/securityGuardClient');
	const local = inspectRequestComponents({ pathname, search, userAgent });
	const guard = await inspectWafWithGuard({ pathname, search, userAgent, body });
	const payload = {
		ok: true,
		input: { pathname, search, userAgent },
		local,
		guard,
		guardTransport: getSecurityGuardTransportInfo().transport,
	};
	output(payload, (d) => {
		console.log(`WAF local: matched=${d.local.matched} category=${d.local.category || '-'} points=${d.local.points} sig=${d.local.signature || '-'}`);
		console.log(`WAF guard (${d.guardTransport}): ${d.guard ? `matched=${d.guard.matched} points=${d.guard.points}` : 'unavailable'}`);
	});
}

async function cmdSingleGate(scriptPath, extraArgs = []) {
	const r = await runGateScriptAsync(scriptPath, extraArgs);
	output(r, (res) => {
		if (res.stdout) console.log(res.stdout);
		if (res.stderr) console.error(res.stderr);
	});
	if (!r.ok) process.exit(r.code || 1);
}

async function cmdPassthrough(scriptPath, dropPrefixCount = 1) {
	const forwarded = [];
	let skipped = 0;
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (skipped < dropPrefixCount && !a.startsWith('-')) {
			skipped++;
			continue;
		}
		forwarded.push(a);
	}
	const r = await runGateScriptAsync(scriptPath, forwarded);
	if (r.stdout) console.log(r.stdout);
	if (r.stderr) console.error(r.stderr);
	if (!r.ok) process.exit(r.code || 1);
}

async function cmdQuotas() {
	await runQuotasCommand(output);
}

async function cmdTest() {
	const suite = getPositionalArgs()[1] || 'contract';
	const t0 = performance.now();
	if (suite === 'contract') {
		const testDir = join(ROOT, 'tests', 'contract');
		const testFiles = readdirSync(testDir)
			.filter((f) => f.endsWith('.test.mjs'))
			.sort()
			.map((f) => join('tests', 'contract', f));
		const res = spawnSync(process.execPath, ['--no-warnings', '--test', ...testFiles], {
			cwd: ROOT,
			encoding: 'utf-8',
		});
		const durationMs = Number((performance.now() - t0).toFixed(1));
		const ok = res.status === 0;
		output({ ok, suite, code: res.status ?? 1, durationMs, stdout: (res.stdout || '').trim(), stderr: (res.stderr || '').trim() }, (d) => {
			if (d.stdout) console.log(d.stdout);
			if (d.stderr) console.error(d.stderr);
			console.log(`Contract suite ${d.ok ? 'PASSED' : 'FAILED'} in ${d.durationMs}ms`);
		});
		if (!ok) process.exit(res.status || 1);
		return;
	}

	const scriptMap = { security: 'test:security', e2e: 'e2e', sim: 'test:e2e' };
	const npmScript = scriptMap[suite];
	if (!npmScript) {
		console.error(`Unknown test suite '${suite}'. Valid suites: contract, security, e2e, sim`);
		process.exit(2);
	}
	const res = spawnSync('pnpm', [npmScript], {
		cwd: ROOT,
		encoding: 'utf-8',
		stdio: jsonMode ? 'pipe' : 'inherit',
	});
	const durationMs = Number((performance.now() - t0).toFixed(1));
	const ok = res.status === 0;
	if (jsonMode) {
		output({ ok, suite, code: res.status ?? 1, durationMs, stdout: (res.stdout || '').trim(), stderr: (res.stderr || '').trim() });
	}
	if (!ok) process.exit(res.status || 1);
}

async function cmdIpcPing() {
	const customSocket = getFlagValue('--socket', '');
	if (customSocket) process.env.ORBIT_GUARD_SOCKET = customSocket;
	const customUrl = getFlagValue('--url', '');
	if (customUrl) process.env.SECURITY_GUARD_URL = customUrl;
	const { checkSecurityGuardHealth } = await import('@/server/security/securityGuardClient');
	const t0 = performance.now();
	const health = await checkSecurityGuardHealth();
	const latencyMs = Number((performance.now() - t0).toFixed(3));
	output({ ...health, latencyMs }, (d) => {
		console.log(`IPC Ping: available=${d.available} transport=${d.transport} latency=${d.latencyMs}ms`);
	});
	if (!health.available) process.exit(1);
}

async function cmdBench() {
	const { runBenchmarks } = await import('./bench-runner.mjs');
	const result = await runBenchmarks({
		iterations: getFlagValue('--iterations', '200'),
		saveBaseline: flags.has('--save-baseline') || flags.has('--baseline'),
		compare: flags.has('--compare'),
		baselineFile: getFlagValue('--baseline-file', 'scripts/bench-baseline.json'),
		maxFactor: getFlagValue('--max-factor', '3.0'),
		floorUs: getFlagValue('--floor-us', '8'),
	});
	output(result, (d) => {
		console.log(`Orbit Bench (${d.iterations} iterations)`);
		console.log(`  WAF inspect:    p50=${d.wafInspectionUs.p50}us p99=${d.wafInspectionUs.p99}us`);
		console.log(`  WASM crypto:    p50=${d.wasmSecurityUs.p50}us p99=${d.wasmSecurityUs.p99}us`);
		console.log(`  Security rules: p50=${d.securityRulesUs.p50}us p99=${d.securityRulesUs.p99}us`);
		console.log(`  SSE encode:     p50=${d.sseProtocolUs.p50}us p99=${d.sseProtocolUs.p99}us`);
		if (d.baselineSaved) console.log(`  Saved baseline -> ${d.baselineSaved}`);
		if (d.comparison?.diffs?.length) {
			for (const diff of d.comparison.diffs) {
				console.log(`  Compare ${diff.metric}: ${diff.prevP50Us}us -> ${diff.curP50Us}us (limit ${diff.limitP50Us}us)${diff.regressed ? ' [REGRESSED]' : ''}`);
			}
		}
		if (!d.ok) {
			for (const r of d.regressions) console.error(`  ! ${r}`);
		}
	});
	if (!result.ok) process.exit(1);
}

function showHelp() {
	printGroupedHelp(jsonMode);
}

try {
	switch (command) {
		case 'doctor': {
			const { runDoctorCommand } = await import('./cli/doctor.mjs');
			await runDoctorCommand(ROOT, flags, output);
			break;
		}
		case 'dev': {
			const { runDevCommand } = await import('./cli/dev.mjs');
			await runDevCommand(ROOT, args, flags, output, getFlagValue);
			break;
		}
		case 'setup': {
			const { runSetupCommand } = await import('./cli/setup-cmd.mjs');
			await runSetupCommand(ROOT, getPositionalArgs().slice(1), flags, output);
			break;
		}
		case 'status':
			await cmdStatus();
			break;
		case 'verify':
			await cmdVerify();
			break;
		case 'test':
			await cmdTest();
			break;
		case 'quotas':
			await cmdQuotas();
			break;
		case 'fim':
			await cmdFim();
			break;
		case 'waf':
			await cmdWaf();
			break;
		case 'audit':
			await cmdSingleGate('scripts/check-audit-coverage.mjs');
			break;
		case 'tokens':
			await cmdSingleGate('scripts/check-tokens.mjs');
			break;
		case 'i18n':
			await cmdSingleGate('scripts/check-i18n.mjs');
			break;
		case 'empty-catch':
			await cmdSingleGate('scripts/check-empty-catch.mjs');
			break;
		case 'ipc-ping':
			await cmdIpcPing();
			break;
		case 'bench':
			await cmdBench();
			break;
		case 'bundle-budget':
			await cmdPassthrough('scripts/check-bundle-budget.mjs', 1);
			break;
		case 'db-explain':
			await cmdPassthrough('scripts/db-explain.mjs', 1);
			break;
		case 'db': {
			const dbArgs = getPositionalArgs().slice(1);
			if (dbArgs[0] === 'explain') {
				await cmdPassthrough('scripts/db-explain.mjs', 2);
				break;
			}
			const { runDbCommand } = await import('./cli/db.mjs');
			await runDbCommand(ROOT, dbArgs, flags, output);
			break;
		}
		case 'ai': {
			const { runAiCommand } = await import('./cli/ai.mjs');
			await runAiCommand(ROOT, getPositionalArgs().slice(1), flags, getFlagValue);
			break;
		}
		case 'help':
		default:
			if (args.includes('--help') || args.includes('-h') || command === 'help') {
				showHelp();
			} else {
				console.error(`Unknown command: ${command}`);
				showHelp();
				process.exit(2);
			}
	}
	process.exit(0);
} catch (err) {
	const msg = err instanceof Error ? err.message : String(err);
	if (jsonMode) console.error(JSON.stringify({ ok: false, error: msg }));
	else console.error(`orbit error: ${msg}`);
	process.exit(1);
}
