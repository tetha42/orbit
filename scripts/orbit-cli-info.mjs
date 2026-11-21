import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export async function runStatusCommand(ROOT, output) {
	const { checkSecurityGuardHealth, resolveGuardSocketPath } = await import('@/server/security/securityGuardClient');
	const { getStreamQuotaSnapshot } = await import('@/server/sse/streamQuota');
	const { getBaselinePathForScope } = await import('@/db/repositories/inspection/fim');
	const guardHealth = await checkSecurityGuardHealth();
	const sockEnv = resolveGuardSocketPath();
	const baselines = ['repo', 'uploads', 'tmp', 'custom'].map((scope) => {
		const full = getBaselinePathForScope(scope);
		const rel = relative(ROOT, full) || full;
		if (!existsSync(full)) return { scope, path: rel, exists: false, entries: 0 };
		try {
			const parsed = JSON.parse(readFileSync(full, 'utf-8'));
			return {
				scope,
				path: rel,
				exists: true,
				sizeBytes: statSync(full).size,
				entries: Object.keys(parsed).length,
			};
		} catch {
			return { scope, path: rel, exists: true, entries: -1 };
		}
	});
	const buildIdPath = join(ROOT, '.next', 'BUILD_ID');
	const payload = {
		ok: true,
		root: ROOT,
		node: process.version,
		nextBuildReady: existsSync(buildIdPath),
		nextBuildId: existsSync(buildIdPath) ? readFileSync(buildIdPath, 'utf-8').trim() : null,
		securityGuard: {
			available: guardHealth.available,
			transport: guardHealth.transport || 'local-fallback',
			uptimeSeconds: guardHealth.uptime ?? null,
			unixSocketDetected: sockEnv,
		},
		sseActiveStreams: getStreamQuotaSnapshot(),
		fimBaselines: baselines,
	};
	output(payload, (d) => {
		console.log(`Orbit Status (${d.root})`);
		console.log(`  Node: ${d.node} | Next Build: ${d.nextBuildReady ? `ready (${d.nextBuildId})` : 'not built'}`);
		console.log(`  Security Guard: ${d.securityGuard.available ? `UP via ${d.securityGuard.transport}` : 'OFFLINE (local fallback)'}`);
		console.log(`  Baselines: ${d.fimBaselines.map((b) => `${b.path}=${b.exists ? b.entries : 'missing'}`).join(', ')}`);
	});
}

export async function runQuotasCommand(output) {
	const { getStreamQuotaSnapshot } = await import('@/server/sse/streamQuota');
	const { getSecurityGuardTransportInfo, resolveGuardSocketPath } = await import('@/server/security/securityGuardClient');
	const { MAX_UPLOAD_BYTES } = await import('@/lib/uploads');
	const payload = {
		ok: true,
		sseActiveStreams: getStreamQuotaSnapshot(),
		sseLimits: {
			system: { maxPerUser: 8, maxGlobal: 512 },
			soc: { maxPerUser: 4, maxGlobal: 64 },
			chat: { maxPerUser: 6, maxGlobal: 256 },
			terminal: { maxPerUser: 6, maxGlobal: 64 },
		},
		httpBodyLimitsBytes: {
			uploadMax: MAX_UPLOAD_BYTES,
			auditJsonMax: 1024 * 1024,
			dbImportJsonMax: 5 * 1024 * 1024,
			securityGuardJsonMax: 1024 * 1024,
		},
		securityGuard: {
			transport: getSecurityGuardTransportInfo().transport,
			socketPath: resolveGuardSocketPath(),
		},
	};
	output(payload, (d) => {
		console.log('Orbit System Quotas & Transports');
		console.log(`  SSE active slots: ${JSON.stringify(d.sseActiveStreams)}`);
		console.log(`  Upload max: ${(d.httpBodyLimitsBytes.uploadMax / (1024 * 1024)).toFixed(1)} MiB | Audit JSON max: 1.0 MiB`);
		console.log(`  Security Guard: ${d.securityGuard.transport} (sock=${d.securityGuard.socketPath})`);
	});
}
