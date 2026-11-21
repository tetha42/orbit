import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createStyle, formatPgError, printCheckLine } from './format.mjs';

function detectDockerEnvironment() {
	const info = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
		encoding: 'utf8',
		timeout: 2500,
	});
	if (info.status !== 0) {
		return { available: false, version: null, containers: [] };
	}

	const ps = spawnSync(
		'docker',
		['ps', '--filter', 'status=running', '--format', '{{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}'],
		{ encoding: 'utf8', timeout: 2500 }
	);
	const containers = [];
	if (ps.status === 0 && ps.stdout) {
		for (const rawLine of ps.stdout.split(/\r?\n/)) {
			const line = rawLine.trim();
			if (!line) continue;
			const [name = '', image = '', ports = '', status = ''] = line.split('\t');
			if (/postgres|postgis|timescale/i.test(image) || ports.includes('5432/tcp')) {
				containers.push({ name, image, ports, status });
			}
		}
	}
	return { available: true, version: (info.stdout || '').trim() || 'unknown', containers };
}

async function probeDatabase(dbUrl) {
	try {
		const { default: pg } = await import('pg');
		const client = new pg.Client({ connectionString: dbUrl, connectionTimeoutMillis: 2500 });
		try {
			await client.connect();
			const res = await client.query('SELECT current_database() AS db, current_user AS usr');
			return {
				ok: true,
				database: res.rows[0]?.db || 'unknown',
				user: res.rows[0]?.usr || 'unknown',
			};
		} finally {
			await client.end().catch(() => {
				/* Ignore socket close failure after failed or aborted connection */
			});
		}
	} catch (err) {
		return { ok: false, error: formatPgError(err) };
	}
}

export async function runDoctorCommand(ROOT, flags, output) {
	const jsonMode = flags.has('--json');
	const checks = [];

	const majorNode = parseInt(process.versions.node.split('.')[0], 10);
	checks.push({
		id: 'node',
		label: 'Node.js Runtime',
		status: majorNode >= 22 ? 'ok' : 'fail',
		detail: `v${process.versions.node} (requires >= 22.0.0)`,
		fix: majorNode >= 22 ? '' : 'Install Node.js >= 22 LTS',
	});

	const pnpmRes = spawnSync('pnpm', ['--version'], { encoding: 'utf8', timeout: 2500 });
	checks.push({
		id: 'pnpm',
		label: 'pnpm Package Manager',
		status: pnpmRes.status === 0 ? 'ok' : 'fail',
		detail: pnpmRes.status === 0 ? `v${(pnpmRes.stdout || '').trim()}` : 'pnpm CLI not found',
		fix: pnpmRes.status === 0 ? '' : 'Enable pnpm via Corepack: corepack enable',
	});

	const hasNodeModules = existsSync(join(ROOT, 'node_modules'));
	checks.push({
		id: 'dependencies',
		label: 'Workspace Dependencies',
		status: hasNodeModules ? 'ok' : 'warn',
		detail: hasNodeModules ? 'node_modules present' : 'node_modules missing',
		fix: hasNodeModules ? '' : 'pnpm install',
	});

	const docker = detectDockerEnvironment();
	checks.push({
		id: 'docker',
		label: 'Docker Daemon',
		status: docker.available ? 'ok' : 'warn',
		detail: docker.available
			? `Reachable (Engine ${docker.version}; ${docker.containers.length} running Postgres container(s))`
			: 'Docker daemon unreachable or not installed',
		fix: docker.available ? '' : 'Start Docker service if you plan to run local containers',
	});

	const { collectConfigProvenance, resolveDatabaseUrlWithSource } = await import('@/server/config/provenance');
	const config = collectConfigProvenance(ROOT);
	const dbResolved = resolveDatabaseUrlWithSource(ROOT);

	let dbUrlSyntaxValid = false;
	if (!dbResolved.url) {
		checks.push({
			id: 'database_config',
			label: 'DATABASE_URL Config',
			status: 'warn',
			detail: 'Not configured yet (empty)',
			fix: './bin/orbit db up  (or configure in /setup wizard)',
		});
	} else {
		try {
			const parsed = new URL(dbResolved.url);
			dbUrlSyntaxValid = parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:';
			checks.push({
				id: 'database_config',
				label: 'DATABASE_URL Config',
				status: dbUrlSyntaxValid ? 'ok' : 'fail',
				detail: dbUrlSyntaxValid
					? `Valid PostgreSQL URI (source: ${dbResolved.source})`
					: `Unsupported scheme '${parsed.protocol}' (source: ${dbResolved.source})`,
				fix: dbUrlSyntaxValid ? '' : 'Use postgresql://user:pass@host:5432/dbname in .env.local or data/runtime-config.json',
			});
		} catch {
			checks.push({
				id: 'database_config',
				label: 'DATABASE_URL Config',
				status: 'fail',
				detail: `Malformed URI (source: ${dbResolved.source})`,
				fix: 'Fix DATABASE_URL syntax in .env.local or reset setup via ./bin/orbit setup reset',
			});
		}
	}

	if (dbUrlSyntaxValid) {
		const probe = await probeDatabase(dbResolved.url);
		checks.push({
			id: 'database_probe',
			label: 'PostgreSQL Connection',
			status: probe.ok ? 'ok' : 'warn',
			detail: probe.ok
				? `Connected to '${probe.database}' as '${probe.user}'`
				: `Unreachable (${probe.error})`,
			fix: probe.ok ? '' : 'Start dev DB with ./bin/orbit db up or verify credentials in /setup',
		});
	}

	const { getSetupToken, isSetupLocked, resolveSetupUrl } = await import('@/lib/setup');
	const locked = isSetupLocked();
	const token = getSetupToken();
	const hasRuntimeConfig = existsSync(join(ROOT, 'data', 'runtime-config.json'));
	const bootstrapEntry = config.find((c) => c.key === 'BOOTSTRAP_ADMIN_PASSWORD');
	const bootstrapConfigured = Boolean(bootstrapEntry?.configured);
	const setupUrl = !locked && token ? resolveSetupUrl(token) : null;

	checks.push({
		id: 'setup',
		label: 'First-Run Setup State',
		status: locked || bootstrapConfigured ? 'ok' : token ? 'warn' : 'info',
		detail: locked
			? 'Locked and complete (data/setup.lock present)'
			: bootstrapConfigured
				? 'Headless bootstrap active via BOOTSTRAP_ADMIN_PASSWORD'
				: token
					? 'Unlocked (setup token present in data/orbit.setup.token)'
					: 'Unlocked (token will be generated on first server boot or ./bin/orbit setup url)',
		fix: setupUrl ? `Open ${setupUrl}` : '',
	});

	const hasRegistry = existsSync(join(ROOT, 'src', 'apps', 'registry.gen.ts'));
	const hasLoaders = existsSync(join(ROOT, 'src', 'apps', 'loaders.gen.ts'));
	const hasAiIndex = existsSync(join(ROOT, 'AI_INDEX.json'));
	const codegenReady = hasRegistry && hasLoaders && hasAiIndex;
	checks.push({
		id: 'codegen',
		label: 'Generated Contracts & Docs',
		status: codegenReady ? 'ok' : 'warn',
		detail: codegenReady ? 'registry.gen.ts, loaders.gen.ts & AI_INDEX.json present' : 'Missing generated index files',
		fix: codegenReady ? '' : 'pnpm gen:apps',
	});

	const hasFailure = checks.some((c) => c.status === 'fail');
	const payload = {
		ok: !hasFailure,
		checks,
		config,
		dockerContainers: docker.containers,
		setup: {
			locked,
			hasToken: Boolean(token),
			hasRuntimeConfig,
			bootstrapConfigured,
			setupUrl,
		},
	};

	output(payload, (d) => {
		const s = createStyle(jsonMode);
		console.log(`${s.bold(s.cyan('Orbit Doctor — Environment & Config Diagnostics'))}\n`);
		for (const item of d.checks) {
			printCheckLine(s, item.status, item.label, item.detail, item.fix);
		}
		console.log(`\n${s.bold('Config Provenance (secrets masked):')}`);
		for (const entry of d.config) {
			const tag = s.dim(`[${entry.source}]`);
			console.log(`  ${entry.key.padEnd(26)} ${entry.value.padEnd(44)} ${tag}`);
		}
		if (d.dockerContainers.length > 0) {
			console.log(`\n${s.bold('Running Docker Postgres Containers:')}`);
			for (const c of d.dockerContainers) {
				console.log(`  - ${c.name} (${c.image}) :: ${c.ports || 'no host port'}`);
			}
		}
	});

	if (!payload.ok) process.exit(1);
}
